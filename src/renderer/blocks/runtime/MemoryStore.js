export class MemoryStore {
    constructor(bm) {
        this.bm = bm;
        this.records = new Map();
        this.counter = 0;
        this.handlers = new Map();
    }

    async list(collection) {
        return [...(this.records.get(collection) || [])];
    }

    async insert(collection, record) {
        this.counter += 1;
        const list = this.records.get(collection) || [];
        list.push({ ...record, id: this.counter, createdAt: this.bm.clock.timestamp() });
        this.records.set(collection, list);
        this.notify(collection);
        return this.counter;
    }

    async remove(collection, id) {
        this.records.set(collection, (this.records.get(collection) || []).filter((record) => record.id !== id));
        this.notify(collection);
    }

    onChange(collection, handler) {
        const set = this.handlers.get(collection) || new Set();
        set.add(handler);
        this.handlers.set(collection, set);
        return () => set.delete(handler);
    }

    notify(collection) {
        (this.handlers.get(collection) || []).forEach((handler) => handler());
    }
}
