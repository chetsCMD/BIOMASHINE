export class Api {
    invoke(channel, payload) {
        return window.api.invoke(channel, payload);
    }

    onShortcut(handler) {
        window.api.onShortcut(handler);
    }

    onBeforeClose(handler) {
        window.api.onBeforeClose(handler);
    }

    onWindowState(handler) {
        window.api.onWindowState(handler);
    }
}
