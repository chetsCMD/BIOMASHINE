export class BlockMath {
    static PERIOD_DAYS = { '7d': 7, '30d': 30 };

    static pad(number) {
        return String(number).padStart(2, '0');
    }

    static periodStart(clock, period) {
        if (period === 'today') {
            return clock.today();
        }
        const days = BlockMath.PERIOD_DAYS[period];
        if (!days) {
            return null;
        }
        const date = clock.now();
        date.setDate(date.getDate() - (days - 1));
        return `${date.getFullYear()}-${BlockMath.pad(date.getMonth() + 1)}-${BlockMath.pad(date.getDate())}`;
    }

    static filter(records, start) {
        return start ? records.filter((record) => String(record.createdAt).slice(0, 10) >= start) : records;
    }

    static aggregate(records, field, op) {
        if (op === 'count') {
            return records.length;
        }
        const values = records.map((record) => Number(record[field])).filter((value) => Number.isFinite(value));
        if (values.length === 0) {
            return 0;
        }
        const sum = values.reduce((total, value) => total + value, 0);
        const table = { sum, avg: sum / values.length, min: Math.min(...values), max: Math.max(...values), last: values[values.length - 1] };
        return table[op] === undefined ? 0 : table[op];
    }

    static round(value) {
        return Math.round(value * 100) / 100;
    }
}
