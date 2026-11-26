import { Dom } from './Dom.js';

export class ConfigEditor {
    constructor({ api, i18n, dialogs, onChange }) {
        this.api = api;
        this.i18n = i18n;
        this.dialogs = dialogs;
        this.onChange = onChange;
        this.root = null;
        this.list = [];
        this.current = null;
        this.snapshot = null;
        this.statusLine = null;
    }

    t(key, params) {
        return this.i18n.t(key, params);
    }

    render() {
        this.root = Dom.el('div', { class: 'panel-card settings-card config-editor' });
        this.reload();
        return this.root;
    }

    async reload() {
        this.list = await this.api.invoke('configs:list');
        if (!this.current && this.list.length > 0) {
            this.current = this.list[0].name;
        }
        await this.open(this.current);
    }

    async open(name) {
        this.current = name;
        this.snapshot = name ? await this.api.invoke('configs:read', { name }) : null;
        this.draw();
    }

    entry() {
        return this.list.find((item) => item.name === this.current) || null;
    }

    draw() {
        const entry = this.entry();
        const select = Dom.el(
            'select',
            { class: 'bm-input', onchange: (event) => this.open(event.target.value) },
            this.list.map((item) => Dom.el('option', { value: item.name, text: item.hasOverride ? `${item.name} *` : item.name, selected: item.name === this.current }))
        );
        const area = Dom.el('textarea', { class: 'bm-input config-json', spellcheck: 'false' });
        area.value = this.snapshot ? JSON.stringify(this.snapshot.effective, null, 2) : '';
        this.statusLine = Dom.el('div', { class: 'settings-status' });
        const note = entry && entry.restart ? this.t('configs.restart') : this.t('configs.live');
        Dom.clear(this.root).append(
            Dom.el('div', { class: 'design-toolbar' }, [Dom.el('span', { class: 'settings-hint', text: this.t('configs.label') }), select]),
            Dom.el('div', { class: 'settings-hint', text: `${note} ${this.t('configs.hint')}` }),
            area,
            Dom.el('div', { class: 'settings-actions' }, [
                Dom.el('button', { class: 'dialog-btn', text: this.t('configs.save'), onclick: () => this.save(area) }),
                Dom.el('button', { class: 'dialog-btn secondary', text: this.t('configs.format'), onclick: () => this.format(area) }),
                Dom.el('button', { class: 'dialog-btn secondary', text: this.t('configs.reset'), disabled: !(entry && entry.hasOverride), onclick: () => this.reset() })
            ]),
            this.statusLine
        );
    }

    status(text) {
        if (this.statusLine) {
            this.statusLine.textContent = text;
        }
    }

    parse(area) {
        try {
            return JSON.parse(area.value);
        } catch (error) {
            this.status(this.t('configs.invalidJson', { message: error.message }));
            return undefined;
        }
    }

    format(area) {
        const data = this.parse(area);
        if (data !== undefined) {
            area.value = JSON.stringify(data, null, 2);
        }
    }

    async save(area) {
        const data = this.parse(area);
        if (data === undefined) {
            return;
        }
        try {
            await this.api.invoke('configs:write', { name: this.current, data });
            await this.onChange(this.current);
            await this.reload();
            this.status(this.t('configs.saved'));
        } catch (error) {
            this.status(this.t('configs.error', { message: error.message }));
        }
    }

    async reset() {
        if (!(await this.dialogs.confirm(this.t('configs.resetConfirm', { name: this.current }), { danger: true }))) {
            return;
        }
        try {
            await this.api.invoke('configs:reset', { name: this.current });
            await this.onChange(this.current);
            await this.reload();
            this.status(this.t('configs.saved'));
        } catch (error) {
            this.status(this.t('configs.error', { message: error.message }));
        }
    }
}
