import { createApp } from 'vue'
import OrderTable from './order_table.js'
import WsController from './ws_controller.js'

const app = createApp({
}).component('WsController', WsController)
    .component('OrderTable', OrderTable)
    .mount("#order-table-div");
