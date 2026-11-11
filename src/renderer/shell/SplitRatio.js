export class SplitRatio {
    constructor(config) {
        this.min = config.minRatio;
        this.max = config.maxRatio;
        this.default = config.defaultRatio;
    }

    clamp(ratio) {
        if (!Number.isFinite(ratio)) {
            return this.default;
        }
        return Math.min(this.max, Math.max(this.min, ratio));
    }

    fromDelta(startRatio, deltaX, width) {
        if (!Number.isFinite(width) || width <= 0) {
            return this.clamp(startRatio);
        }
        return this.clamp(startRatio + deltaX / width);
    }

    toPercent(ratio) {
        return `${(this.clamp(ratio) * 100).toFixed(4)}%`;
    }
}
