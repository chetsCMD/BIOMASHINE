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

    todayDisplay() {
        const parts = this.today().split('-');
        return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }

    parseDate(str) {
        const text = String(str);
        const dots = text.split('.');
        if (dots.length === 3) {
            return new Date(parseInt(dots[2], 10), parseInt(dots[1], 10) - 1, parseInt(dots[0], 10));
        }
        const iso = text.split('T')[0].split('-');
        if (iso.length === 3) {
            return new Date(parseInt(iso[0], 10), parseInt(iso[1], 10) - 1, parseInt(iso[2], 10));
        }
        return this.now();
    }

    formatDisplay(isoDate) {
        if (!isoDate) {
            return '';
        }
        const iso = String(isoDate).split('T')[0].split('-');
        if (iso.length === 3) {
            return `${iso[2]}.${iso[1]}.${iso[0]}`;
        }
        return String(isoDate);
    }

    formatApi(displayDate) {
        const dots = String(displayDate).split('.');
        if (dots.length === 3) {
            return `${dots[2]}-${dots[1]}-${dots[0]}`;
        }
        return String(displayDate);
    }

    formatDateObject(dateObj) {
        const pad = (value) => String(value).padStart(2, '0');
        return `${pad(dateObj.getDate())}.${pad(dateObj.getMonth() + 1)}.${dateObj.getFullYear()}`;
    }

    getWeekRange(offset) {
        const now = this.now();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let dayOfWeek = today.getDay();
        if (dayOfWeek === 0) {
            dayOfWeek = 7;
        }
        const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOfWeek + 1 + offset * 7);
        const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
        return { monday, sunday };
    }

    getWeekDays(monday) {
        const days = [];
        for (let i = 0; i < 7; i++) {
            const day = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
            days.push({
                date: day,
                dateStr: this.formatDateObject(day),
                dayNumber: day.getDate(),
                dayName: day.toLocaleDateString(this.bm.locale, { weekday: 'short' }).toUpperCase()
            });
        }
        return days;
    }

    weekOffsetForDate(dateStr) {
        const target = this.parseDate(dateStr);
        const now = this.now();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let dayOfWeek = today.getDay();
        if (dayOfWeek === 0) {
            dayOfWeek = 7;
        }
        const currentMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOfWeek + 1);
        const diffDays = Math.floor((target - currentMonday) / (1000 * 60 * 60 * 24));
        return Math.floor(diffDays / 7);
    }
}