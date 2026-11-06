class Dates {
    static day(value) {
        if (typeof value !== 'string') {
            return value;
        }
        return value.split('T')[0].split(' ')[0];
    }

    static time(value) {
        if (!value) {
            return null;
        }
        const parts = String(value).split(':');
        const hours = parts[0].padStart(2, '0');
        const minutes = (parts[1] || '00').padStart(2, '0');
        const seconds = (parts[2] || '00').slice(0, 2).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }

    static hoursMinutes(value) {
        return value ? Dates.time(value).slice(0, 5) : null;
    }

    static timestamp(value) {
        const normalized = String(value).replace('T', ' ');
        const [day, time] = normalized.split(' ');
        return `${day} ${Dates.time(time || '00:00:00')}`;
    }
}

module.exports = Dates;
