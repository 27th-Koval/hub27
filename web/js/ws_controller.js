import eventBus from './event_bus.js'

export default {
    props: {
        // URL endpoint to connect the websocket to
        wsUrl: { type: String, required: true },
    },
    setup(props) {
        const { emitEvent, watchEvent } = eventBus();
        return {
            url: props.wsUrl,
            socket: null,
            emitEvent: emitEvent,
            watchEvent: watchEvent,
        };
    },
    created() {
        var self = this;
        this.socket = new WebSocket(this.url);
        this.socket.addEventListener("open", function(event) {
            self.socket.send(JSON.stringify({
                kind: "GetOrdersRequest",
                payload: {},
            }));
        });
        this.socket.addEventListener("message", function(event) {
            console.log("Received: ", event.data);
            self.emitEvent('orders', JSON.parse(event.data).payload.orders);
        });
        this.socket.addEventListener("error", function(event) {
            console.log("Error: ", event.data);
        });
        this.socket.addEventListener("close", function(event) {
            console.log("Closed: ", event.data);
        });
        this.watchEvent('sendOnWs', function(val) {
            const [value] = val ?? [{}];
            self.socket.send(JSON.stringify(value));
        });
    },
    template: `<span></span>`,
};