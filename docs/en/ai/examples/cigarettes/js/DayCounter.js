export class DayCounter {
    static dayKey(date) {
        const pad = (value) => String(value).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }

    static lastDays(entries, days, today) {
        const counts = new Map();
        for (const entry of entries) {
            const key = DayCounter.dayKey(new Date(entry.data.at));
            counts.set(key, (counts.get(key) || 0) + 1);
        }
        const result = [];
        for (let offset = days - 1; offset >= 0; offset -= 1) {
            const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
            const key = DayCounter.dayKey(day);
            result.push({ key, count: counts.get(key) || 0 });
        }
        return result;
    }
}
