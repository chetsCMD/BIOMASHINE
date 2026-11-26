export class KeyRecorder {
    static MODIFIER = /^(Control|Shift|Alt|Meta|OS)(Left|Right)$/;

    constructor(doc) {
        this.doc = doc;
        this.handler = null;
        this.callback = null;
    }

    start(callback) {
        this.stop();
        this.callback = callback;
        this.handler = (event) => this.onKey(event);
        this.doc.addEventListener('keydown', this.handler, true);
    }

    stop() {
        if (this.handler) {
            this.doc.removeEventListener('keydown', this.handler, true);
        }
        this.handler = null;
        this.callback = null;
    }

    onKey(event) {
        event.preventDefault();
        event.stopPropagation();
        if (!event.code || KeyRecorder.MODIFIER.test(event.code)) {
            return;
        }
        const callback = this.callback;
        this.stop();
        if (event.code === 'Escape') {
            callback(null);
            return;
        }
        callback({ code: event.code, ctrlOrMeta: Boolean(event.ctrlKey || event.metaKey), shift: Boolean(event.shiftKey), alt: Boolean(event.altKey) });
    }
}
