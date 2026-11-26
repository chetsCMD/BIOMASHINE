export class CanvasHistory {
    constructor(limit) {
        this.limit = limit;
        this.past = [];
        this.future = [];
        this.current = null;
    }

    static copy(state) {
        return JSON.parse(JSON.stringify(state));
    }

    reset(state) {
        this.current = CanvasHistory.copy(state);
        this.past = [];
        this.future = [];
    }

    push(state) {
        if (JSON.stringify(state) === JSON.stringify(this.current)) {
            return false;
        }
        this.past.push(this.current);
        if (this.past.length > this.limit) {
            this.past.shift();
        }
        this.current = CanvasHistory.copy(state);
        this.future = [];
        return true;
    }

    undo() {
        if (this.past.length === 0) {
            return null;
        }
        this.future.push(this.current);
        this.current = this.past.pop();
        return CanvasHistory.copy(this.current);
    }

    redo() {
        if (this.future.length === 0) {
            return null;
        }
        this.past.push(this.current);
        this.current = this.future.pop();
        return CanvasHistory.copy(this.current);
    }

    get canUndo() {
        return this.past.length > 0;
    }

    get canRedo() {
        return this.future.length > 0;
    }
}
