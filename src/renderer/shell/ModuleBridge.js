import { MARK, MessageType } from '../sdk/protocol.js';
import { ChannelPolicy } from './ChannelPolicy.js';

export class ModuleBridge {
    static hooks = { onCanvasState: null, canvasEnabled: null, onCanvasLog: null, stateFor: null };
    static live = new Set();

    static broadcastCanvas(message) {
        for (const bridge of [...ModuleBridge.live]) {
            try {
                bridge.canvas(message);
            } catch (error) {
                ModuleBridge.live.delete(bridge);
            }
        }
    }

    static broadcastDesign(provider) {
        for (const bridge of [...ModuleBridge.live]) {
            Promise.resolve(provider(bridge.key()))
                .then((design) => bridge.pushDesign(design))
                .catch(() => ModuleBridge.live.delete(bridge));
        }
    }

    constructor({ api, theme, dialogs, i18n, pluginCss, onPills, onCrash, state = null, onCanvasState = null, canvasEnabled = null }) {
        this.onCanvasState = onCanvasState || ModuleBridge.hooks.onCanvasState;
        ModuleBridge.live.add(this);
        this.canvasEnabled = canvasEnabled || ModuleBridge.hooks.canvasEnabled;
        this.state = state;
        this.pendingSnapshot = null;
        this.api = api;
        this.theme = theme;
        this.dialogs = dialogs;
        this.i18n = i18n;
        this.pluginCss = pluginCss;
        this.onPills = onPills;
        this.onCrash = onCrash;
        this.frame = null;
        this.origin = null;
        this.moduleId = null;
        this.policy = null;
        this.permissions = new Set();
        this.listener = (event) => this.handle(event);
        this.themeListener = (current) => this.send({ type: MessageType.THEME, theme: current });
    }

    attach(frame, descriptor) {
        this.frame = frame;
        this.moduleId = descriptor.id;
        this.origin = descriptor.url.split('/').slice(0, 3).join('/');
        this.policy = new ChannelPolicy(descriptor.channels);
        this.permissions = new Set(Array.isArray(descriptor.permissions) ? descriptor.permissions : []);
        window.addEventListener('message', this.listener);
        this.theme.onChange(this.themeListener);
    }

    detach() {
        window.removeEventListener('message', this.listener);
        this.theme.listeners.delete(this.themeListener);
        this.frame = null;
        this.permissions = new Set();
    }

    send(message) {
        if (this.frame && this.frame.contentWindow) {
            this.frame.contentWindow.postMessage({ bm: MARK, ...message }, this.origin);
        }
    }

    respond(id, outcome) {
        this.send({ type: MessageType.RESPONSE, id, ...outcome });
    }

    async handle(event) {
        const message = event.data;
        if (!this.frame || event.source !== this.frame.contentWindow || event.origin !== this.origin) {
            return;
        }
        if (!message || message.bm !== MARK) {
            return;
        }
        if (message.type === MessageType.HELLO) {
            this.send({ type: MessageType.INIT, theme: this.theme.current(), cssUrls: this.pluginCss, i18n: await this.bundle(), timezone: await this.timezone(), design: await this.design(), state: this.state || (ModuleBridge.hooks.stateFor ? ModuleBridge.hooks.stateFor(this.key()) : null), canvas: await this.layout() });
        } else if (message.type === MessageType.SNAPSHOT_RESPONSE) {
            if (this.pendingText) {
                this.pendingText(message.lines);
            }
        } else if (message.type === MessageType.CANVAS_LOG) {
            if (ModuleBridge.hooks.onCanvasLog) {
                ModuleBridge.hooks.onCanvasLog(this.key() || 'module', String(message.text));
            }
        } else if (message.type === MessageType.CANVAS_REQUEST) {
            if (/^module:[a-z][a-z0-9-]*$/.test(message.scope)) {
                this.layout(message.scope).then((canvas) => this.send({ type: MessageType.CANVAS_INIT, canvas }));
            }
        } else if (message.type === MessageType.CANVAS_STATE) {
            if (this.onCanvasState) {
                this.onCanvasState(message.state);
            }
        } else if (message.type === MessageType.LAYOUT_CHANGE) {
            if (/^module:[a-z][a-z0-9-]*$/.test(message.scope) && (!this.key() || message.scope === `module:${this.key()}`)) {
                this.api.invoke('layout:save', { scope: message.scope, layout: message.layout }).catch(() => {});
            }
        } else if (message.type === MessageType.STATE_RESPONSE) {
            if (this.pendingSnapshot) {
                this.pendingSnapshot(message.state);
            }
        } else if (message.type === MessageType.PILLS) {
            this.onPills(Array.isArray(message.items) ? message.items.map(String) : []);
        } else if (message.type === MessageType.CRASH) {
            this.onCrash(message.message);
        } else if ([MessageType.INVOKE, MessageType.CONFIG, MessageType.CONFIRM].includes(message.type)) {
            await this.answer(message);
        }
    }

    async timezone() {
        try {
            return (await this.api.invoke('settings:get')).timezone;
        } catch (error) {
            return 'system';
        }
    }

    async design() {
        try {
            const [tokens, css] = await Promise.all([
                this.api.invoke('design:get', { module: this.key() }),
                this.api.invoke('design:getCss', { module: this.key() })
            ]);
            return { tokens: tokens.effective || {}, customCss: css.effective || '' };
        } catch (error) {
            return { tokens: {}, customCss: '' };
        }
    }

    async layout(scope = `module:${this.key()}`) {
        try {
            const [layout, config] = await Promise.all([
                this.api.invoke('layout:get', { scope }),
                this.api.invoke('config:get', { name: 'canvas' })
            ]);
            return { layout: layout.layout || null, config, enabled: this.canvasEnabled ? this.canvasEnabled() : false };
        } catch (error) {
            return { layout: null, config: null, enabled: false };
        }
    }

    key() {
        const direct = this.moduleId || (this.descriptor && this.descriptor.id) || (this.module && this.module.id);
        if (direct) {
            return direct;
        }
        const frame = this.frame || this.iframe;
        try {
            return new URL(frame.src).hostname;
        } catch (error) {
            return null;
        }
    }

    canvas(message) {
        if (message.target && this.key() && message.target !== this.key()) {
            return;
        }
        this.send({ type: MessageType.CANVAS_COMMAND, ...message });
    }

    textLines(limits, timeoutMs) {
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                this.pendingText = null;
                resolve(null);
            }, timeoutMs);
            this.pendingText = (lines) => {
                clearTimeout(timer);
                this.pendingText = null;
                resolve(lines);
            };
            this.send({ type: MessageType.SNAPSHOT_REQUEST, limits });
        });
    }

    snapshot(timeoutMs) {
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                this.pendingSnapshot = null;
                resolve(null);
            }, timeoutMs);
            this.pendingSnapshot = (state) => {
                clearTimeout(timer);
                this.pendingSnapshot = null;
                resolve(state);
            };
            this.send({ type: MessageType.STATE_REQUEST });
        });
    }

    pushDesign(design) {
        this.send({ type: MessageType.DESIGN, tokens: design.tokens, customCss: design.customCss });
    }

    async bundle() {
        try {
            return await this.api.invoke('i18n:bundle', { scope: this.moduleId });
        } catch (error) {
            return { language: this.i18n.language, locale: this.i18n.locale, strings: {} };
        }
    }

    deny(channel) {
        const denied = new Error(this.i18n.t('bridge.denied', { channel }));
        denied.status = 403;
        return denied;
    }

    async execute(message) {
        if (message.type === MessageType.CONFIG) {
            return this.api.invoke('config:get', { name: message.name });
        }
        if (message.type === MessageType.CONFIRM) {
            return this.dialogs.confirm(String(message.message), message.options || {});
        }
        if (typeof message.channel === 'string' && message.channel.startsWith('storage:')) {
            return this.api.invoke(message.channel, { ...(message.payload || {}), module: this.key() });
        }
        if (typeof message.channel === 'string' && message.channel.startsWith('notifications:')) {
            if (!this.permissions.has('notifications')) {
                throw this.deny(message.channel);
            }
            return this.api.invoke(message.channel, { ...(message.payload || {}), module: this.key() });
        }
        if (!this.policy.allows(message.channel)) {
            throw this.deny(message.channel);
        }
        return this.api.invoke(message.channel, message.payload);
    }

    async answer(message) {
        try {
            this.respond(message.id, { ok: true, data: await this.execute(message) });
        } catch (error) {
            this.respond(message.id, { ok: false, error: error.message, status: error.status || 500 });
        }
    }
}
