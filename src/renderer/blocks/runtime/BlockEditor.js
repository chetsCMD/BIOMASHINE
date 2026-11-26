import { CanvasGeometry } from '../../sdk/CanvasGeometry.js';

export class BlockEditor {
    static HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

    constructor({ canvas, doc, win, limits, layoutOf, onSelect, onLayout, onDelete }) {
        this.canvas = canvas;
        this.doc = doc;
        this.win = win;
        this.limits = limits;
        this.layoutOf = layoutOf;
        this.onSelect = onSelect;
        this.onLayout = onLayout;
        this.onDelete = onDelete;
        this.selected = null;
        this.gesture = null;
        this.listeners = [];
    }

    listen(target, name, handler) {
        target.addEventListener(name, handler);
        this.listeners.push([target, name, handler]);
    }

    enable() {
        this.listen(this.canvas, 'pointerdown', (event) => this.down(event));
        this.listen(this.win, 'pointermove', (event) => this.move(event));
        this.listen(this.win, 'pointerup', () => this.up());
        this.listen(this.doc, 'keydown', (event) => this.key(event));
    }

    disable() {
        this.listeners.forEach(([target, name, handler]) => target.removeEventListener(name, handler));
        this.listeners = [];
    }

    width() {
        return this.canvas.offsetWidth || this.canvas.getBoundingClientRect().width;
    }

    scale() {
        const width = this.canvas.offsetWidth;
        return width ? this.canvas.getBoundingClientRect().width / width : 1;
    }

    bounds() {
        return { width: this.width() };
    }

    wrapper(id) {
        return [...this.canvas.children].find((element) => element.getAttribute('data-bmb-id') === id) || null;
    }

    select(id) {
        this.selected = id;
        for (const element of [...this.canvas.children]) {
            const active = element.getAttribute('data-bmb-id') === id;
            element.classList.toggle('bmb-selected', active);
            element.querySelectorAll('.bmb-handle').forEach((handle) => handle.remove());
            if (active) {
                for (const name of BlockEditor.HANDLES) {
                    const handle = this.doc.createElement('div');
                    handle.className = 'bmb-handle';
                    handle.setAttribute('data-handle', name);
                    element.append(handle);
                }
            }
        }
        this.onSelect(id);
    }

    down(event) {
        const handle = event.target.closest ? event.target.closest('.bmb-handle') : null;
        const block = event.target.closest ? event.target.closest('.bmb-block') : null;
        if (!block) {
            this.select(null);
            return;
        }
        event.preventDefault();
        const id = block.getAttribute('data-bmb-id');
        if (this.selected !== id) {
            this.select(id);
        }
        const rect = CanvasGeometry.fromLayout(this.layoutOf(id), this.width());
        this.gesture = { id, handle: handle ? handle.getAttribute('data-handle') : null, x: event.clientX, y: event.clientY, rect };
    }

    apply(rect, commit) {
        const layout = CanvasGeometry.toLayout(rect, this.width(), this.limits.precision);
        this.onLayout(this.gesture.id, layout, commit);
    }

    move(event) {
        const gesture = this.gesture;
        if (!gesture) {
            return;
        }
        const scale = this.scale();
        const dx = (event.clientX - gesture.x) / scale;
        const dy = (event.clientY - gesture.y) / scale;
        const snap = !event.shiftKey;
        const rect = gesture.handle
            ? CanvasGeometry.resize(gesture.rect, gesture.handle, dx, dy, this.bounds(), this.limits, snap)
            : CanvasGeometry.move(gesture.rect, dx, dy, this.bounds(), this.limits, snap);
        this.apply(rect, false);
    }

    up() {
        if (this.gesture) {
            const rect = CanvasGeometry.fromLayout(this.layoutOf(this.gesture.id), this.width());
            this.apply(rect, true);
            this.gesture = null;
        }
    }

    key(event) {
        if (!this.selected || (event.target && event.target.closest && event.target.closest('input, textarea, select'))) {
            return;
        }
        if (event.key === 'Delete' || event.key === 'Backspace') {
            event.preventDefault();
            this.onDelete(this.selected);
        } else if (event.key.startsWith('Arrow')) {
            event.preventDefault();
            const rect = CanvasGeometry.nudge(CanvasGeometry.fromLayout(this.layoutOf(this.selected), this.width()), event.key, this.bounds(), this.limits, event.shiftKey);
            this.gesture = { id: this.selected };
            this.apply(rect, true);
            this.gesture = null;
        }
    }
}
