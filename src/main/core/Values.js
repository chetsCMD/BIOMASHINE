class Values {
    static orNull(value) {
        return value === undefined || value === null || value === '' ? null : value;
    }

    static orZero(value) {
        const number = Number(value);
        return Number.isFinite(number) ? number : 0;
    }

    static money(value) {
        return Math.round(Number(value) * 100) / 100;
    }

    static bool(value) {
        return value === true || value === 1 || value === '1' || value === 'true';
    }

    static json(value) {
        if (value === null || value === undefined) {
            return null;
        }
        return typeof value === 'string' ? JSON.parse(value) : value;
    }

    static byName(rows) {
        return rows.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    }
}

module.exports = Values;
