import { SplitView } from './SplitView.js';

export class ModuleHost {
    constructor({ container, api, theme, dialogs, i18n, splitRatio, onPills, onClosePane }) {
        this.container = container;
        this.pluginCss = [];
        this.onPills = onPills;
        this.onClosePane = onClosePane;
        this.view = new SplitView({
            container,
            api,
            theme,
            dialogs,
            i18n,
            splitRatio,
            pluginCss: this.pluginCss,
            onPills: (items) => this.onPills(items),
            onClosePane: (role) => this.onClosePane(role)
        });
    }

    setPluginCss(urls) {
        this.pluginCss = Array.isArray(urls) ? urls : [];
        this.view.setPluginCss(this.pluginCss);
    }

    open(descriptor) {
        this.view.open(descriptor);
    }

    openSplit(primary, secondary) {
        this.view.openSplit(primary, secondary);
    }

    removePane(role) {
        return this.view.removePane(role);
    }

    close() {
        this.view.close();
    }
}
