class Values {
    static collator = new Intl.Collator('en');

    static setLocale(locale) {
        try {
            Values.collator = new Intl.Collator(locale || 'en');
        } catch {
            Values.collator = new Intl.Collator('en');
        }
    }

    static compare(a, b) {
        return Values.collator.compare(String(a), String(b));
    }

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
        return rows.sort((a, b) => Values.compare(a.name, b.name));
    }
}

module.exports = Values;