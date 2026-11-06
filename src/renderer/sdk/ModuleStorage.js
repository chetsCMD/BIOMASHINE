export class ModuleStorage {
    constructor(client) {
        this.client = client;
    }

    list(collection) {
        return this.client.invoke('storage:list', { collection });
    }

    get(collection, id) {
        return this.client.invoke('storage:get', { collection, id });
    }

    async insert(collection, data) {
        const { id } = await this.client.invoke('storage:insert', { collection, data });
        return id;
    }

    update(collection, id, data) {
        return this.client.invoke('storage:update', { collection, id, data });
    }

    remove(collection, id) {
        return this.client.invoke('storage:remove', { collection, id });
    }

    async clear(collection) {
        const { removed } = await this.client.invoke('storage:clear', { collection });
        return removed;
    }
}
