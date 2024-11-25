import { ref } from 'vue'
import eventBus from './event_bus.js'

export default {
    methods: {
        onClick: function(id) {
            const toRemove = this.quantity[id];
            if (toRemove === 0) {
                return;
            }
            this.quantity[id] = 0;
            this.emitEvent('sendOnWs', {
                kind: "UpdateOrderRequest",
                payload: {
                    id: id,
                    qtyRemove: toRemove,
                },
            });
        },
    },
    setup(props) {
        const { emitEvent } = eventBus();
        return {
            orders: ref(new Map()),
            quantity: ref({}),
            priorityColor: ref({}),
            emitEvent: emitEvent,
        }
    },
    created() {
        const self = this;
        const { watchEvent } = eventBus();
        watchEvent('orders', function(val) {
            var [orders] = val ?? [];
            if (orders === null) {
                orders = [];
            }
            self.orders = orders;
            // Quantity update: preserves unsubmitted crate count state in user's browser
            var updatedQtyMap = {};
            for (const order of orders) {
                if (Object.hasOwn(self.quantity, order.id)) {
                    updatedQtyMap[order.id] = self.quantity[order.id];
                } else {
                    updatedQtyMap[order.id] = 0;
                }
            }
            self.quantity = updatedQtyMap;
            // Priority update: updates the coloring of the priority cells
            var updatedPriorityMap = {};
            for (const order of orders) {
                if (order.priority == 1) {
                    updatedPriorityMap[order.id] = "has-background-danger-dark";
                } else if (order.priority == 2) {
                    updatedPriorityMap[order.id] = "has-background-warning-dark";
                } else if (order.priority == 3) {
                    updatedPriorityMap[order.id] = ""; // default color
                } else if (order.priority == 4) {
                    updatedPriorityMap[order.id] = "has-background-info-dark";
                } else if (order.priority == 5) {
                    updatedPriorityMap[order.id] = "has-background-grey-darker";
                } else {
                    updatedPriorityMap[order.id] = "has-background-grey";
                }
            }
            self.priorityColor = updatedPriorityMap;
        });
    },
    template: `
    <table id="order-table" class="table is-striped is-hoverable is-fullwidth">
        <thead>
            <tr>
                <th class="has-text-centered">Priority</th>
                <th colspan ="2" class="has-text-centered">Item</th>
                <th class="has-text-centered">Crates</th>
                <th class="has-text-centered">Location</th>
                <th class="has-text-centered">Method</th>
                <th class="has-text-centered">Creator</th>
                <th class="has-text-centered">Your Crates</th>
                <th class="has-text-centered">Submit</th>
            </tr>
        </thead>
        <tbody>
            <tr v-for="order in orders" :key="order.id">
                <td
                    class="has-text-centered"
                    :class="priorityColor[order.id]"
                    style="vertical-align:middle;">
                    {{ order.priorityName }}
                </td>
                <td class="has-text-centered">
                    <figure class="is-inline-block" style="vertical-align:middle;">
                        <p class="image is-24x24 has-background-black"><img :src='\"/img/\" + order.itemIcon' /></p>
                    </figure>
                </td>
                <td style="vertical-align:middle;">
                    {{ order.itemName }}
                </td>
                <td class="has-text-centered" style="vertical-align:middle;">{{ order.quantity }}</td>
                <td class="has-text-centered" style="vertical-align:middle;">{{ order.location }}</td>
                <td class="has-text-centered" style="vertical-align:middle;">{{ order.method }}</td>
                <td class="has-text-centered" style="vertical-align:middle;">{{ order.creator }}</td>
                <td class="has-text-centered" style="max-width: 100px; vertical-align:middle;">
                    <input class="input is-small is-primary" type="number" v-model="quantity[order.id]" />
                </td>
                <td class="has-text-centered" style="vertical-align:middle;">
                    <button class="button is-small is-primary is-outlined" @click="onClick(order.id)">Submit</button>
                </td>
            </tr>
        </tbody>
    </table>`,
};