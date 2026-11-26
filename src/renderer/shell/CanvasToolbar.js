import { Dom } from './Dom.js';

export class CanvasToolbar {
    constructor({ doc, i18n, onAction }) {
        this.doc = doc;
        this.i18n = i18n;
        this.onAction = onAction;
        this.fab = null;
        this.bar = null;
        this.offset = { x: 0, y: 0 };
        this.drag = null;
    }

    t(key, params) {
        return this.i18n.t(key, params);
    }

    mount() {
        this.fab = Dom.el('button', { class: 'bm-canvas-fab hidden', title: this.t('shortcut.canvasMode'), text: '✥', onclick: () => this.onAction('toggle') });
        this.fab.setAttribute('data-bm-canvas-ui', '');
        this.bar = Dom.el('div', { class: 'bm-canvas-toolbar' });
        this.bar.setAttribute('data-bm-canvas-ui', '');
        this.doc.body.append(this.fab, this.bar);
        const view = this.doc.defaultView;
        if (view) {
            view.addEventListener('pointermove', (event) => this.dragMove(event));
            view.addEventListener('pointerup', () => this.dragEnd());
        }
    }

    setOffset(x, y) {
        this.offset = { x, y };
        this.bar.style.setProperty('--bm-toolbar-x', `${x}px`);
        this.bar.style.setProperty('--bm-toolbar-y', `${y}px`);
    }

    dragStart(event) {
        event.preventDefault();
        this.drag = { x: event.clientX, y: event.clientY, from: { ...this.offset } };
    }

    dragMove(event) {
        if (this.drag) {
            this.setOffset(this.drag.from.x + event.clientX - this.drag.x, this.drag.from.y + event.clientY - this.drag.y);
        }
    }

    dragEnd() {
        if (this.drag) {
            this.drag = null;
            this.onAction('toolbarMoved', { ...this.offset });
        }
    }

    setAvailable(available) {
        this.fab.classList.toggle('hidden', !available);
    }

    button(text, action, payload, disabled = false) {
        return Dom.el('button', { class: 'dialog-btn secondary', text, disabled, onclick: () => this.onAction(action, payload) });
    }

    render(view) {
        this.fab.classList.toggle('active', view.enabled);
        this.bar.classList.toggle('visible', view.enabled);
        if (!view.enabled) {
            return;
        }
        const selected = view.selected;
        const grip = Dom.el('div', { class: 'bm-canvas-grip', title: this.t('canvas.grip'), text: '⋮⋮' });
        grip.addEventListener('pointerdown', (event) => this.dragStart(event));
        const crumbs = view.breadcrumb.map((crumb) => Dom.el('button', { class: 'bm-canvas-crumb', text: crumb.label, onclick: () => this.onAction('select', { key: crumb.key }) }));
        const hidden = Dom.el('details', { class: 'bm-canvas-hidden-list' }, [
            Dom.el('summary', { text: this.t('canvas.hidden', { count: view.hidden.length }) }),
            ...view.hidden.map((item) =>
                Dom.el('button', { class: 'dialog-btn secondary', text: `${this.t('canvas.show')}: ${item.label}`, onclick: () => this.onAction('show', { scope: item.scope, key: item.key }) })
            )
        ]);
        const grid = Dom.el('input', { type: 'checkbox', checked: view.grid, onchange: (event) => this.onAction('grid', { grid: event.target.checked }) });
        Dom.clear(this.bar).append(
            grip,
            Dom.el('div', { class: 'bm-canvas-status', text: selected ? this.t('canvas.selected', { label: selected.label }) : this.t('canvas.hint') }),
            Dom.el('div', { class: 'bm-canvas-crumbs' }, crumbs),
            Dom.el('div', { class: 'settings-actions' }, [
                this.button(this.t('canvas.parent'), 'parent', null, !(selected && selected.canParent)),
                this.button(this.t('canvas.child'), 'child', null, !(selected && selected.canChild)),
                this.button(this.t('canvas.front'), 'front', null, !selected),
                this.button(this.t('canvas.back'), 'back', null, !selected),
                this.button(this.t('canvas.hide'), 'hide', null, !selected),
                this.button(this.t('canvas.undo'), 'undo', null, !view.canUndo),
                this.button(this.t('canvas.redo'), 'redo', null, !view.canRedo)
            ]),
            Dom.el('label', { class: 'settings-hint' }, [grid, ` ${this.t('canvas.grid')}`]),
            hidden,
            Dom.el('details', { class: 'bm-canvas-hidden-list' }, [Dom.el('summary', { text: this.t('canvas.diagnostics') }), Dom.el('pre', { class: 'bm-canvas-log', text: [...view.diagnostics, ...view.logs].join('\n') })]),
            Dom.el('div', { class: 'settings-actions' }, [
                this.button(this.t('canvas.resetPage'), 'resetPage'),
                this.button(this.t('canvas.resetShell'), 'resetShell'),
                Dom.el('button', { class: 'dialog-btn', text: this.t('canvas.done'), onclick: () => this.onAction('done') })
            ])
        );
    }
}
