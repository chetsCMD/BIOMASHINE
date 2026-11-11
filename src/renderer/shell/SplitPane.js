import { Dom } from './Dom.js';
import { ModuleBridge } from './ModuleBridge.js';

export class SplitPane {
    constructor({ role, descriptor, api, theme, dialogs, i18n, pluginCss, onPills, onClose }) {
        this.role = role;
        this.descriptor = descriptor;
        this.api = api;
        this.theme = theme;
        this.dialogs = dialogs;
        this.i18n = i18n;
        this.pluginCss = pluginCss;
        this.onPills = onPills;
        this.onClose = onClose;
        this.bridge = null;
        this.overlay = null;
        this.element = Dom.el('div', { class: `mv-pane mv-pane-${role}` });
        this.frame = Dom.el('iframe', {
            class: 'mv-frame',
            title: descriptor.title,
            sandbox: 'allow-scripts allow-same-origin'
        });
    }

    mount(container) {
        this.element.append(this.frame);
        this.addCloseButton();
        container.append(this.element);
        this.attachBridge();
        this.frame.src = this.descriptor.url;
    }

    addCloseButton() {
        if (this.role === 'single') {
            return;
        }
        const close = Dom.el('button', {
            class: 'mv-close',
            title: this.i18n.t('multiView.close'),
            'aria-label': this.i18n.t('multiView.close'),
            onclick: () => this.onClose(this.role)
        });
        close.textContent = '\u2715';
        this.element.append(close);
    }

    attachBridge() {
        this.bridge = new ModuleBridge({
            api: this.api,
            theme: this.theme,
            dialogs: this.dialogs,
            i18n: this.i18n,
            pluginCss: this.pluginCss,
            onPills: this.role === 'right' ? () => {} : (items) => this.onPills(items),
            onCrash: (message) => this.showCrash(message)
        });
        this.bridge.attach(this.frame, this.descriptor);
    }

    showCrash(message) {
        if (this.overlay) {
            return;
        }
        this.overlay = Dom.el('div', { class: 'crash-overlay' }, [
            Dom.el('div', { class: 'crash-title', text: this.i18n.t('crash.title', { title: this.descriptor.title }) }),
            Dom.el('div', { class: 'crash-message', text: message }),
            Dom.el('button', { class: 'dialog-btn', text: this.i18n.t('crash.restart'), onclick: () => this.reload() })
        ]);
        this.element.append(this.overlay);
    }

    reload() {
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
        if (this.bridge) {
            this.bridge.detach();
            this.bridge = null;
        }
        this.attachBridge();
        this.frame.src = this.descriptor.url;
    }

    setRole(role) {
        this.role = role;
        this.element.className = `mv-pane mv-pane-${role}`;
        const close = this.element.querySelector('.mv-close');
        if (close) {
            close.remove();
        }
        this.element.style.flex = '';
    }

    destroy() {
        if (this.bridge) {
            this.bridge.detach();
            this.bridge = null;
        }
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
        this.element.remove();
    }
}
