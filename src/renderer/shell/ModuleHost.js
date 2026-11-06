import { Dom } from './Dom.js';
import { ModuleBridge } from './ModuleBridge.js';

export class ModuleHost {
    constructor({ container, api, theme, dialogs, i18n, onPills }) {
        this.container = container;
        this.api = api;
        this.theme = theme;
        this.dialogs = dialogs;
        this.i18n = i18n;
        this.onPills = onPills;
        this.bridge = null;
        this.frame = null;
        this.overlay = null;
        this.descriptor = null;
        this.pluginCss = [];
    }

    setPluginCss(urls) {
        this.pluginCss = urls;
    }

    open(descriptor) {
        this.close();
        this.descriptor = descriptor;
        this.bridge = new ModuleBridge({
            api: this.api,
            theme: this.theme,
            dialogs: this.dialogs,
            i18n: this.i18n,
            pluginCss: this.pluginCss,
            onPills: this.onPills,
            onCrash: (message) => this.showCrash(message)
        });
        this.frame = Dom.el('iframe', {
            class: 'module-frame',
            title: descriptor.title,
            sandbox: 'allow-scripts allow-same-origin'
        });
        this.bridge.attach(this.frame, descriptor);
        this.container.append(this.frame);
        this.frame.src = descriptor.url;
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
        this.container.append(this.overlay);
    }

    reload() {
        if (this.descriptor) {
            this.open(this.descriptor);
        }
    }

    close() {
        if (this.bridge) {
            this.bridge.detach();
            this.bridge = null;
        }
        if (this.frame) {
            this.frame.remove();
            this.frame = null;
        }
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
    }
}
