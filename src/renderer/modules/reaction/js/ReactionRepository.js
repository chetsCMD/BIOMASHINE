export class ReactionRepository {
    constructor(bm) {
        this.bm = bm;
    }

    async list() {
        const rows = await this.bm.invoke('reaction:list');
        return rows.map((row) => ({ ...row, average: Number(row.average) }));
    }

    add(values, average) {
        return this.bm.invoke('reaction:add', { values, average });
    }

    remove(id) {
        return this.bm.invoke('reaction:remove', { id });
    }
}
