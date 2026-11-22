import { Dom } from './Dom.js';
import { TextSearch } from './TextSearch.js';

export class TokenKinds {
    static kind(value) {
        const text = String(value).trim();
        if (/^#[0-9a-fA-F]{6}$/.test(text)) return 'color';
        if (/^(#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\()/.test(text)) return 'color-text';
        if (/^-?\d*\.?\d+(px|rem|em|%|vh|vw|ch)$/.test(text)) return 'length';
        if (/^-?\d*\.?\d+m?s$/.test(text)) return 'time';
        if (/^-?\d*\.?\d+$/.test(text)) return 'number';
        return 'text';
    }
}

export class DesignEditor {
    constructor({ api, i18n, dialogs, onChange, doc = document }) {
        this.api = api;
        this.i18n = i18n;
        this.dialogs = dialogs;
        this.onChange = onChange;
        this.doc = doc;
        this.scope = '';
        this.query = '';
        this.tab = 'tokens';
        this.root = null;
        this.modules = [];
        this.groups = [];
        this.state = { base: {}, overrides: {} };
        this.css = '';
        this.statusLine = null;
    }

    t(key, params) {
        return this.i18n.t(key, params);
    }

    get module() {
        return this.scope || null;
    }

    render(modules) {
        this.modules = modules.filter((module) => module.kind === 'page');
        this.root = Dom.el('div', { class: 'panel-card settings-card design-editor' });
        this.reload();
        return this.root;
    }

    async reload() {
        const [groups, data, css] = await Promise.all([
            this.api.invoke('design:groups'),
            this.api.invoke('design:get', { module: this.module }),
            this.api.invoke('design:getCss', { module: this.module })
        ]);
        this.groups = groups;
        this.state = data;
        this.css = css.css;
        this.draw();
    }

    draw() {
        Dom.clear(this.root).append(this.toolbar(), ...(this.tab === 'tokens' ? this.tokensBody() : this.cssBody()), this.footer());
    }

    toolbar() {
        const select = Dom.el(
            'select',
            {
                class: 'bm-input',
                onchange: (event) => {
                    this.scope = event.target.value;
                    this.reload();
                }
            },
            [
                Dom.el('option', { value: '', text: this.t('design.scope.all'), selected: this.scope === '' }),
                ...this.modules.map((module) => Dom.el('option', { value: module.id, text: module.title, selected: module.id === this.scope }))
            ]
        );
        const tab = (name, key) =>
            Dom.el('button', {
                class: this.tab === name ? 'dialog-btn' : 'dialog-btn secondary',
                text: this.t(key),
                onclick: () => {
                    this.tab = name;
                    this.draw();
                }
            });
        return Dom.el('div', { class: 'design-toolbar' }, [
            Dom.el('span', { class: 'settings-hint', text: this.t('design.scope') }),
            select,
            tab('tokens', 'design.tab.tokens'),
            tab('css', 'design.tab.css')
        ]);
    }

    tokensBody() {
        const list = Dom.el('div', { class: 'design-groups' });
        const search = Dom.el('input', {
            type: 'text',
            class: 'bm-input',
            placeholder: this.t('design.search'),
            autocomplete: 'off',
            value: this.query,
            oninput: (event) => {
                this.query = event.target.value;
                this.renderGroups(list);
            }
        });
        this.renderGroups(list);
        return [search, list];
    }

    renderGroups(container) {
        Dom.clear(container);
        const query = this.query.trim();
        let shown = 0;
        for (const group of this.groups) {
            const tokens = query ? TextSearch.filter(group.tokens, query, (token) => [token.name, token.value]) : group.tokens;
            if (tokens.length === 0) {
                continue;
            }
            shown += 1;
            const details = Dom.el('details', { class: 'design-group', open: Boolean(query) }, [
                Dom.el('summary', { text: this.t('design.group', { name: group.group, count: tokens.length }) })
            ]);
            let built = false;
            const build = () => {
                if (!built) {
                    built = true;
                    tokens.forEach((token) => details.append(this.row(token)));
                }
            };
            details.addEventListener('toggle', () => {
                if (details.open) {
                    build();
                }
            });
            if (query) {
                build();
            }
            container.append(details);
        }
        if (shown === 0) {
            container.append(Dom.el('div', { class: 'empty', text: this.t('design.empty') }));
        }
    }

    currentValue(token) {
        const overrides = this.state.overrides;
        if (overrides[token.name] !== undefined) {
            return overrides[token.name];
        }
        return this.state.base[token.name] !== undefined ? this.state.base[token.name] : token.value;
    }

    row(token) {
        const overridden = this.state.overrides[token.name] !== undefined;
        const current = this.currentValue(token);
        const text = Dom.el('input', { type: 'text', class: 'bm-input', value: current });
        const reset = Dom.el('button', { class: 'dialog-btn secondary', text: this.t('design.resetToken'), disabled: !overridden });
        const controls = [text];
        const row = Dom.el('div', { class: overridden ? 'design-row overridden' : 'design-row' }, [
            Dom.el('div', { class: 'design-name', text: `--${token.name}` }),
            Dom.el('div', { class: 'design-controls' }, controls),
            reset
        ]);
        const commit = async (value) => {
            await this.save({ [token.name]: value });
            this.doc.documentElement.style.removeProperty(`--${token.name}`);
            row.classList.add('overridden');
            reset.disabled = false;
        };
        text.addEventListener('change', (event) => commit(event.target.value));
        text.addEventListener('input', (event) => this.doc.documentElement.style.setProperty(`--${token.name}`, event.target.value));
        reset.addEventListener('click', () => this.resetToken(token.name));
        if (TokenKinds.kind(current) === 'color') {
            const picker = Dom.el('input', { type: 'color', class: 'design-color', value: current });
            picker.addEventListener('input', (event) => {
                text.value = event.target.value;
                this.doc.documentElement.style.setProperty(`--${token.name}`, event.target.value);
            });
            picker.addEventListener('change', (event) => {
                text.value = event.target.value;
                commit(event.target.value);
            });
            controls.unshift(picker);
        }
        return row;
    }

    async save(tokens) {
        try {
            const result = await this.api.invoke('design:set', { module: this.module, tokens });
            this.state.overrides = result.overrides;
            await this.onChange();
            this.status(this.t('design.saved'));
        } catch (error) {
            this.status(this.t('design.error', { message: error.message }));
        }
    }

    async resetToken(name) {
        await this.api.invoke('design:reset', { module: this.module, names: [name] });
        this.doc.documentElement.style.removeProperty(`--${name}`);
        await this.onChange();
        await this.reload();
    }

    cssBody() {
        const area = Dom.el('textarea', { class: 'bm-input design-css', spellcheck: 'false' });
        area.value = this.css;
        const run = (channel, payload) => async () => {
            try {
                await this.api.invoke(channel, payload());
                await this.onChange();
                this.status(this.t('design.saved'));
                if (channel === 'design:resetCss') {
                    area.value = '';
                }
            } catch (error) {
                this.status(this.t('design.error', { message: error.message }));
            }
        };
        return [
            Dom.el('div', { class: 'settings-hint', text: this.t('design.css.hint') }),
            area,
            Dom.el('div', { class: 'settings-actions' }, [
                Dom.el('button', { class: 'dialog-btn', text: this.t('design.css.apply'), onclick: run('design:setCss', () => ({ module: this.module, css: area.value })) }),
                Dom.el('button', { class: 'dialog-btn secondary', text: this.t('design.css.reset'), onclick: run('design:resetCss', () => ({ module: this.module })) })
            ])
        ];
    }

    footer() {
        this.statusLine = Dom.el('div', { class: 'settings-status' });
        const file = Dom.el('input', { type: 'file', accept: '.json,application/json', class: 'hidden', onchange: (event) => this.importFile(event.target.files[0]) });
        return Dom.el('div', { class: 'design-footer' }, [
            Dom.el('div', { class: 'settings-actions' }, [
                Dom.el('button', { class: 'dialog-btn secondary', text: this.t('design.resetScope'), onclick: () => this.resetScope() }),
                Dom.el('button', { class: 'dialog-btn secondary', text: this.t('design.export'), onclick: () => this.exportFile() }),
                Dom.el('button', { class: 'dialog-btn secondary', text: this.t('design.import'), onclick: () => file.click() })
            ]),
            file,
            this.statusLine
        ]);
    }

    status(text) {
        if (this.statusLine) {
            this.statusLine.textContent = text;
        }
    }

    async resetScope() {
        if (!(await this.dialogs.confirm(this.t('design.resetConfirm'), { danger: true }))) {
            return;
        }
        await this.api.invoke('design:reset', { module: this.module });
        await this.api.invoke('design:resetCss', { module: this.module });
        await this.onChange();
        await this.reload();
    }

    async exportFile() {
        const data = await this.api.invoke('design:export');
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const link = Dom.el('a', { href: URL.createObjectURL(blob), download: this.t('design.exportFile') });
        link.click();
    }

    async importFile(file) {
        if (!file) {
            return;
        }
        try {
            await this.api.invoke('design:import', { data: JSON.parse(await file.text()) });
            await this.onChange();
            await this.reload();
            this.status(this.t('design.imported'));
        } catch (error) {
            this.status(this.t('design.error', { message: error.message }));
        }
    }
}
