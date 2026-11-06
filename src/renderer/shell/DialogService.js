import { Dom } from './Dom.js';

export class DialogService {
    constructor(root, i18n) {
        this.root = root;
        this.i18n = i18n;
    }

    confirm(message, { confirmText = this.i18n.t('dialog.yes'), cancelText = this.i18n.t('dialog.cancel'), danger = false } = {}) {
        return new Promise((resolve) => {
            const close = (result) => {
                backdrop.remove();
                document.removeEventListener('keydown', onKey);
                resolve(result);
            };
            const onKey = (event) => {
                if (event.key === 'Escape') {
                    close(false);
                }
            };
            const confirmButton = Dom.el('button', {
                class: danger ? 'dialog-btn danger' : 'dialog-btn',
                text: confirmText,
                onclick: () => close(true)
            });
            const backdrop = Dom.el('div', { class: 'dialog-backdrop' }, [
                Dom.el('div', { class: 'dialog', role: 'dialog' }, [
                    Dom.el('div', { class: 'dialog-text', text: message }),
                    Dom.el('div', { class: 'dialog-actions' }, [
                        Dom.el('button', { class: 'dialog-btn secondary', text: cancelText, onclick: () => close(false) }),
                        confirmButton
                    ])
                ])
            ]);
            document.addEventListener('keydown', onKey);
            this.root.append(backdrop);
            confirmButton.focus();
        });
    }
}
