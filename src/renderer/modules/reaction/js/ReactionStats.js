export class ReactionStats {
    static summarize(averages) {
        const values = averages.filter((value) => !Number.isNaN(value));
        if (values.length === 0) {
            return null;
        }
        const sorted = [...values].sort((a, b) => a - b);
        const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
        const middle = Math.floor(sorted.length / 2);
        const median = sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
        const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
        return {
            best: sorted[0],
            worst: sorted[sorted.length - 1],
            mean,
            median,
            deviation: Math.sqrt(variance)
        };
    }

    static histogram(averages, maxBins) {
        const values = averages.filter((value) => !Number.isNaN(value));
        if (values.length === 0) {
            return null;
        }
        const min = Math.min(...values);
        const range = Math.max(...values) - min;
        if (range === 0) {
            return null;
        }
        const binCount = Math.min(maxBins, values.length);
        const size = range / binCount;
        const counts = new Array(binCount).fill(0);
        for (const value of values) {
            counts[Math.min(Math.floor((value - min) / size), binCount - 1)] += 1;
        }
        const labels = counts.map((_, index) => `${Math.round(min + index * size)}-${Math.round(min + (index + 1) * size)}`);
        return { labels, counts };
    }

    static average(values) {
        return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
    }
}
