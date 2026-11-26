import { CanvasGeometry } from './CanvasGeometry.js';
import { CanvasHistory } from './CanvasHistory.js';
import { CanvasKeys } from './CanvasKeys.js';
import { CanvasOverlay } from './CanvasOverlay.js';
import { CanvasPointer } from './CanvasPointer.js';
import { CanvasStyles } from './CanvasStyles.js';

export class CanvasEngine {
    constructor({ win, config, scope, scopeOf = null, root = null, onChange = () => {}, onState = () => {}, onLog = () => {} }) {
        this.onLog = onLog;
        this.win = win;
        this.doc = win.document;
        this.config = config;
        this.scope = scope;
        this.scopeOf = scopeOf || (() => scope);
        this.rootSelector = root || config.defaultRoot;
        this.onChange = onChange;
        this.onState = onState;
        this.scopes = new Map();
        this.applied = new Map();
        this.selected = null;
        this.enabled = false;
        this.grid = false;
        this.active = scope;
        this.frame = null;
        this.pointer = null;
        this.overlay = null;
        this.editing = null;
    }

    log(text) {
        this.onLog(text);
    }

    root() {
        return this.doc.querySelector(this.rootSelector) || this.doc.body;
    }

    entry(scope) {
        if (!this.scopes.has(scope)) {
            this.scopes.set(scope, { items: new Map(), history: new CanvasHistory(this.config.historyLimit) });
        }
        return this.scopes.get(scope);
    }

    start() {
        const observer = new this.win.MutationObserver((records) => {
            if (!records || records.some((record) => !this.inUi(record.target))) {
                this.schedule();
            }
        });
        observer.observe(this.doc.documentElement, { childList: true, subtree: true });
    }

    inUi(node) {
        const element = node && node.nodeType === 3 ? node.parentElement : node;
        return Boolean(element && element.closest && this.config.protectedSelectors.some((selector) => element.closest(selector)));
    }

    schedule() {
        if (this.frame !== null) {
            return;
        }
        this.frame = this.win.requestAnimationFrame(() => {
            this.frame = null;
            this.refresh();
            this.emitState();
        });
    }

    plain(entry) {
        return Object.fromEntries(entry.items);
    }

    layoutOf(scope) {
        return { version: 2, items: this.plain(this.entry(scope)) };
    }

    applyLayout(scope, layout) {
        const entry = this.entry(scope);
        entry.items = new Map(Object.entries(layout && layout.items ? layout.items : {}));
        entry.history.reset(this.plain(entry));
        this.refresh();
        this.emitState();
    }

    refresh() {
        const root = this.root();
        const live = new Set();
        for (const [scope, entry] of this.scopes) {
            for (const [key, item] of entry.items) {
                const element = CanvasKeys.resolve(key, root, this.doc);
                if (element) {
                    CanvasStyles.apply(element, item, this.win, element === this.editing);
                    this.applied.set(element, { scope, key });
                    live.add(element);
                }
            }
        }
        for (const element of [...this.applied.keys()]) {
            if (!live.has(element)) {
                CanvasStyles.restore(element);
                this.applied.delete(element);
            }
        }
    }

    limits() {
        const config = this.config;
        return { snapPx: config.snapPx, minWidthPx: config.minWidthPx, minHeightPx: config.minHeightPx, maxHeightPx: config.maxHeightPx, nudgeLargeFactor: config.nudgeLargeFactor, precision: config.precision, zMax: config.zMax };
    }

    bounds() {
        return { width: this.doc.documentElement.clientWidth };
    }

    keyOf(element) {
        return CanvasKeys.keyFor(element, this.root(), this.doc);
    }

    excluded(element) {
        const root = this.root();
        if (element === root || this.config.ignoreTags.includes(element.tagName.toLowerCase())) {
            return true;
        }
        if (this.config.protectedSelectors.some((selector) => element.closest(selector))) {
            return true;
        }
        const rect = element.getBoundingClientRect();
        return rect.width < this.config.pickMinSizePx || rect.height < this.config.pickMinSizePx;
    }

    pick(x, y) {
        for (const element of this.doc.elementsFromPoint(x, y)) {
            if (!this.excluded(element)) {
                return element;
            }
        }
        return null;
    }

    label(element) {
        const text = element.getAttribute('data-bm-title') || element.getAttribute('aria-label') || element.getAttribute('title') || (element.textContent || '').trim().replace(/\s+/g, ' ');
        const short = text.length > this.config.labelMaxLength ? `${text.slice(0, this.config.labelMaxLength).trimEnd()}…` : text;
        return short || `<${element.tagName.toLowerCase()}>`;
    }

    documentRect(element) {
        const rect = element.getBoundingClientRect();
        return { x: rect.left + this.win.scrollX, y: rect.top + this.win.scrollY, w: rect.width, h: rect.height };
    }

    natural(element) {
        const suspended = CanvasStyles.suspend(element);
        const rect = this.documentRect(element);
        CanvasStyles.resume(element, suspended);
        return rect;
    }

    select(element) {
        this.selected = element;
        if (element) {
            this.active = this.scopeOf(element);
        }
        this.emitState();
    }

    selectKey(key) {
        const element = CanvasKeys.resolve(key, this.root(), this.doc);
        if (element && !this.excluded(element)) {
            this.select(element);
        }
    }

    parent() {
        const parent = this.selected ? this.selected.parentElement : null;
        if (parent && !this.excluded(parent)) {
            this.select(parent);
        }
    }

    child() {
        if (!this.selected) {
            return;
        }
        const next = [...this.selected.children].find((element) => !this.excluded(element));
        if (next) {
            this.select(next);
        }
    }

    itemOf(element) {
        const key = this.keyOf(element);
        if (!key) {
            return null;
        }
        const scope = this.scopeOf(element);
        return { key, scope, entry: this.entry(scope) };
    }

    setRect(element, rect) {
        const target = this.itemOf(element);
        if (!target) {
            return false;
        }
        const item = CanvasGeometry.itemFromRect(this.natural(element), rect);
        const next = { ...(target.entry.items.get(target.key) || {}), ...item };
        if (item.w === undefined) delete next.w;
        if (item.h === undefined) delete next.h;
        target.entry.items.set(target.key, next);
        CanvasStyles.apply(element, next, this.win);
        this.applied.set(element, { scope: target.scope, key: target.key });
        this.emitState();
        return true;
    }

    commitScope(scope) {
        const entry = this.entry(scope);
        for (const [key, item] of [...entry.items]) {
            if (!item.dx && !item.dy && !item.w && !item.h && !item.z && !item.hidden && item.text === undefined) {
                entry.items.delete(key);
            }
        }
        if (entry.history.push(this.plain(entry))) {
            this.onChange(scope, this.layoutOf(scope));
        }
        this.refresh();
        this.emitState();
    }

    setText(element, text) {
        const target = this.itemOf(element);
        if (!target) {
            return;
        }
        const original = CanvasStyles.texts.has(element) ? CanvasStyles.texts.get(element) : element.textContent;
        const next = { ...(target.entry.items.get(target.key) || { dx: 0, dy: 0 }) };
        if (text === original) delete next.text;
        else next.text = text.slice(0, this.config.maxTextLength);
        target.entry.items.set(target.key, next);
        CanvasStyles.apply(element, next, this.win);
        this.commitScope(target.scope);
    }

    beginTextEdit(element) {
        if (!element || element.children.length > 0) {
            this.log('text editing needs an element without children');
            return;
        }
        if (!CanvasStyles.texts.has(element)) {
            CanvasStyles.texts.set(element, element.textContent);
        }
        const original = CanvasStyles.texts.get(element);
        this.editing = element;
        element.setAttribute('contenteditable', 'plaintext-only');
        element.focus();
        const range = this.doc.createRange();
        range.selectNodeContents(element);
        const selection = this.win.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        const finish = (commit) => {
            element.removeEventListener('blur', onBlur);
            element.removeEventListener('keydown', onKey);
            element.removeAttribute('contenteditable');
            this.editing = null;
            if (commit) {
                this.setText(element, element.textContent);
            } else {
                element.textContent = original;
                const target = this.itemOf(element);
                const kept = target && (target.entry.items.get(target.key) || {}).text !== undefined;
                if (!kept) CanvasStyles.texts.delete(element);
            }
            this.emitState();
        };
        const onBlur = () => finish(true);
        const onKey = (event) => {
            event.stopPropagation();
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                element.blur();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                element.removeEventListener('blur', onBlur);
                finish(false);
            }
        };
        element.addEventListener('blur', onBlur);
        element.addEventListener('keydown', onKey);
    }

    nudgeSelected(key, large) {
        if (!this.selected) {
            return;
        }
        const rect = CanvasGeometry.nudge(this.documentRect(this.selected), key, this.bounds(), this.limits(), large);
        if (this.setRect(this.selected, rect)) {
            this.commitScope(this.scopeOf(this.selected));
        }
    }

    hideSelected() {
        const element = this.selected;
        const target = element ? this.itemOf(element) : null;
        if (!target) {
            return;
        }
        target.entry.items.set(target.key, { ...(target.entry.items.get(target.key) || { dx: 0, dy: 0 }), hidden: true });
        this.selected = null;
        this.commitScope(target.scope);
    }

    show(scope, key) {
        const entry = this.entry(scope);
        const item = entry.items.get(key);
        if (item) {
            delete item.hidden;
            this.commitScope(scope);
        }
    }

    order(toFront) {
        const target = this.selected ? this.itemOf(this.selected) : null;
        if (!target) {
            return;
        }
        const current = target.entry.items.get(target.key) || { dx: 0, dy: 0 };
        const highest = Math.max(0, ...[...target.entry.items.values()].map((item) => item.z || 0));
        const next = { ...current };
        if (toFront) next.z = Math.min(highest + 1, this.config.zMax);
        else delete next.z;
        target.entry.items.set(target.key, next);
        this.commitScope(target.scope);
    }

    restoreState(scope, state) {
        const entry = this.entry(scope);
        entry.items = new Map(Object.entries(state));
        this.refresh();
        this.onChange(scope, this.layoutOf(scope));
        this.emitState();
    }

    undo() {
        const state = this.entry(this.active).history.undo();
        if (state) {
            this.restoreState(this.active, state);
        }
    }

    redo() {
        const state = this.entry(this.active).history.redo();
        if (state) {
            this.restoreState(this.active, state);
        }
    }

    reset(scope) {
        const entry = this.entry(scope);
        entry.items = new Map();
        entry.history.reset({});
        this.refresh();
        this.emitState();
    }

    dropScope(scope) {
        this.reset(scope);
        this.scopes.delete(scope);
    }

    describe(element) {
        const parent = element.parentElement;
        return {
            key: this.keyOf(element),
            scope: this.scopeOf(element),
            label: this.label(element),
            tag: element.tagName.toLowerCase(),
            canParent: Boolean(parent) && !this.excluded(parent),
            canChild: [...element.children].some((child) => !this.excluded(child))
        };
    }

    breadcrumb(element) {
        const trail = [];
        for (let node = element; node && node !== this.root(); node = node.parentElement) {
            if (!this.excluded(node)) {
                trail.unshift({ key: this.keyOf(node), label: this.label(node) });
            }
        }
        return trail;
    }

    hidden() {
        const list = [];
        const root = this.root();
        for (const [scope, entry] of this.scopes) {
            for (const [key, item] of entry.items) {
                if (item.hidden) {
                    const element = CanvasKeys.resolve(key, root, this.doc);
                    list.push({ scope, key, label: element ? this.label(element) : key });
                }
            }
        }
        return list;
    }

    state() {
        const selected = this.selected && this.selected.isConnected ? this.selected : null;
        const entry = this.entry(this.active);
        return {
            enabled: this.enabled,
            grid: this.grid,
            scope: this.active,
            selected: selected ? this.describe(selected) : null,
            breadcrumb: selected ? this.breadcrumb(selected) : [],
            hidden: this.hidden(),
            canUndo: entry.history.canUndo,
            canRedo: entry.history.canRedo
        };
    }

    emitState() {
        const state = this.state();
        const text = JSON.stringify(state);
        if (text !== this.lastState) {
            this.lastState = text;
            this.onState(state);
        }
    }

    setEnabled(enabled, grid = false) {
        this.enabled = enabled;
        this.grid = grid;
        this.log(`${enabled ? 'enabled' : 'disabled'} scope=${this.scope}`);
        if (enabled) {
            if (!this.pointer) {
                this.overlay = new CanvasOverlay({ win: this.win, engine: this });
                this.pointer = new CanvasPointer({ win: this.win, engine: this, overlay: this.overlay });
            }
            this.pointer.enable();
            this.overlay.setGrid(grid, this.config.snapPx);
        } else {
            this.selected = null;
            if (this.pointer) {
                this.pointer.disable();
            }
        }
        this.emitState();
    }

    command(message) {
        const actions = {
            enable: () => this.setEnabled(Boolean(message.enabled), Boolean(message.grid)),
            grid: () => {
                this.grid = Boolean(message.grid);
                if (this.overlay) this.overlay.setGrid(this.grid, this.config.snapPx);
                this.emitState();
            },
            undo: () => this.undo(),
            redo: () => this.redo(),
            hide: () => this.hideSelected(),
            show: () => this.show(message.scope, message.key),
            front: () => this.order(true),
            back: () => this.order(false),
            parent: () => this.parent(),
            child: () => this.child(),
            select: () => (message.key ? this.selectKey(message.key) : this.select(null)),
            reset: () => this.reset(message.scope)
        };
        if (actions[message.command]) {
            actions[message.command]();
        }
    }
}
