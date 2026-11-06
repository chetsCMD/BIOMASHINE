import { MARK, MessageType } from '../sdk/protocol.js';
import { ChannelPolicy } from './ChannelPolicy.js';

export class ModuleBridge {
    constructor({ api, theme, dialogs, i18n, pluginCss, onPills, onCrash }) {
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
        this.listener = (event) => this.handle(event);
        this.themeListener = (current) => this.send({ type: MessageType.THEME, theme: current });
    }

    attach(frame, descriptor) {
        this.frame = frame;
        this.moduleId = descriptor.id;
        this.origin = descriptor.url.split('/').slice(0, 3).join('/');
        this.policy = new ChannelPolicy(descriptor.channels);
        window.addEventListener('message', this.listener);
        this.theme.onChange(this.themeListener);
    }

    detach() {
        window.removeEventListener('message', this.listener);
        this.theme.listeners.delete(this.themeListener);
        this.frame = null;
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
            this.send({ type: MessageType.INIT, theme: this.theme.current(), cssUrls: this.pluginCss, i18n: await this.bundle(), timezone: await this.timezone() });
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

    async bundle() {
        try {
            return await this.api.invoke('i18n:bundle', { scope: this.moduleId });
        } catch (error) {
            return { language: this.i18n.language, locale: this.i18n.locale, strings: {} };
        }
    }

    async execute(message) {
        if (message.type === MessageType.CONFIG) {
            return this.api.invoke('config:get', { name: message.name });
        }
        if (message.type === MessageType.CONFIRM) {
            return this.dialogs.confirm(String(message.message), message.options || {});
        }
        if (typeof message.channel === 'string' && message.channel.startsWith('storage:')) {
            return this.api.invoke(message.channel, { ...(message.payload || {}), module: this.moduleId });
        }
        if (!this.policy.allows(message.channel)) {
            const denied = new Error(this.i18n.t('bridge.denied', { channel: message.channel }));
            denied.status = 403;
            throw denied;
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
