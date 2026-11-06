export class Api {
    invoke(channel, payload) {
        return window.api.invoke(channel, payload);
    }

    onShortcut(handler) {
        window.api.onShortcut(handler);
    }

    onWindowState(handler) {
        window.api.onWindowState(handler);
    }
}
