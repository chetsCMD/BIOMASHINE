export class WeightRepository {
    constructor(bm) {
        this.bm = bm;
    }

    overview() {
        return this.bm.invoke('profile:overview');
    }

    saveMeasurement(payload) {
        return this.bm.invoke('measurements:save', payload);
    }

    removeMeasurement(date) {
        return this.bm.invoke('measurements:remove', { date });
    }

    saveGoals(payload) {
        return this.bm.invoke('measurements:saveGoals', payload);
    }
}