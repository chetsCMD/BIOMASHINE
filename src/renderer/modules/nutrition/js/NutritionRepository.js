export class NutritionRepository {
    constructor(bm) {
        this.bm = bm;
    }

    list() {
        return this.bm.invoke('nutrition:list');
    }

    add(payload) {
        return this.bm.invoke('nutrition:add', payload);
    }

    remove(id) {
        return this.bm.invoke('nutrition:remove', { id });
    }
}