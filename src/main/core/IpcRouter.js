class IpcRouter {
    constructor(auth, config) {
        this.auth = auth;
        this.channelName = config.get('app.ipc.channel');
        this.openPrefixes = config.get('app.ipc.openPrefixes', []);
        this.handlers = new Map();
    }

    register(controller) {
        for (const [name, handler] of Object.entries(controller.routes())) {
            this.handlers.set(`${controller.prefix}:${name}`, handler.bind(controller));
        }
        return this;
    }

    isOpen(channel) {
        return this.openPrefixes.some((prefix) => channel.startsWith(prefix));
    }

    async dispatch(channel, payload) {
        const handler = this.handlers.get(channel);
        if (!handler) {
            return { ok: false, status: 404, error: `Неизвестный канал: ${channel}` };
        }
        if (!this.isOpen(channel) && !this.auth.isUnlocked()) {
            return { ok: false, status: 401, error: 'Требуется вход' };
        }
        try {
            const data = await handler(payload || {});
            return { ok: true, data: data === undefined ? null : data };
        } catch (error) {
            return { ok: false, status: error.status || 500, error: error.message };
        }
    }

    attach(ipcMain) {
        ipcMain.handle(this.channelName, (event, channel, payload) => this.dispatch(channel, payload));
    }
}

module.exports = IpcRouter;
