export class BlockBus {
    constructor() {
        this.values = new Map();
        this.handlers = new Set();
        this.registry = new Map();
    }

    publish(blockId, value) {
        this.values.set(blockId, value);
        this.handlers.forEach((handler) => handler(blockId, value));
    }

    value(blockId) {
        return this.values.get(blockId);
    }

    subscribe(handler) {
        this.handlers.add(handler);
        return () => this.handlers.delete(handler);
    }

    registerField(blockId, field) {
        this.registry.set(blockId, field);
    }

    unregister(blockId) {
        this.registry.delete(blockId);
        this.values.delete(blockId);
    }

    fields(form) {
        return [...this.registry.values()].filter((field) => field.form === form);
    }
}
