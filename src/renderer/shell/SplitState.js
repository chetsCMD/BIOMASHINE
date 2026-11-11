export class SplitState {
    constructor() {
        this.primaryId = null;
        this.secondaryId = null;
    }

    get isSplit() {
        return Boolean(this.primaryId && this.secondaryId);
    }

    open(id) {
        this.primaryId = id;
        this.secondaryId = null;
    }

    openSplit(id) {
        if (!this.primaryId || this.primaryId === id) {
            return false;
        }
        this.secondaryId = id;
        return true;
    }

    closeRight() {
        const removed = this.secondaryId;
        this.secondaryId = null;
        return removed;
    }

    closeLeft() {
        if (!this.isSplit) {
            return null;
        }
        const next = this.secondaryId;
        this.primaryId = next;
        this.secondaryId = null;
        return next;
    }

    reset() {
        this.primaryId = null;
        this.secondaryId = null;
    }
}
