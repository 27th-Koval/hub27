import { createApp } from 'vue'
import NewOrderForm from './new_order_form.js'
import WsController from './ws_controller.js'

const app = createApp({
}).component('WsController', WsController)
    .component('NewOrderForm', NewOrderForm)
    .mount("#new-order-div");
