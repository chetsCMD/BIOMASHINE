export class TrainingViewBase {
    constructor(doc, t) {
        this.doc = doc;
        this.t = t;
        this.statusTimers = {};
    }

    byId(id) {
        return this.doc.getElementById(id);
    }

    el(tag, className, text) {
        const node = this.doc.createElement(tag);
        if (className) {
            node.className = className;
        }
        if (text !== undefined) {
            node.textContent = text;
        }
        return node;
    }

    setStatus(elementId, kind, text, hideAfterMs) {
        const box = this.byId(elementId);
        box.className = `status-box ${kind} visible`;
        box.textContent = text;
        clearTimeout(this.statusTimers[elementId]);
        this.statusTimers[elementId] = setTimeout(() => {
            box.className = 'status-box';
        }, hideAfterMs);
    }
}