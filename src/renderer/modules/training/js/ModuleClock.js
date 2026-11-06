export class ModuleClock {
    constructor(bm) {
        this.bm = bm;
    }

    now() {
        return this.bm.clock.now();
    }

    today() {
        return this.bm.clock.today();
    }

    month() {
        return this.now().getMonth();
    }

    year() {
        return this.now().getFullYear();
    }
}