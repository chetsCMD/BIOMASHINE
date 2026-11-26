import { CanvasEngine } from '../sdk/CanvasEngine.js';
import { CanvasToolbar } from './CanvasToolbar.js';
import { ModuleBridge } from './ModuleBridge.js';

export class CanvasManager {
    constructor({ api, i18n, dialogs, win, getHost, getStage }) {
        this.api = api;
        this.i18n = i18n;
        this.dialogs = dialogs;
        this.win = win;
        this.getHost = getHost;
        this.getStage = getStage;
        this.enabled = false;
        this.grid = false;
        this.available = false;
        this.focus = 'shell';
        this.moduleState = null;
        this.shellState = null;
        this.currentView = null;
    }

    async start() {
        this.config = await this.api.invoke('config:get', { name: 'canvas' });
        this.engine = new CanvasEngine({
            win: this.win,
            config: this.config,
            scope: 'shell',
            scopeOf: (element) => this.scopeOf(element),
            root: 'body',
            onChange: (scope, layout) => this.save(scope, layout),
            onState: (state) => this.onShellState(state),
            onLog: (text) => this.log(`shell: ${text}`)
        });
        this.toolbar = new CanvasToolbar({ doc: this.win.document, i18n: this.i18n, onAction: (action, payload) => this.act(action, payload) });
        this.toolbar.mount();
        this.engine.start();
        await this.loadScopes();
        const saved = await this.api.invoke('layout:get', { scope: 'view:toolbar' });
        const placed = saved.layout && saved.layout.items.toolbar;
        if (placed) {
            this.toolbar.setOffset(placed.dx, placed.dy);
        }
        this.win.addEventListener('hashchange', () => this.onRoute());
    }

    viewScope() {
        const route = this.win.location.hash.replace(/^#\/?/, '').split('/')[0] || 'start';
        return `view:${route.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
    }

    scopeOf(element) {
        const stage = this.getStage();
        return stage && stage.contains(element) ? this.viewScope() : 'shell';
    }

    async loadScopes() {
        this.currentView = this.viewScope();
        for (const scope of ['shell', this.currentView]) {
            const { layout } = await this.api.invoke('layout:get', { scope });
            this.engine.applyLayout(scope, layout);
        }
    }

    async onRoute() {
        const next = this.viewScope();
        if (next === this.currentView) {
            return;
        }
        this.engine.dropScope(this.currentView);
        this.currentView = next;
        this.moduleState = null;
        const { layout } = await this.api.invoke('layout:get', { scope: next });
        this.engine.applyLayout(next, layout);
        this.engine.select(null);
    }

    async save(scope, layout) {
        try {
            await this.api.invoke('layout:save', { scope, layout });
        } catch (error) {
            this.engine.emitState();
        }
    }

    setAvailable(available) {
        this.available = available;
        this.toolbar.setAvailable(available);
    }

    get moduleScope() {
        return this.moduleState && this.moduleState.scope && this.moduleState.scope.startsWith('module:') ? this.moduleState.scope : null;
    }

    sendModule(message) {
        ModuleBridge.broadcastCanvas(message);
    }

    isEnabled() {
        return this.enabled;
    }

    toggle() {
        if (this.enabled) this.exit();
        else this.enter();
    }

    enter() {
        if (!this.available) {
            return;
        }
        this.enabled = true;
        this.engine.setEnabled(true, this.grid);
        this.sendModule({ command: 'enable', enabled: true, grid: this.grid });
        this.render();
    }

    exit() {
        this.enabled = false;
        this.engine.setEnabled(false);
        this.sendModule({ command: 'enable', enabled: false });
        this.render();
    }

    handleModuleState(state) {
        this.moduleState = state;
        if (state.selected) {
            this.focus = 'module';
            this.engine.select(null);
        }
        this.render();
    }

    onShellState(state) {
        this.shellState = state;
        if (state.selected) {
            this.focus = 'shell';
            this.sendModule({ command: 'select', key: null });
        }
        this.render();
    }

    current() {
        return this.focus === 'module' && this.moduleState ? this.moduleState : this.shellState;
    }

    render() {
        if (!this.toolbar) {
            return;
        }
        const state = this.current() || { selected: null, breadcrumb: [], canUndo: false, canRedo: false, hidden: [] };
        const hidden = [...(this.moduleState ? this.moduleState.hidden : []), ...(this.shellState ? this.shellState.hidden : [])];
        const view = { enabled: this.enabled, grid: this.grid, selected: state.selected, breadcrumb: state.breadcrumb, canUndo: state.canUndo, canRedo: state.canRedo, hidden, diagnostics: this.diagnostics(), logs: this.logs || [] };
        const text = JSON.stringify(view);
        if (text !== this.lastView) {
            this.lastView = text;
            this.toolbar.render(view);
        }
    }

    moduleId() {
        return this.moduleScope ? this.moduleScope.slice('module:'.length) : undefined;
    }

    command(command, extra = {}) {
        if (this.focus === 'module') this.sendModule({ command, target: this.moduleId(), ...extra });
        else this.engine.command({ command, ...extra });
    }

    async resetScope(scope, localReset) {
        if (!(await this.dialogs.confirm(this.i18n.t('canvas.resetConfirm'), { danger: true }))) {
            return;
        }
        await this.api.invoke('layout:reset', { scope });
        localReset();
        this.render();
    }

    log(text) {
        this.logs = [...(this.logs || []), text].slice(-this.config.logLimit);
        this.render();
    }

    diagnostics() {
        return [
            `shell engine: ${this.enabled ? 'on' : 'off'}, available: ${this.available}`,
            `module bridges: ${ModuleBridge.live.size}, module state received: ${Boolean(this.moduleState)}`,
            `module scope: ${this.moduleScope || '-'}, view: ${this.currentView}`
        ];
    }

    act(action, payload) {
        try {
            this.perform(action, payload);
        } catch (error) {
            this.log(`${action}: ${error.message}`);
        }
    }

    perform(action, payload) {
        const actions = {
            toggle: () => this.toggle(),
            toolbarMoved: () => this.api.invoke('layout:save', { scope: 'view:toolbar', layout: { version: 2, items: { toolbar: { dx: Math.round(payload.x), dy: Math.round(payload.y) } } } }),
            done: () => this.exit(),
            grid: () => {
                this.grid = payload.grid;
                this.engine.command({ command: 'grid', grid: this.grid });
                this.sendModule({ command: 'grid', grid: this.grid });
            },
            show: () => (payload.scope.startsWith('module:') ? this.sendModule({ command: 'show', ...payload }) : this.engine.command({ command: 'show', ...payload })),
            select: () => this.command('select', payload),
            resetPage: () => {
                const module = this.moduleScope;
                const scope = module || this.currentView;
                return this.resetScope(scope, () => (module ? this.sendModule({ command: 'reset', scope: module }) : this.engine.reset(scope)));
            },
            resetShell: () => this.resetScope('shell', () => this.engine.reset('shell'))
        };
        if (actions[action]) {
            actions[action]();
        } else {
            this.command(action);
        }
    }
}
