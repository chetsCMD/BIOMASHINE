import { SplitPane } from './SplitPane.js';
import { Splitter } from './Splitter.js';

export class SplitView {
    constructor({ container, api, theme, dialogs, i18n, pluginCss, splitRatio, onPills, onClosePane }) {
        this.container = container;
        this.api = api;
        this.theme = theme;
        this.dialogs = dialogs;
        this.i18n = i18n;
        this.pluginCss = Array.isArray(pluginCss) ? pluginCss : [];
        this.splitRatio = splitRatio;
        this.onPills = onPills;
        this.onClosePane = onClosePane;
        this.left = null;
        this.right = null;
        this.single = null;
        this.splitter = null;
        this.ratio = splitRatio.default;
    }

    setPluginCss(urls) {
        this.pluginCss = Array.isArray(urls) ? urls : [];
    }

    open(descriptor) {
        this.close();
        this.single = this.createPane(descriptor, 'single');
        this.single.mount(this.container);
    }

    openSplit(primary, secondary) {
        this.close();
        this.container.classList.add('mv-split');
        this.left = this.createPane(primary, 'left');
        this.right = this.createPane(secondary, 'right');
        this.left.mount(this.container);
        this.splitter = new Splitter({
            ratio: this.splitRatio,
            initial: this.ratio,
            onRatio: (r) => this.applyRatio(r)
        });
        this.container.append(this.splitter.element);
        this.right.mount(this.container);
        this.applyRatio(this.ratio);
    }

    createPane(descriptor, role) {
        return new SplitPane({
            role,
            descriptor,
            api: this.api,
            theme: this.theme,
            dialogs: this.dialogs,
            i18n: this.i18n,
            pluginCss: this.pluginCss,
            onPills: this.onPills,
            onClose: (r) => this.onClosePane(r)
        });
    }

    applyRatio(ratio) {
        this.ratio = this.splitRatio.clamp(ratio);
        if (this.left) {
            this.left.element.style.flex = `0 0 ${this.splitRatio.toPercent(this.ratio)}`;
        }
        if (this.right) {
            this.right.element.style.flex = '1 1 0';
        }
    }

    removePane(role) {
        let removed = null;
        if (role === 'right' && this.right) {
            removed = this.right.descriptor;
            this.right.destroy();
            this.right = null;
            if (this.left) {
                this.left.setRole('single');
                this.single = this.left;
                this.left = null;
            }
        } else if (role === 'left' && this.left) {
            removed = this.left.descriptor;
            this.left.destroy();
            this.left = null;
            if (this.right) {
                this.right.setRole('single');
                this.single = this.right;
                this.right = null;
            }
        }
        if (this.splitter) {
            this.splitter.destroy();
            this.splitter = null;
        }
        this.container.classList.remove('mv-split');
        return removed;
    }

    close() {
        if (this.left) {
            this.left.destroy();
        }
        if (this.right) {
            this.right.destroy();
        }
        if (this.single) {
            this.single.destroy();
        }
        if (this.splitter) {
            this.splitter.destroy();
        }
        this.left = null;
        this.right = null;
        this.single = null;
        this.splitter = null;
        this.container.classList.remove('mv-split');
    }
}
