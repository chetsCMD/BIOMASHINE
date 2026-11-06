export class WeightStats {
    periodChange(months, measurements) {
        if (measurements.length < 2) return null;
        const sorted = [...measurements].sort((a, b) => new Date(a.date) - new Date(b.date));
        const latest = sorted[sorted.length - 1];
        const latestD = new Date(latest.date);
        const ref = new Date(latestD);
        ref.setMonth(ref.getMonth() - months);

        let closest = null;
        let minD = Infinity;
        const rangeEntries = [];
        for (const d of sorted) {
            const dDate = new Date(d.date);
            if (dDate >= ref && dDate <= latestD) rangeEntries.push(d);
            const dd = Math.abs(dDate - ref);
            if (dd < minD && d.date !== latest.date) {
                minD = dd;
                closest = d;
            }
        }
        if (!closest) return null;

        let avgWeight = closest.weight;
        let avgFat = closest.fat || 0;
        let avgWater = closest.water || 0;

        if (rangeEntries.length > 0) {
            avgWeight = rangeEntries.reduce((s, e) => s + e.weight, 0) / rangeEntries.length;
            const fatEntries = rangeEntries.filter(e => e.fat !== null && e.fat !== undefined);
            if (fatEntries.length > 0) avgFat = fatEntries.reduce((s, e) => s + e.fat, 0) / fatEntries.length;
            const waterEntries = rangeEntries.filter(e => e.water !== null && e.water !== undefined);
            if (waterEntries.length > 0) avgWater = waterEntries.reduce((s, e) => s + e.water, 0) / waterEntries.length;
        }

        return {
            dWeight: (latest.weight - closest.weight).toFixed(1),
            dFat: latest.fat && closest.fat ? (latest.fat - closest.fat).toFixed(1) : null,
            dWater: latest.water && closest.water ? (latest.water - closest.water).toFixed(1) : null,
            avgWeight: avgWeight.toFixed(1),
            avgFat: avgFat.toFixed(1),
            avgWater: avgWater.toFixed(1),
            from: closest.date,
        };
    }

    rangeChange(fromDate, toDate, measurements) {
        const fd = fromDate;
        const td = toDate;
        const inRange = measurements.filter(d => d.date >= fd && d.date <= td);
        if (inRange.length < 2) return null;
        inRange.sort((a, b) => new Date(a.date) - new Date(b.date));
        const f = inRange[0];
        const t = inRange[inRange.length - 1];
        
        const avgWeight = inRange.reduce((s, e) => s + e.weight, 0) / inRange.length;
        const fatEntries = inRange.filter(e => e.fat !== null && e.fat !== undefined);
        const avgFat = fatEntries.length > 0 ? fatEntries.reduce((s, e) => s + e.fat, 0) / fatEntries.length : 0;
        const waterEntries = inRange.filter(e => e.water !== null && e.water !== undefined);
        const avgWater = waterEntries.length > 0 ? waterEntries.reduce((s, e) => s + e.water, 0) / waterEntries.length : 0;

        return {
            dWeight: (t.weight - f.weight).toFixed(1),
            dFat: t.fat && f.fat ? (t.fat - f.fat).toFixed(1) : null,
            dWater: t.water && f.water ? (t.water - f.water).toFixed(1) : null,
            avgWeight: avgWeight.toFixed(1),
            avgFat: avgFat.toFixed(1),
            avgWater: avgWater.toFixed(1),
            from: f.date,
            to: t.date,
        };
    }
}