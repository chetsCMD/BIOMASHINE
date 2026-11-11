class IpcRouter {
    constructor(auth, config, operationLog, messages) {
        this.auth = auth;
        this.operationLog = operationLog || null;
        this.messages = messages || { t: (key) => key };
        this.channelName = config.get('app.ipc.channel');
        this.openPrefixes = config.get('app.ipc.openPrefixes', []);
        this.logSkipPrefixes = config.get('app.ipc.logSkipPrefixes', ['trash:', 'auth:']);
        this.handlers = new Map();
    }

    register(controller) {
        if (!controller || typeof controller.routes !== 'function') {
            const name = controller && controller.constructor ? controller.constructor.name : String(controller);
            const prefix = controller && controller.prefix;
            console.error(`[IpcRouter] controller ${name} (prefix=${prefix}) has no routes() method and is skipped`);
            return this;
        }
        let prefix;
        try {
            prefix = controller.prefix;
        } catch (error) {
            const name = controller.constructor ? controller.constructor.name : String(controller);
            console.error(`[IpcRouter] controller ${name} threw on reading prefix: ${error.message}`);
            return this;
        }
        if (typeof prefix !== 'string' || prefix.length === 0) {
            const name = controller.constructor ? controller.constructor.name : String(controller);
            console.error(`[IpcRouter] controller ${name} has no string prefix and is skipped`);
            return this;
        }
        for (const [name, handler] of Object.entries(controller.routes())) {
            this.handlers.set(`${prefix}:${name}`, handler.bind(controller));
        }
        return this;
    }

    isOpen(channel) {
        return this.openPrefixes.some((prefix) => channel.startsWith(prefix));
    }

    shouldLog(channel) {
        return Boolean(this.operationLog) && !this.logSkipPrefixes.some((prefix) => channel.startsWith(prefix));
    }

    async dispatch(channel, payload) {
        const handler = this.handlers.get(channel);
        if (!handler) {
            return {
                ok: false,
                status: 404,
                error: this.messages.t('error.unknownChannel', { channel }),
                code: 'error.unknownChannel'
            };
        }
        if (!this.isOpen(channel) && !this.auth.isUnlocked()) {
            return {
                ok: false,
                status: 401,
                error: this.messages.t('error.locked'),
                code: 'error.locked'
            };
        }

        const log = this.shouldLog(channel);
        let operationId = null;
        if (log) {
            try {
                operationId = this.operationLog.begin(channel, payload || {});
            } catch (error) {
                console.error(error);
                return {
                    ok: false,
                    status: 500,
                    error: this.messages.t('error.internal')
                };
            }
        }

        let data;
        try {
            data = await handler(payload || {});
        } catch (error) {
            if (log) this.operationLog.abort(operationId);
            if (error && error.name === 'AppError') {
                return {
                    ok: false,
                    status: error.status,
                    error: this.messages.t(error.key, error.params),
                    code: error.key
                };
            }
            console.error(error);
            const status = error && typeof error.status === 'number' ? error.status : 500;
            return {
                ok: false,
                status,
                error: this.messages.t('error.internal')
            };
        }

        if (log) this.operationLog.commit(operationId);
        return { ok: true, data: data === undefined ? null : data };
    }

    attach(ipcMain) {
        ipcMain.handle(this.channelName, (event, channel, payload) => this.dispatch(channel, payload));
    }
}

module.exports = IpcRouter;
