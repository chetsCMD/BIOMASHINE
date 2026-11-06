export class SleepClock {
    constructor(bm) {
        this.bm = bm;
    }

    now() {
        return this.bm.clock.now();
    }

    today() {
        return this.bm.clock.today();
    }

    todayMidnight() {
        const now = this.now();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
}