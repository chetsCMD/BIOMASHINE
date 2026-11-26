export class BuilderRepository {
    constructor(bm) {
        this.bm = bm;
    }

    blocks() {
        return this.bm.invoke('blocks:list');
    }

    openBlocksFolder() {
        return this.bm.invoke('blocks:openFolder');
    }

    rescanBlocks() {
        return this.bm.invoke('blocks:rescan');
    }

    list() {
        return this.bm.invoke('builder:list');
    }

    load(id) {
        return this.bm.invoke('builder:load', { id });
    }

    save(payload) {
        return this.bm.invoke('builder:save', payload);
    }

    remove(id) {
        return this.bm.invoke('builder:remove', { id });
    }

    exportBundle(id) {
        return this.bm.invoke('builder:export', { id });
    }

    inspect(data) {
        return this.bm.invoke('builder:inspect', { data });
    }

    importBundle(data) {
        return this.bm.invoke('builder:import', { data });
    }
}
