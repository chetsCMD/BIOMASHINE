export class ModuleClock {
    constructor(bm) {
        this.bm = bm;
    }

    now() {
        return this.bm.clock.now();
    }

    pad(value) {
        return String(value).padStart(2, '0');
    }

    formatYmd(date) {
        return `${date.getFullYear()}-${this.pad(date.getMonth() + 1)}-${this.pad(date.getDate())}`;
    }

    today() {
        return this.bm.clock.today();
    }

    currentWeek() {
        const now = this.now();
        const year = now.getFullYear();
        const month = now.getMonth();
        const day = now.getDate();
        const base = new Date(Date.UTC(year, month, day));
        let dow = base.getUTCDay();
        if (dow === 0) dow = 7;
        const mondayTime = base.getTime() - (dow - 1) * 86400000;
        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(mondayTime + i * 86400000);
            days.push({
                dateStr: `${d.getUTCFullYear()}-${this.pad(d.getUTCMonth() + 1)}-${this.pad(d.getUTCDate())}`,
                dayNumber: d.getUTCDate()
            });
        }
        return days;
    }
}