import { SplitView } from './SplitView.js';

export class ModuleHost {
    constructor({ container, api, theme, dialogs, i18n, splitRatio, onPills, onClosePane, onCanvasState = null, canvasEnabled = null }) {
        this.onCanvasState = onCanvasState;
        this.canvasEnabled = canvasEnabled;
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

    open(descriptor, state = null) {
        this.view.open(descriptor);
    }

    openSplit(primary, secondary) {
        this.view.openSplit(primary, secondary);
    }

    removePane(role) {
        return this.view.removePane(role);
    }

    pushDesign(design) {
        if (this.bridge) {
            this.bridge.pushDesign(design);
        }
    }

    close() {
        this.view.close();
    }
}
