import { ModuleBridge } from './ModuleBridge.js';
import { Navigation } from './Navigation.js';

export class SessionManager {
    constructor({ api, i18n, dialogs, win, getHost, isReady }) {
        this.api = api;
        this.i18n = i18n;
        this.dialogs = dialogs;
        this.win = win;
        this.getHost = getHost;
        this.isReady = isReady;
        this.settings = null;
        this.saved = null;
        this.getSplit = null;
    }

    async load() {
        this.settings = await this.api.invoke('config:get', { name: 'session' });
    }

    async restore() {
        if (!this.settings) {
            await this.load();
        }
        const info = await this.api.invoke('session:get');
        if (info.mode === 'never' || !info.hasState) {
            return;
        }
        const state = await this.api.invoke('session:load');
        if (!state) {
            return;
        }
        this.saved = state;
        if (state.route) {
            this.win.location.hash = state.route;
        }
    }

    async restoreSplit(apply) {
        for (let attempt = 0; attempt < this.settings.splitRetries; attempt += 1) {
            if (apply()) {
                return;
            }
            await new Promise((resolve) => this.win.setTimeout(resolve, this.settings.splitRetryMs));
        }
    }

    panes() {
        return this.saved && Array.isArray(this.saved.panes) ? this.saved.panes : [];
    }

    finishLater() {
        if (this.saved && this.settings) {
            this.win.setTimeout(() => {
                this.saved = null;
            }, this.settings.restoreWindowMs);
        }
    }

    stateSettings() {
        return { windowMs: this.settings ? this.settings.restoreWindowMs : 0, maxValueLength: this.settings ? this.settings.maxValueLength : 0 };
    }

    takeState(moduleId) {
        const entry = this.saved && this.saved.modules ? this.saved.modules[moduleId] : null;
        return { ...this.stateSettings(), data: entry || null };
    }

    visibleBridges() {
        return [...ModuleBridge.live]
            .filter((bridge) => bridge.frame && bridge.frame.isConnected && bridge.key())
            .sort((a, b) => a.frame.getBoundingClientRect().left - b.frame.getBoundingClientRect().left);
    }

    async capture() {
        const modules = {};
        const split = this.getSplit ? this.getSplit() : null;
        const panes = split && split.primaryId ? [split.primaryId, split.secondaryId].filter((id) => id && id !== Navigation.SETTINGS_ID && id !== Navigation.HUB_ID) : [];
        for (const bridge of this.visibleBridges()) {
            const id = bridge.key();
            if (!split) {
                panes.push(id);
            }
            const snapshot = await bridge.snapshot(this.settings.snapshotTimeoutMs);
            if (snapshot) {
                modules[id] = snapshot;
            }
        }
        return { version: 1, route: this.win.location.hash, panes, modules };
    }

    async handleBeforeClose() {
        if (!this.isReady()) {
            await this.api.invoke('window:closeNow');
            return;
        }
        if (!this.settings) {
            await this.load();
        }
        const mode = (await this.api.invoke('session:get')).mode;
        let save = mode === 'always';
        if (mode === 'ask') {
            save = await this.dialogs.confirm(this.i18n.t('session.confirm'), {
                confirmText: this.i18n.t('session.save'),
                cancelText: this.i18n.t('session.discard')
            });
        }
        if (save) {
            await this.api.invoke('session:save', { state: await this.capture() });
        } else {
            await this.api.invoke('session:clear');
        }
        await this.api.invoke('window:closeNow');
    }
}
