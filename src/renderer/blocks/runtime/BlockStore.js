export class BlockStore {
    static PREFIX = 'c-';

    constructor(bm) {
        this.bm = bm;
        this.handlers = new Map();
    }

    name(collection) {
        return `${BlockStore.PREFIX}${collection}`;
    }

    async list(collection) {
        const documents = await this.bm.storage.list(this.name(collection));
        return documents.map((document) => ({ ...document.data, id: document.id, createdAt: document.createdAt }));
    }

    async insert(collection, record) {
        const id = await this.bm.storage.insert(this.name(collection), record);
        this.notify(collection);
        return id;
    }

    async remove(collection, id) {
        await this.bm.storage.remove(this.name(collection), id);
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
