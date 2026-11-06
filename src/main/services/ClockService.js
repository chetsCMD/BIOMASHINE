class ClockService {
    static SYSTEM = 'system';

    constructor(settings, now = () => new Date(), aliases = {}) {
        this.settings = settings;
        this.now = now;
        this.aliases = aliases;
        this.formatters = new Map();
        this.zoneList = null;
        this.zone = ClockService.SYSTEM;
        this.reload();
    }

    constructible(id) {
        try {
            new Intl.DateTimeFormat('en', { timeZone: id });
            return true;
        } catch (error) {
            return false;
        }
    }

    zones() {
        if (!this.zoneList) {
            const modern = (id) => (this.aliases[id] && this.constructible(this.aliases[id]) ? this.aliases[id] : id);
            this.zoneList = [...new Set(['UTC', ...Intl.supportedValuesOf('timeZone').map(modern), ...Object.values(this.aliases).filter((id) => this.constructible(id))])].sort();
        }
        return this.zoneList;
    }

    isValid(id) {
        return typeof id === 'string' && (id === ClockService.SYSTEM || this.constructible(id));
    }

    reload() {
        const stored = this.settings.get('timezone');
        this.zone = this.isValid(stored) ? stored : ClockService.SYSTEM;
    }

    selected() {
        return this.zone;
    }

    systemZone() {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    }

    effective() {
        const selected = this.selected();
        return selected === ClockService.SYSTEM ? this.systemZone() : selected;
    }

    formatter(zone) {
        if (!this.formatters.has(zone)) {
            this.formatters.set(
                zone,
                new Intl.DateTimeFormat('sv-SE', {
                    timeZone: zone,
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hourCycle: 'h23'
                })
            );
        }
        return this.formatters.get(zone);
    }

    format(date, zone) {
        return this.formatter(zone).format(date);
    }

    timestamp() {
        return this.format(this.now(), this.effective());
    }

    today() {
        return this.timestamp().slice(0, 10);
    }

    offset(zone, date) {
        const part = new Intl.DateTimeFormat('en', { timeZone: zone, timeZoneName: 'shortOffset' })
            .formatToParts(date)
            .find((item) => item.type === 'timeZoneName');
        const value = part ? part.value.replace('GMT', 'UTC') : 'UTC';
        return value === 'UTC' ? 'UTC+0' : value;
    }

    zonesInfo() {
        const date = this.now();
        return this.zones().map((id) => ({ id, offset: this.offset(id, date) }));
    }

    describe() {
        return {
            timezone: this.selected(),
            effective: this.effective(),
            offset: this.offset(this.effective(), this.now()),
            system: { zone: this.systemZone(), offset: this.offset(this.systemZone(), this.now()) },
            timestamp: this.timestamp(),
            today: this.today()
        };
    }
}

module.exports = ClockService;
