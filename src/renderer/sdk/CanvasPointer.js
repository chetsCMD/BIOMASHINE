import { CanvasGeometry } from './CanvasGeometry.js';

export class CanvasPointer {
    constructor({ win, engine, overlay }) {
        this.win = win;
        this.engine = engine;
        this.overlay = overlay;
        this.gesture = null;
        this.listeners = [];
    }

    listen(name, handler) {
        const safe = (event) => {
            try {
                handler(event);
            } catch (error) {
                this.engine.log(`${name}: ${error.message}`);
            }
        };
        this.win.addEventListener(name, safe, true);
        this.listeners.push([name, safe]);
    }

    enable() {
        if (this.listeners.length > 0) {
            return;
        }
        this.overlay.mount();
        for (const name of this.engine.config.swallowedEvents) {
            if (name === 'pointerdown') this.listen(name, (event) => this.down(event));
            else if (name === 'pointerup') this.listen(name, (event) => this.up(event));
            else if (name === 'dblclick') this.listen(name, (event) => this.double(event));
            else this.listen(name, (event) => this.swallow(event));
        }
        this.listen('pointermove', (event) => this.move(event));
        this.listen('keydown', (event) => this.key(event));
        this.listen('scroll', () => this.overlay.update(null));
        this.listen('resize', () => this.overlay.update(null));
    }

    disable() {
        for (const [name, handler] of this.listeners) {
            this.win.removeEventListener(name, handler, true);
        }
        this.listeners = [];
        this.gesture = null;
        this.overlay.unmount();
    }

    protected(target) {
        return Boolean(target && target.closest && this.engine.config.protectedSelectors.some((selector) => target.closest(selector)));
    }

    editingTarget(event) {
        return Boolean(this.engine.editing && this.engine.editing.contains(event.target));
    }

    double(event) {
        if (this.protected(event.target) || this.editingTarget(event)) {
            return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        const element = this.engine.pick(event.clientX, event.clientY) || this.engine.selected;
        if (element) {
            this.engine.select(element);
            this.engine.beginTextEdit(element);
            this.overlay.update(null);
        }
    }

    swallow(event) {
        if (this.protected(event.target) || this.editingTarget(event)) {
            return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    inside(element, event) {
        const rect = element.getBoundingClientRect();
        return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    }

    down(event) {
        if (event.button !== 0 || this.editingTarget(event)) {
            return;
        }
        const handle = event.target.closest ? event.target.closest('[data-bm-handle]') : null;
        if (handle && this.engine.selected) {
            event.preventDefault();
            event.stopImmediatePropagation();
            this.begin('resize', this.engine.selected, event, handle.getAttribute('data-bm-handle'));
            return;
        }
        if (this.protected(event.target)) {
            return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        const keep = this.engine.selected && !event.altKey && this.engine.selected.isConnected && this.inside(this.engine.selected, event);
        const element = keep ? this.engine.selected : this.engine.pick(event.clientX, event.clientY);
        if (!element) {
            this.engine.log('nothing under the pointer');
            this.engine.select(null);
            this.overlay.update(null);
            return;
        }
        this.engine.select(element);
        this.engine.log(`select ${this.engine.keyOf(element)}`);
        this.begin('move', element, event, null);
        this.overlay.update(null);
    }

    begin(type, element, event, handle) {
        this.gesture = { type, element, handle, x: event.clientX, y: event.clientY, rect: this.engine.documentRect(element) };
    }

    move(event) {
        const gesture = this.gesture;
        if (!gesture) {
            this.overlay.update(this.engine.pick(event.clientX, event.clientY));
            return;
        }
        const dx = event.clientX - gesture.x;
        const dy = event.clientY - gesture.y;
        const engine = this.engine;
        const rect =
            gesture.type === 'move'
                ? CanvasGeometry.move(gesture.rect, dx, dy, engine.bounds(), engine.limits(), !event.shiftKey)
                : CanvasGeometry.resize(gesture.rect, gesture.handle, dx, dy, engine.bounds(), engine.limits(), !event.shiftKey);
        engine.setRect(gesture.element, rect);
        this.overlay.update(null);
    }

    up(event) {
        if (this.editingTarget(event)) {
            return;
        }
        if (this.gesture) {
            event.preventDefault();
            event.stopImmediatePropagation();
            const element = this.gesture.element;
            this.gesture = null;
            this.engine.commitScope(this.engine.scopeOf(element));
            this.overlay.update(null);
            return;
        }
        this.swallow(event);
    }

    key(event) {
        if (this.protected(event.target) || this.engine.editing) {
            return;
        }
        const engine = this.engine;
        const ctrl = event.ctrlKey || event.metaKey;
        const handled = () => {
            event.preventDefault();
            event.stopImmediatePropagation();
            this.overlay.update(null);
        };
        if (ctrl && event.code === 'KeyZ') {
            if (event.shiftKey) engine.redo();
            else engine.undo();
            handled();
        } else if (ctrl && event.code === 'KeyY') {
            engine.redo();
            handled();
        } else if (ctrl && event.key === 'ArrowUp') {
            engine.parent();
            handled();
        } else if (ctrl && event.key === 'ArrowDown') {
            engine.child();
            handled();
        } else if (event.key.startsWith('Arrow') && engine.selected) {
            engine.nudgeSelected(event.key, event.shiftKey);
            handled();
        } else if ((event.key === 'Delete' || event.key === 'Backspace') && engine.selected) {
            engine.hideSelected();
            handled();
        } else if (event.key === ']') {
            engine.order(true);
            handled();
        } else if (event.key === '[') {
            engine.order(false);
            handled();
        } else if (event.key === 'Escape') {
            engine.select(null);
            handled();
        }
    }
}
