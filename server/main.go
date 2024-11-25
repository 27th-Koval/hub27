package main

import (
	"context"
	"encoding/json"
	"iter"
	"log"
	"net/http"
	"slices"
	"sort"
	"sync"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

func main() {
	var shutdownWG sync.WaitGroup
	ot := NewOrderTracking()
	pp := NewPeerPool(ot)
	var h http.ServeMux
	wsup := websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
	}
	buildPaths(&h, wsup, pp)
	s := &http.Server{
		Handler: &h,
	}
	shutdownWG.Add(1)
	s.RegisterOnShutdown(func() {
		pp.Shutdown()
		shutdownWG.Done()
	})
	shutdownWG.Add(1)
	go func() {
		log.Fatal(s.ListenAndServe())
		s.Shutdown(context.TODO())
		shutdownWG.Done()
	}()
	shutdownWG.Wait()
}

func buildPaths(h *http.ServeMux, wsup websocket.Upgrader, pp *PeerPool) {
	h.HandleFunc("GET /order/conn", makeNewWsHandler(wsup, pp))
	h.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./web/order_table.html")
	})
	h.HandleFunc("GET /create", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./web/order_creation.html")
	})
	h.Handle("GET /js/", http.StripPrefix("/js", http.FileServer(http.Dir("./web/js"))))
	h.Handle("GET /img/", http.StripPrefix("/img", http.FileServer(http.Dir("./web/img"))))
}

func makeNewWsHandler(wsup websocket.Upgrader, oh *PeerPool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// TODO: Can use cookies to check auth status
		conn, err := wsup.Upgrade(w, r, nil)
		if err != nil {
			log.Println(err)
			return
		}
		wsconn := NewWSConn(conn)
		oh.AddPeer(wsconn)
	}
}

///////////////////////////////////////////////////////////////////////////////
// Websocket API

type WireMessage struct {
	Kind    string `json:"kind"`
	Payload any    `json:"payload"`
}

const (
	KindGetOrdersRequest   = "GetOrdersRequest"
	KindOrdersResponse     = "OrdersResponse"
	KindAddOrderRequest    = "AddOrderRequest"
	KindUpdateOrderRequest = "UpdateOrderRequest"
)

type GetOrdersRequest struct{}

type OrdersResponse struct {
	Orders []*Order `json:"orders"`
}

type AddOrderRequest struct {
	Priority int    `json:"priority"`
	ItemID   int    `json:"itemId"`
	Quantity int    `json:"quantity"`
	Location string `json:"location"`
	Method   string `json:"method"`
	Creator  string `json:"creator"`
}

type UpdateOrderRequest struct {
	ID        uuid.UUID `json:"id"`
	QtyRemove int       `json:"qtyRemove"`
}

// Helpers

type PartialWireMessage struct {
	Kind    string          `json:"kind"`
	Payload json.RawMessage `json:"payload"`
}

///////////////////////////////////////////////////////////////////////////////

type Priority int

func (p Priority) String() string {
	switch p {
	case 1:
		return "Top"
	case 2:
		return "High"
	case 3:
		return "Regular"
	case 4:
		return "Low"
	case 5:
		return "Standing"
	}
	return "Unknown"
}

type Order struct {
	ID           uuid.UUID `json:"id"`
	Priority     Priority  `json:"priority"`
	PriorityName string    `json:"priorityName"`
	ItemID       int       `json:"itemId"`
	ItemName     string    `json:"itemName"`
	ItemIcon     string    `json:"itemIcon"`
	Quantity     int       `json:"quantity"`
	Location     string    `json:"location"`
	Method       string    `json:"method"`
	Creator      string    `json:"creator"`
}

type SortedOrders []*Order

func (s SortedOrders) Len() int {
	return len(s)
}

func (s SortedOrders) Less(i, j int) bool {
	return s[i].Priority < s[j].Priority ||
		s[i].ItemName < s[j].ItemName ||
		s[i].Location < s[j].Location ||
		s[i].Quantity < s[j].Quantity ||
		s[i].Creator < s[j].Creator
}

func (s SortedOrders) Swap(i, j int) {
	s[i], s[j] = s[j], s[i]
}

type OrderTracking struct {
	orders []*Order
	mu     sync.RWMutex
}

func NewOrderTracking() *OrderTracking {
	return &OrderTracking{}
}

// Implements WSHandler
func (o *OrderTracking) Handle(w Sender, r *Request) {
	var p PartialWireMessage
	err := json.Unmarshal(r.Payload, &p)
	if err != nil {
		log.Printf("OrderTracking.Handle Unmarshal: %s", err)
		return
	}
	switch p.Kind {
	case KindAddOrderRequest:
		var q []*AddOrderRequest
		err = json.Unmarshal(p.Payload, &q)
		if err != nil {
			log.Printf("OrderTracking.Handle AddOrderRequest Unmarshal: %s", err)
			return
		}
		err = o.AddOrders(w, r, q)
		if err != nil {
			log.Printf("OrderTracking.Handle AddOrder: %s", err)
			return
		}
	case KindGetOrdersRequest:
		var q GetOrdersRequest
		err = json.Unmarshal(p.Payload, &q)
		if err != nil {
			log.Printf("OrderTracking.Handle GetOrdersRequest Unmarshal: %s", err)
			return
		}
		err = o.GetOrders(w, r, &q)
		if err != nil {
			log.Printf("OrderTracking.Handle GetOrders: %s", err)
			return
		}
	case KindUpdateOrderRequest:
		var q UpdateOrderRequest
		err = json.Unmarshal(p.Payload, &q)
		if err != nil {
			log.Printf("OrderTracking.Handle UpdateOrderRequest Unmarshal: %s", err)
			return
		}
		err = o.UpdateOrders(w, r, &q)
		if err != nil {
			log.Printf("OrderTracking.Handle UpdateOrders: %s", err)
			return
		}
	case KindOrdersResponse:
		log.Printf("OrderTracking.Handle: Received OrdersResponse, but server doesn't do anything with it.")
		return
	default:
		log.Printf("OrderTracking.Handle: Unknown kind=%s", p.Kind)
		return
	}
}

func (o *OrderTracking) sendEveryoneOrdersResponse(s Senders) error {
	o.mu.RLock()
	defer o.mu.RUnlock()
	msg := WireMessage{
		Kind: KindOrdersResponse,
		Payload: OrdersResponse{
			Orders: o.orders,
		},
	}
	msgs, err := json.Marshal(&msg)
	if err != nil {
		return err
	}
	for _, v := range s.Senders() {
		err := v.WriteText(string(msgs))
		if err != nil {
			log.Printf("sendEveryoneOrdersResponse: %s", err)
		}
	}
	return nil
}

func (o *OrderTracking) AddOrders(w Sender, r *Request, orders []*AddOrderRequest) error {
	o.mu.Lock()
	for _, q := range orders {
		item := getItem(q.ItemID)
		d := &Order{
			ID:           uuid.New(),
			Priority:     Priority(q.Priority),
			PriorityName: Priority(q.Priority).String(),
			ItemID:       item.ID,
			ItemName:     item.Name,
			ItemIcon:     item.Icon,
			Quantity:     q.Quantity,
			Location:     q.Location,
			Method:       q.Method,
			Creator:      q.Creator,
		}
		o.orders = append(o.orders, d)
	}
	sort.Sort(SortedOrders(o.orders))
	o.mu.Unlock()

	return o.sendEveryoneOrdersResponse(r.Peers)
}

func (o *OrderTracking) GetOrders(w Sender, r *Request, q *GetOrdersRequest) error {
	o.mu.RLock()
	defer o.mu.RUnlock()
	msg := WireMessage{
		Kind: KindOrdersResponse,
		Payload: OrdersResponse{
			Orders: o.orders,
		},
	}
	msgs, err := json.Marshal(&msg)
	if err != nil {
		return err
	}
	s := r.Peers.Sender(r.PeerID)
	if s == nil {
		return nil
	}
	err = s.WriteText(string(msgs))
	if err != nil {
		return err
	}
	return nil
}

func (o *OrderTracking) UpdateOrders(w Sender, r *Request, q *UpdateOrderRequest) error {
	o.mu.Lock()
	var idx *int = nil
	for i, v := range o.orders {
		if q.ID == v.ID {
			idx = &i
		}
	}
	if idx == nil {
		o.mu.Unlock()
		return nil
	}
	o.orders[*idx].Quantity -= q.QtyRemove
	if o.orders[*idx].Quantity <= 0 {
		o.orders = slices.Delete(o.orders, *idx, *idx+1)
	}
	o.mu.Unlock()

	return o.sendEveryoneOrdersResponse(r.Peers)
}

///////////////////////////////////////////////////////////////////////////////

type WSHandler interface {
	Handle(w Sender, r *Request)
}

type Senders interface {
	Sender(u uuid.UUID) Sender
	Senders() iter.Seq2[uuid.UUID, Sender]
}

type Sender interface {
	WriteText(msg string) error
	WriteBinary(msg []byte) error
}

type Request struct {
	Context context.Context
	Type    int
	Payload []byte
	PeerID  uuid.UUID
	Peers   Senders
}

type PeerPool struct {
	h     WSHandler
	peers map[uuid.UUID]*WSConn
	pmu   sync.RWMutex
}

func NewPeerPool(h WSHandler) *PeerPool {
	return &PeerPool{
		h:     h,
		peers: make(map[uuid.UUID]*WSConn),
	}
}

func (o *PeerPool) Shutdown() {
	o.pmu.Lock()
	defer o.pmu.Unlock()
	for _, p := range o.peers {
		p.Close()
	}
}

func (o *PeerPool) Senders() iter.Seq2[uuid.UUID, Sender] {
	o.pmu.RLock()
	return func(yield func(uuid.UUID, Sender) bool) {
		defer o.pmu.RUnlock()
		for id, v := range o.peers {
			if !yield(id, v) {
				return
			}
		}
	}
}

func (o *PeerPool) addPeer(ws *WSConn) uuid.UUID {
	o.pmu.Lock()
	defer o.pmu.Unlock()
	id := uuid.New()
	for _, ok := o.peers[id]; ok; {
		id = uuid.New()
	}
	o.peers[id] = ws
	return id
}

func (o *PeerPool) getRemovePeerCallback(u uuid.UUID) CloseCallback {
	return sync.OnceFunc(func() {
		o.pmu.Lock()
		defer o.pmu.Unlock()
		delete(o.peers, u)
	})
}

func (o *PeerPool) getReceiveCallback(conn *WSConn, u uuid.UUID) WSCallback {
	return func(c context.Context, mtype int, p []byte) {
		r := &Request{
			Context: c,
			Type:    mtype,
			Payload: p,
			PeerID:  u,
			Peers:   o,
		}
		o.h.Handle(conn, r)
	}
}

func (o *PeerPool) AddPeer(conn *WSConn) {
	id := o.addPeer(conn)
	conn.SetReadCallback(o.getReceiveCallback(conn, id))
	conn.SetCloseCallback(o.getRemovePeerCallback(id))
	conn.Start()
}

func (o *PeerPool) Sender(u uuid.UUID) Sender {
	o.pmu.RLock()
	defer o.pmu.RUnlock()
	return o.peers[u]
}

///////////////////////////////////////////////////////////////////////////////

type WSCallback func(c context.Context, mtype int, p []byte)
type CloseCallback func()

type writep struct {
	MType   int
	Payload []byte
}

type WSConn struct {
	conn      *websocket.Conn
	close     chan any
	closeOnce sync.Once
	write     chan writep
	cb        WSCallback
	ccb       CloseCallback
	closeFn   context.CancelFunc
	closeFnMu sync.Mutex
}

func NewWSConn(conn *websocket.Conn) *WSConn {
	w := &WSConn{
		conn:      conn,
		close:     make(chan any),
		write:     make(chan writep),
		closeFnMu: sync.Mutex{},
	}
	return w
}

func (w *WSConn) SetReadCallback(cb WSCallback) {
	w.cb = cb
}

func (w *WSConn) SetCloseCallback(ccb CloseCallback) {
	w.ccb = ccb
}

func (w *WSConn) Start() {
	go func() {
		for {
			mtype, p, err := w.conn.ReadMessage()
			if err != nil {
				log.Println(err)
				w.Close()
				return
			}
			w.closeFnMu.Lock()
			var c context.Context
			c, w.closeFn = context.WithCancel(context.Background())
			w.closeFnMu.Unlock()

			w.cb(c, mtype, p)

			w.closeFnMu.Lock()
			w.closeFn = nil
			w.closeFnMu.Unlock()
		}
	}()
	go func() {
		for {
			select {
			case <-w.close:
				return
			case wp := <-w.write:
				if err := w.conn.WriteMessage(wp.MType, wp.Payload); err != nil {
					log.Println(err)
					w.Close()
					return
				}
			}
		}
	}()
}

func (w *WSConn) Close() {
	w.closeOnce.Do(func() {
		close(w.close)
		w.conn.Close()
		w.closeFnMu.Lock()
		if w.closeFn != nil {
			w.closeFn()
		}
		w.closeFnMu.Unlock()
		w.ccb()
	})
}

func (w *WSConn) WriteText(msg string) error {
	// TODO: Check closed
	w.write <- writep{
		MType:   websocket.TextMessage,
		Payload: []byte(msg),
	}
	return nil
}

func (w *WSConn) WriteBinary(msg []byte) error {
	// TODO: Check closed
	w.write <- writep{
		MType:   websocket.BinaryMessage,
		Payload: msg,
	}
	return nil
}

///////////////////////////////////////////////////////////////////////////////
// Items

type Item struct {
	ID   int
	Name string
	Icon string
}

var allItems []*Item = []*Item{
	{
		ID:   0,
		Name: "Unknown",
		Icon: "Unknown.png",
	},
	{
		ID:   1,
		Name: "Mammon",
		Icon: "HEGrenadeItemIcon.png",
	},
	{
		ID:   2,
		Name: "Loughcaster",
		Icon: "RifleW.png",
	},
	{
		ID:   3,
		Name: "Harpa",
		Icon: "GrenadeItemIcon.png",
	},
	{
		ID:   4,
		Name: "Sticky Grenade",
		Icon: "StickyBombIcon.png",
	},
	{
		ID:   5,
		Name: "Basic Materials",
		Icon: "BasicMaterialsIcon.png",
	},
	{
		ID:   6,
		Name: "Explosive Powder",
		Icon: "ExplosiveMaterialIcon.png",
	},
	{
		ID:   7,
		Name: "Heavy Explosive Powder",
		Icon: "HeavyExplosiveMaterialsIcon.png",
	},
	{
		ID:   8,
		Name: "Refined Materials",
		Icon: "RefinedMaterialsIcon.png",
	},
	{
		ID:   9,
		Name: "Bandages",
		Icon: "BandagesItemIcon.png",
	},
	{
		ID:   10,
		Name: "Blood Plasma",
		Icon: "BloodPlasmaItemIcon.png",
	},
	{
		ID:   11,
		Name: "First Aid Kit",
		Icon: "FirstAidKitItem.png",
	},
	{
		ID:   12,
		Name: "Trauma Kit",
		Icon: "TraumaKitItemIcon.png",
	},
	{
		ID:   13,
		Name: "7.62mm",
		Icon: "RifleAmmoItemIcon.png",
	},
	{
		ID:   14,
		Name: "40mm",
		Icon: "LightTankAmmoItemIcon.png",
	},
	{
		ID:   15,
		Name: "120mm",
		Icon: "LightArtilleryAmmoItemIcon.png",
	},
}

func getItem(id int) *Item {
	if id > 0 && id < len(allItems) {
		return allItems[id]
	}
	return allItems[0]
}
