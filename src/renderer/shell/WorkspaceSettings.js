import { Dom } from './Dom.js';

export class WorkspaceSettings {
    static DEFAULT_NAME_KEY = 'workspace.default';

    constructor({ api, i18n, dialogs }) {
        this.api = api;
        this.i18n = i18n;
        this.dialogs = dialogs;
        this.root = null;
        this.statusLine = null;
    }

    t(key, params) {
        return this.i18n.t(key, params);
    }

    render() {
        this.root = Dom.el('div', { class: 'panel-card settings-card' });
        this.reload();
        return this.root;
    }

    displayName(profile) {
        return profile.name || this.t(profile.nameKey);
    }

    async reload() {
        this.data = await this.api.invoke('workspace:list');
        this.draw();
    }

    status(text) {
        if (this.statusLine) {
            this.statusLine.textContent = text;
        }
    }

    async run(work) {
        try {
            await work();
            await this.reload();
        } catch (error) {
            this.status(this.t('workspace.error', { message: error.message }));
        }
    }

    row(profile) {
        const name = Dom.el('input', { type: 'text', class: 'bm-input', value: this.displayName(profile) });
        const badges = [];
        if (profile.id === this.data.running) {
            badges.push(Dom.el('span', { class: 'workspace-badge', text: this.t('workspace.running') }));
        }
        if (profile.id === this.data.active && profile.id !== this.data.running) {
            badges.push(Dom.el('span', { class: 'workspace-badge', text: this.t('workspace.next') }));
        }
        const busy = profile.id === this.data.running || profile.id === this.data.active;
        const actions = [
            Dom.el('button', {
                class: 'dialog-btn secondary',
                text: this.t('workspace.rename'),
                onclick: () => this.run(() => this.api.invoke('workspace:rename', { id: profile.id, name: name.value }))
            }),
            Dom.el('button', {
                class: 'dialog-btn secondary',
                text: this.t('workspace.clone'),
                onclick: () => this.run(() => this.api.invoke('workspace:create', { name: `${name.value} 2`, from: profile.id }))
            })
        ];
        if (profile.id !== this.data.running) {
            actions.unshift(Dom.el('button', { class: 'dialog-btn', text: this.t('workspace.switch'), onclick: () => this.switchTo(profile) }));
        }
        if (!busy) {
            actions.push(Dom.el('button', { class: 'dialog-btn danger', text: this.t('workspace.remove'), onclick: () => this.remove(profile) }));
        }
        return Dom.el('div', { class: 'workspace-row' }, [Dom.el('div', { class: 'workspace-name' }, [name]), ...badges, ...actions]);
    }

    async switchTo(profile) {
        if (await this.dialogs.confirm(this.t('workspace.switchConfirm', { name: this.displayName(profile) }), { confirmText: this.t('workspace.switch') })) {
            await this.run(() => this.api.invoke('workspace:switch', { id: profile.id }));
        }
    }

    async remove(profile) {
        if (await this.dialogs.confirm(this.t('workspace.removeConfirm', { name: this.displayName(profile) }), { confirmText: this.t('workspace.remove'), danger: true })) {
            await this.run(() => this.api.invoke('workspace:remove', { id: profile.id }));
        }
    }

    draw() {
        const name = Dom.el('input', { type: 'text', class: 'bm-input', placeholder: this.t('workspace.name') });
        const copy = Dom.el('input', { type: 'checkbox' });
        this.statusLine = Dom.el('div', { class: 'settings-status' });
        Dom.clear(this.root).append(
            Dom.el('div', { class: 'settings-hint', text: this.t('workspace.hint') }),
            Dom.el('div', { class: 'workspace-list' }, this.data.profiles.map((profile) => this.row(profile))),
            Dom.el('div', { class: 'workspace-create' }, [
                name,
                Dom.el('label', { class: 'settings-hint' }, [copy, ` ${this.t('workspace.copyCurrent')}`]),
                Dom.el('button', {
                    class: 'dialog-btn',
                    text: this.t('workspace.create'),
                    onclick: () => this.run(() => this.api.invoke('workspace:create', { name: name.value, from: copy.checked ? this.data.running : null }))
                })
            ]),
            this.statusLine
        );
    }
}
