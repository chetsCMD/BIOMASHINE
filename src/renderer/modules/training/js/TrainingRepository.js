export class TrainingRepository {
    constructor(bm) {
        this.bm = bm;
    }

    list() {
        return this.bm.invoke('workouts:list');
    }

    listTemplates() {
        return this.bm.invoke('workouts:listTemplates');
    }

    getGoals() {
        return this.bm.invoke('workouts:getGoals');
    }

    create(payload) {
        return this.bm.invoke('workouts:create', payload);
    }

    update(id, payload) {
        return this.bm.invoke('workouts:update', { id, ...payload });
    }

    remove(id) {
        return this.bm.invoke('workouts:remove', { id });
    }

    createTemplate(payload) {
        return this.bm.invoke('workouts:createTemplate', payload);
    }

    removeTemplate(id) {
        return this.bm.invoke('workouts:removeTemplate', { id });
    }

    saveGoals(payload) {
        return this.bm.invoke('workouts:saveGoals', payload);
    }
}