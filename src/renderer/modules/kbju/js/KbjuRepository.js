export class KbjuRepository {
    constructor(bm) {
        this.bm = bm;
    }

    overview() {
        return this.bm.invoke('profile:overview');
    }

    saveParams({ height, age, trainings }) {
        return this.bm.invoke('profile:updateParams', { height, age, trainings_count: trainings });
    }
}
