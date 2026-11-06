export class BmClock {
    static SYSTEM = 'system';

    constructor(timezone = BmClock.SYSTEM, source = () => new Date()) {
        this.source = source;
        this.timezone = BmClock.SYSTEM;
        this.formatter = BmClock.formatterFor(undefined);
        if (timezone !== BmClock.SYSTEM) {
            try {
                this.formatter = BmClock.formatterFor(timezone);
                this.timezone = timezone;
            } catch (error) {
                this.timezone = BmClock.SYSTEM;
            }
        }
    }

    static formatterFor(zone) {
        return new Intl.DateTimeFormat('sv-SE', {
            timeZone: zone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23'
        });
    }

    timestamp() {
        return this.formatter.format(this.source());
    }

    today() {
        return this.timestamp().slice(0, 10);
    }

    now() {
        const [day, time] = this.timestamp().split(' ');
        const [year, month, date] = day.split('-').map(Number);
        const [hours, minutes, seconds] = time.split(':').map(Number);
        return new Date(year, month - 1, date, hours, minutes, seconds, this.source().getMilliseconds());
    }
}
