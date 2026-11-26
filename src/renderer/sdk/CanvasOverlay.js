export class CanvasOverlay {
    static STYLESHEET = 'bm://app/sdk/canvas.css';
    static HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

    constructor({ win, engine }) {
        this.win = win;
        this.doc = win.document;
        this.engine = engine;
        this.root = null;
    }

    box(className) {
        const element = this.doc.createElement('div');
        element.className = `${className} bm-canvas-hidden`;
        return element;
    }

    mount() {
        if (this.root) {
            return;
        }
        if (!this.doc.querySelector('link[data-bm-canvas-css]')) {
            const link = this.doc.createElement('link');
            link.rel = 'stylesheet';
            link.href = CanvasOverlay.STYLESHEET;
            link.setAttribute('data-bm-canvas-css', '');
            this.doc.head.append(link);
        }
        this.root = this.doc.createElement('div');
        this.root.className = 'bm-canvas-overlay';
        this.root.setAttribute('data-bm-canvas-ui', '');
        this.grid = this.doc.createElement('div');
        this.grid.className = 'bm-canvas-grid';
        this.hover = this.box('bm-canvas-hover');
        this.selection = this.box('bm-canvas-selection');
        this.label = this.doc.createElement('span');
        this.label.className = 'bm-canvas-label';
        this.selection.append(this.label);
        for (const handle of CanvasOverlay.HANDLES) {
            const element = this.doc.createElement('div');
            element.className = 'bm-canvas-handle';
            element.setAttribute('data-bm-handle', handle);
            this.selection.append(element);
        }
        this.root.append(this.grid, this.hover, this.selection);
        this.doc.body.append(this.root);
    }

    unmount() {
        if (this.root) {
            this.root.remove();
            this.root = null;
        }
    }

    setGrid(enabled, snap) {
        if (this.root) {
            this.root.classList.toggle('bm-canvas-grid-on', enabled);
            this.root.style.setProperty('--bm-snap', `${snap}px`);
        }
    }

    place(box, element) {
        if (!element || !element.isConnected) {
            box.classList.add('bm-canvas-hidden');
            return;
        }
        const rect = element.getBoundingClientRect();
        box.style.setProperty('--bm-left', `${rect.left}px`);
        box.style.setProperty('--bm-top', `${rect.top}px`);
        box.style.setProperty('--bm-width', `${rect.width}px`);
        box.style.setProperty('--bm-height', `${rect.height}px`);
        box.classList.remove('bm-canvas-hidden');
    }

    update(hovered) {
        if (!this.root) {
            return;
        }
        const selected = this.engine.selected;
        this.place(this.hover, hovered && hovered !== selected ? hovered : null);
        this.place(this.selection, selected);
        this.label.textContent = selected ? this.engine.label(selected) : '';
    }
}
