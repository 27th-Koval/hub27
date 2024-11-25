import { ref } from 'vue'
import eventBus from './event_bus.js'
import PreviewOrder from './preview_order.js'

export default {
    components: {
        PreviewOrder,
    },
    methods: {
        onClick: function() {
            this.emitEvent('sendOnWs', {
                kind: "AddOrderRequest",
                payload: {
                    priority: 2,
                    itemId: 1,
                    quantity: 9,
                    location: "Brodytown",
                    method: "Factory",
                    creator: "Koval",
                },
            });
        },
    },
    setup(props) {
        const { emitEvent } = eventBus();
        var orders = ref([]);
        var selectedPriority = ref(null);
        var selectedItem = ref(null);
        var crateCount = ref(0);
        var selectedLocation = ref(null);
        var selectedMethod = ref(null);
        return {
            orders: orders,
            selectedPriority: selectedPriority,
            selectedItem: selectedItem,
            crateCount: crateCount,
            selectedLocation: selectedLocation,
            selectedMethod: selectedMethod,
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
            itemList: ref([
                {
                    id:   1,
                    name: "Mammon",
                    icon: "HEGrenadeItemIcon.png",
                },
                {
                    id:   2,
                    name: "Loughcaster",
                    icon: "RifleW.png",
                },
                {
                    id:   3,
                    name: "Harpa",
                    icon: "GrenadeItemIcon.png",
                },
                {
                    id:   4,
                    name: "Sticky Grenade",
                    icon: "StickyBombIcon.png",
                },
                {
                    id:   5,
                    name: "Basic Materials",
                    icon: "BasicMaterialsIcon.png",
                },
                {
                    id:   6,
                    name: "Explosive Powder",
                    icon: "ExplosiveMaterialIcon.png",
                },
                {
                    id:   7,
                    name: "Heavy Explosive Powder",
                    icon: "HeavyExplosiveMaterialsIcon.png",
                },
                {
                    id:   8,
                    name: "Refined Materials",
                    icon: "RefinedMaterialsIcon.png",
                },
                {
                    id:   9,
                    name: "Bandages",
                    icon: "BandagesItemIcon.png",
                },
                {
                    id:   10,
                    name: "Blood Plasma",
                    icon: "BloodPlasmaItemIcon.png",
                },
                {
                    id:   11,
                    name: "First Aid Kit",
                    icon: "FirstAidKitItem.png",
                },
                {
                    id:   12,
                    name: "Trauma Kit",
                    icon: "TraumaKitItemIcon.png",
                },
                {
                    id:   13,
                    name: "7.62mm",
                    icon: "RifleAmmoItemIcon.png",
                },
                {
                    id:   14,
                    name: "40mm",
                    icon: "LightTankAmmoItemIcon.png",
                },
                {
                    id:   15,
                    name: "120mm",
                    icon: "LightArtilleryAmmoItemIcon.png",
                },
            ]),
            locationList: ref([
                {
                    id: 1,
                    name: "Cuttail Station",
                },
                {
                    id: 2,
                    name: "Good Warden Dam",
                },
                {
                    id: 3,
                    name: "Brodytown",
                },
                {
                    id: 4,
                    name: "Kirkhell",
                },
            ]),
            methodList: ref([
                {
                    id: 1,
                    method: "Mass Production Factory",
                },
                {
                    id: 2,
                    method: "Factory",
                },
            ]),
            emitEvent: emitEvent,
        };
    },
    methods: {
        onClick: function() {
            this.orders.push({
                priority: this.selectedPriority,
                priorityName: this.priorityList[this.selectedPriority-1].name,
                itemID: this.itemList[this.selectedItem-1].id,
                itemIcon: this.itemList[this.selectedItem-1].icon,
                itemName: this.itemList[this.selectedItem-1].name,
                quantity: this.crateCount,
                location: this.locationList[this.selectedLocation-1].name,
                method: this.methodList[this.selectedMethod-1].method,
            });
            this.selectedPriority = null;
            this.selectedItem = null;
            this.crateCount = 0;
            this.selectedLocation = null;
            this.selectedMethod = null;
        },
    },
    template: `
    <div class="box">
        <h4 class="title is-4">Add Entry</h4>
        <form @submit.prevent>
            <div class="field">
                <label for="priority-select" class="label">Priority:</label>
                <div class="control select">
                    <select name="priority" id="priority-select" v-model="selectedPriority">
                        <option disabled value="">Please select one</option>
                        <template v-for="priority in priorityList" :key="priority.id">
                            <option :value="priority.id" :class="priority.color">
                                {{ priority.name }}
                            </option>
                        </template>
                    </select>
                </div>
            </div>
            <div class="field">
                <label for="item-select" class="label">Item:</label>
                <div class="select control">
                    <select name="item" id="item-select" v-model="selectedItem">
                        <option disabled value="">Please select one</option>
                        <template v-for="item in itemList" :key="item.id">
                            <option :value="item.id">
                                {{ item.name }}
                            </option>
                        </template>
                    </select>
                </div>
                <figure class="is-inline-block" v-if="selectedItem > 0">
                    <p class="image is-24x24 has-background-black"><img :src='\"/img/\" + itemList[selectedItem-1].icon' /></p>
                </figure>
            </div>
            <div class="field">
                <label for="crate-count" class="label">Crates:</label>
                <input id="crate-count" class="input control" type="number" v-model="crateCount" />
            </div>
            <div class="field">
                <label for="location-select" class="label">Location:</label>
                <div class="select control">
                    <select name="location" id="location-select" v-model="selectedLocation">
                        <option disabled value="">Please select one</option>
                        <template v-for="location in locationList" :key="location.id">
                            <option :value="location.id">
                                {{ location.name }}
                            </option>
                        </template>
                    </select>
                </div>
            </div>
            <div class="field">
                <label for="method-select" class="label">Method:</label>
                <div class="select control">
                    <select name="method" id="method-select" v-model="selectedMethod">
                        <option disabled value="">Please select one</option>
                        <template v-for="method in methodList" :key="method.id">
                            <option :value="method.id">
                                {{ method.method }}
                            </option>
                        </template>
                    </select>
                </div>
            </div>
            <div class="field">
                <div class="control">
                    <button class="button is-primary is-outlined" @click="onClick()">Add Row</button>
                </div>
            </div>
        </form>
    </div>
    <div class="box">
        <h4 class="title is-4">To Be Added</h4>
        <preview-order
            :orders="orders"
            :clearOrders="() => { orders = []; }"
            :selectedPriority="priorityList[selectedPriority-1]"
            :selectedItem="itemList[selectedItem-1]"
            :crateCount="crateCount"
            :selectedLocation="locationList[selectedLocation-1]"
            :selectedMethod="methodList[selectedMethod-1]">
        </preview-order>
    </div>`,
};