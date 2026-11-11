import { Dom } from './Dom.js';

export class ShortcutEditor {
    constructor({ api, i18n }) {
        this.api = api;
        this.i18n = i18n;
        this.root = null;
        this.items = [];
        this.recording = null;
        this.error = null;
        this.onKeyDown = (event) => this.handleKeyDown(event);
    }

    t(key, params) {
        return this.i18n.t(key, params);
    }

    isMac() {
        return typeof navigator !== 'undefined' && /Mac/.test(navigator.platform || '');
    }

    codeLabel(code) {
        if (code.startsWith('Key')) {
            return code.slice(3);
        }
        if (code.startsWith('Digit')) {
            return code.slice(5);
        }
        return code;
    }

    bindingLabel(binding) {
        const mac = this.isMac();
        const parts = [];
        if (binding.ctrlOrMeta) {
            parts.push(mac ? 'Cmd' : 'Ctrl');
        }
        if (binding.shift) {
            parts.push('Shift');
        }
        if (binding.alt) {
            parts.push(mac ? 'Option' : 'Alt');
        }
        parts.push(this.codeLabel(binding.code));
        return parts.join('+');
    }

    titleOf(item) {
        return this.t(item.titleKey || item.id);
    }

    render(items, container) {
        this.stopRecording();
        this.items = items || [];
        this.root = container;
        this.error = null;
        this.draw();
    }

    draw() {
        if (!this.root) {
            return;
        }
        const rows = this.items.map((item) => this.row(item));
        const actions = Dom.el('div', { class: 'settings-actions' }, [
            Dom.el('button', {
                type: 'button',
                class: 'dialog-btn secondary',
                text: this.t('settings.shortcuts.resetAll'),
                onclick: () => this.resetAll()
            })
        ]);
        const status = this.error
            ? Dom.el('div', { class: 'form-error', text: this.error })
            : Dom.el('div', { class: 'settings-status' });
        Dom.clear(this.root).append(
            Dom.el('div', { class: 'shortcut-list' }, rows),
            actions,
            status
        );
    }

    row(item) {
        const recording = this.recording === item.id;
        const value = Dom.el('button', {
            type: 'button',
            class: `shortcut-value${recording ? ' recording' : ''}${item.custom ? ' custom' : ''}`,
            text: recording ? this.t('settings.shortcuts.press') : this.bindingLabel(item.binding),
            onclick: () => this.toggleRecording(item.id)
        });
        const reset = Dom.el('button', {
            type: 'button',
            class: 'dialog-btn secondary shortcut-reset',
            text: this.t('settings.shortcuts.reset'),
            disabled: !item.custom,
            onclick: () => this.reset(item.id)
        });
        return Dom.el('div', { class: 'settings-row shortcut-row' }, [
            Dom.el('div', { class: 'settings-label' }, [
                Dom.el('div', { class: 'settings-name', text: this.titleOf(item) }),
                item.custom ? Dom.el('div', { class: 'settings-hint', text: this.t('settings.shortcuts.custom') }) : null
            ]),
            Dom.el('div', { class: 'shortcut-controls' }, [value, reset])
        ]);
    }

    toggleRecording(id) {
        if (this.recording === id) {
            this.stopRecording();
            this.draw();
            return;
        }
        if (this.recording) {
            this.stopRecording();
        }
        this.recording = id;
        this.error = null;
        document.addEventListener('keydown', this.onKeyDown, true);
        this.draw();
    }

    stopRecording() {
        this.recording = null;
        if (typeof document !== 'undefined') {
            document.removeEventListener('keydown', this.onKeyDown, true);
        }
    }

    isVisible() {
        if (!this.root || !this.root.isConnected) {
            return false;
        }
        let node = this.root;
        while (node && node !== document.body) {
            if (node.classList && node.classList.contains('hidden')) {
                return false;
            }
            node = node.parentElement;
        }
        return true;
    }

    async handleKeyDown(event) {
        if (!this.recording) {
            return;
        }
        if (!this.isVisible()) {
            this.stopRecording();
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (event.code === 'Escape') {
            this.stopRecording();
            this.draw();
            return;
        }
        if (event.code === 'Tab' || event.code === 'Enter') {
            return;
        }
        if (!event.code) {
            return;
        }
        const binding = {
            code: event.code,
            ctrlOrMeta: Boolean(event.ctrlKey || event.metaKey),
            shift: Boolean(event.shiftKey),
            alt: Boolean(event.altKey)
        };
        await this.save(this.recording, binding);
    }

    async save(id, binding) {
        try {
            this.items = await this.api.invoke('shortcuts:set', { id, binding });
            this.error = null;
            this.stopRecording();
            this.draw();
        } catch (err) {
            this.error = this.describeError(err);
            this.stopRecording();
            this.draw();
        }
    }

    describeError(err) {
        const message = err && err.message ? err.message : String(err);
        const titles = this.items
            .filter((item) => message.includes(item.id))
            .map((item) => this.titleOf(item));
        if (titles.length > 0) {
            return this.t('settings.shortcuts.conflict', { title: titles.join(', ') });
        }
        return message;
    }

    async reset(id) {
        try {
            this.items = await this.api.invoke('shortcuts:reset', { id });
            this.error = null;
            this.draw();
        } catch (err) {
            this.error = err && err.message ? err.message : String(err);
            this.draw();
        }
    }

    async resetAll() {
        try {
            this.items = await this.api.invoke('shortcuts:reset', {});
            this.error = null;
            this.draw();
        } catch (err) {
            this.error = err && err.message ? err.message : String(err);
            this.draw();
        }
    }
}
