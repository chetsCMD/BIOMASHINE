import { Dom } from './Dom.js';

export class TrashView {
    constructor({ api, i18n, dialogs }) {
        this.api = api;
        this.i18n = i18n;
        this.dialogs = dialogs;
    }

    t(key, params) {
        return this.i18n.t(key, params);
    }

    hasKey(translationKey) {
        if (typeof this.i18n.has === 'function') return this.i18n.has(translationKey);
        return this.t(translationKey) !== translationKey;
    }

    resolveLabel(item) {
        const rawLabel = String(item.label || '');
        const sep = rawLabel.indexOf(':');
        const labelKey = sep > 0 ? rawLabel.slice(0, sep) : rawLabel;
        const suffix = sep > 0 ? rawLabel.slice(sep + 1) : '';
        if (labelKey && this.hasKey(labelKey)) {
            const text = this.t(labelKey);
            return suffix ? `${text} (${suffix})` : text;
        }
        return item.channel;
    }

    async render(container) {
        const status = Dom.el('div', { class: 'settings-status' });
        const list = Dom.el('div', { class: 'trash-list' });
        const draw = async () => {
            Dom.clear(list);
            try {
                const items = await this.api.invoke('trash:list');
                if (!Array.isArray(items) || items.length === 0) {
                    list.append(Dom.el('div', { class: 'empty', text: this.t('trash.empty') }));
                    return;
                }
                for (const item of items) {
                    list.append(this.row(item, draw, status));
                }
            } catch (error) {
                status.textContent = error.message;
            }
        };
        await draw();
        Dom.clear(container).append(
            Dom.el('div', { class: 'settings-hint', text: this.t('trash.info') }),
            list,
            status
        );
    }

    row(item, redraw, status) {
        const label = this.resolveLabel(item);
        const undo = Dom.el('button', {
            class: 'dialog-btn secondary',
            text: this.t('trash.undo'),
            onclick: async () => {
                const confirmed = await this.dialogs.confirm(this.t('trash.confirm', { label }), {
                    confirmText: this.t('trash.confirmYes'),
                    cancelText: this.t('trash.confirmNo'),
                    danger: true
                });
                if (!confirmed) return;
                status.textContent = '';
                try {
                    await this.api.invoke('trash:undo', { id: item.id });
                    await redraw();
                } catch (error) {
                    status.textContent = error.status === 409 ? this.t('trash.conflict') : error.message;
                }
            }
        });
        return Dom.el('div', { class: 'trash-row' }, [
            Dom.el('div', { class: 'trash-info' }, [
                Dom.el('div', { class: 'trash-label', text: label }),
                Dom.el('div', { class: 'trash-meta', text: `${item.at} · ${this.t('trash.entries', { count: item.entries })}` })
            ]),
            undo
        ]);
    }
}
