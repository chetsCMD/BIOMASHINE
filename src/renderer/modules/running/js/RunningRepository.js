export class RunningRepository {
    constructor(bm) {
        this.bm = bm;
    }

    list() {
        return this.bm.invoke('running:list');
    }

    add(payload) {
        return this.bm.invoke('running:add', payload);
    }

    remove(id) {
        return this.bm.invoke('running:remove', { id });
    }

    getGoals() {
        return this.bm.invoke('running:getGoals');
    }

    saveGoal(goal_type, target, deadline) {
        return this.bm.invoke('running:saveGoal', { goal_type, target, deadline });
    }
}