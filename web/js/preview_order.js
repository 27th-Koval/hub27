import { ref } from 'vue'
import eventBus from './event_bus.js'

export default {
    props: {
        orders: {
            type: Array,
            required: true,
        },
        clearOrders: {
            type: Function,
            required: true,
        },
        selectedPriority: {
            type: Object,
            required: false,
        },
        selectedItem: {
            type: Object,
            required: false,
        },
        crateCount: {
            type: Number,
            required: false,
        },
        selectedLocation: {
            type: Object,
            required: false,
        },
        selectedMethod: {
            type: Object,
            required: false,
        },
    },
    setup(props) {
        const { emitEvent } = eventBus();
        return {
            emitEvent: emitEvent,
            priorityList: ref([
                {
                    id: 1,
                    color: "has-background-danger-dark",
                    name: "Top",
                },
                {
                    id: 2,
                    color: "has-background-warning-dark",
                    name: "High",
                },
                {
                    id: 3,
                    color: "",
                    name: "Regular",
                },
                {
                    id: 4,
                    color: "has-background-info-dark",
                    name: "Low",
                },
                {
                    id: 5,
                    color: "has-background-grey-darker",
                    name: "Standing",
                },
            ]),
        };
    },
    methods: {
        onClickDelete: function(index) {
            this.orders.splice(index, 1);
        },
        onSubmit: function() {
            var newOrders = [];
            for (const order of this.orders) {
                newOrders.push({
                    priority: order.priority,
                    itemId: order.itemID,
                    quantity: order.quantity,
                    location: order.location,
                    method: order.method,
                    creator: "Koval",
                });
            }
            this.emitEvent('sendOnWs', {
                kind: "AddOrderRequest",
                payload: newOrders,
            });
            this.clearOrders();
        },
    },
    template: `
    <table id="preview-table" class="table is-striped is-hoverable is-fullwidth">
        <thead>
            <tr>
                <th class="has-text-centered">Priority</th>
                <th colspan ="2" class="has-text-centered">Item</th>
                <th class="has-text-centered">Crates</th>
                <th class="has-text-centered">Location</th>
                <th class="has-text-centered">Method</th>
                <th class="has-text-centered">Delete</th>
            </tr>
        </thead>
        <tbody>
            <tr v-for="(order, index) in orders">
                <td
                    class="has-text-centered"
                    :class="priorityList[order.priority-1].color"
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
                <td class="has-text-centered" style="vertical-align:middle;">
                    <button class="button is-small is-warning is-outlined" @click="onClickDelete(index)">Delete</button>
                </td>
            </tr>
            <tr class="has-background-primary-dark has-text-centered">
                <td>{{ selectedPriority == null ? "Not Yet Selected" : selectedPriority.name }}</td>
                <td>
                    <figure class="is-inline-block" style="vertical-align:middle;" v-if="selectedItem != null">
                        <p class="image is-24x24 has-background-black"><img :src='\"/img/\" + selectedItem.icon' /></p>
                    </figure>
                </td>
                <td>{{ selectedItem == null ? "Not Yet Selected" : selectedItem.name }}</td>
                <td>{{ crateCount }}</td>
                <td>{{ selectedLocation == null ? "Not Yet Selected" : selectedLocation.name }}</td>
                <td>{{ selectedMethod == null ? "Not Yet Selected" : selectedMethod.method }}</td>
            </tr>
        </tbody>
    </table>
    <button class="button is-danger" @click="onSubmit()">Add To Order Table</button>`,
};