import { ref, watch } from 'vue'

const bus = ref(new Map());

export default function eventBus() {
    function emitEvent(name, ...args) {
        bus.value.set(name, args);
    };
    function watchEvent(name, callback) {
        watch(
            () => bus.value.get(name),
            (val) => {
                callback(val);
            });
    };
    return { emitEvent, watchEvent };
};