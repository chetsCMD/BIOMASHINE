export class WeightCalculator {
    constructor(config) {
        this.config = config;
    }

    fmt(v, d = 1) {
        if (v === null || v === undefined) return '—';
        return Number(v).toFixed(d);
    }

    formatDateToDisplay(dateStr) {
        if (!dateStr) return '—';
        let str = dateStr;
        if (str.includes('T')) {
            str = str.split('T')[0];
        }
        const parts = str.split('-');
        if (parts.length === 3) {
            return `${parts[2]}.${parts[1]}.${parts[0]}`;
        }
        return str;
    }

    formatDateToAPI(dateStr) {
        if (!dateStr) return null;
        const parts = dateStr.split('.');
        if (parts.length === 3) {
            const year = parts[2];
            const month = parts[1].padStart(2, '0');
            const day = parts[0].padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        if (dateStr.includes('-')) {
            return dateStr;
        }
        return null;
    }

    getTodayDateStr(clock) {
        const today = clock.today();
        const parts = today.split('-');
        return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }

    daysUntil(dateStr, clock) {
        if (!dateStr) return null;
        const now = clock.now();
        now.setHours(0, 0, 0, 0);
        const then = new Date(dateStr);
        then.setHours(0, 0, 0, 0);
        return Math.ceil((then - now) / 86400000);
    }

    calcBMI(w, h) {
        if (!w || !h) return 0;
        return w / Math.pow(h / 100, 2);
    }

    bmiLabel(bmi) {
        if (!bmi) return { labelKey: 'label.noData', q: 'bad' };
        const rule = this.config.bmi.find(r => r.max === null || bmi < r.max);
        return { labelKey: rule.labelKey, q: rule.quality };
    }

    fatLabel(fat, age) {
        if (!fat) return { labelKey: 'label.noData', q: 'bad' };
        const isTeen = age >= this.config.fat.teen.ageMin && age <= this.config.fat.teen.ageMax;
        const rules = isTeen ? this.config.fat.teen.thresholds : this.config.fat.adult.thresholds;
        const rule = rules.find(r => r.max === null || fat < r.max);
        return { labelKey: rule.labelKey, q: rule.quality };
    }

    waterLabel(w) {
        if (!w) return { labelKey: 'label.noData', q: 'bad' };
        for (const rule of this.config.water) {
            if (rule.type === 'exact' && w === rule.value) return { labelKey: rule.labelKey, q: rule.quality };
            if (rule.type === 'range' && w >= rule.min && w <= rule.max) return { labelKey: rule.labelKey, q: rule.quality };
            if (rule.type === 'lt' && w < rule.value) return { labelKey: rule.labelKey, q: rule.quality };
            if (rule.type === 'gt' && w > rule.value) return { labelKey: rule.labelKey, q: rule.quality };
        }
        return { labelKey: 'label.noData', q: 'bad' };
    }

    idealWeights(h) {
        if (!h) return [];
        const vals = {
            broca: h - 100,
            lorenz: (h - 100) - (h - 150) / 2,
            cooper: ((h / 2.54) * 4 - 128) / 2.2046,
            bmi22: 22 * Math.pow(h / 100, 2)
        };
        return this.config.idealWeights.map(item => ({
            ...item,
            val: vals[item.id]
        }));
    }
}