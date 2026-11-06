import { MARK, MessageType } from './protocol.js';
import { BmClock } from './BmClock.js';
import { DomTranslator } from './DomTranslator.js';
import { ModuleStorage } from './ModuleStorage.js';
import { ThemeStyle } from './ThemeStyle.js';
import { Translator } from './Translator.js';

export class ModuleClient {
    constructor(win) {
        this.win = win;
        this.pending = new Map();
        this.counter = 0;
        this.theme = null;
        this.storage = new ModuleStorage(this);
        this.i18n = new Translator();
        this.clock = new BmClock();
        this.t = (key, params) => this.i18n.t(key, params);
        this.themeListeners = new Set();
        const ancestor = win.location.ancestorOrigins && win.location.ancestorOrigins[0];
        this.parentOrigin = ancestor && ancestor !== 'null' ? ancestor : '*';
        this.ready = new Promise((resolve) => {
            this.resolveReady = resolve;
        });
        win.addEventListener('message', (event) => this.receive(event));
        win.addEventListener('error', (event) => this.reportCrash(event.error || event.message));
        win.addEventListener('unhandledrejection', (event) => this.reportCrash(event.reason));
        this.post({ type: MessageType.HELLO });
    }

    post(message) {
        this.win.parent.postMessage({ bm: MARK, ...message }, this.parentOrigin);
    }

    request(type, body) {
        const id = ++this.counter;
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            this.post({ type, id, ...body });
        });
    }

    receive(event) {
        const message = event.data;
        if (event.source !== this.win.parent || !message || message.bm !== MARK) {
            return;
        }
        if (message.type === MessageType.INIT) {
            this.applyTheme(message.theme);
            this.attachStyles(message.cssUrls || []);
            this.applyLanguage(message.i18n || Translator.EMPTY);
            this.clock = new BmClock(message.timezone);
            this.resolveReady(this);
        } else if (message.type === MessageType.THEME) {
            this.applyTheme(message.theme);
            this.themeListeners.forEach((listener) => listener(this.theme));
        } else if (message.type === MessageType.RESPONSE) {
            this.settle(message);
        }
    }

    settle({ id, ok, data, error, status }) {
        const entry = this.pending.get(id);
        if (!entry) {
            return;
        }
        this.pending.delete(id);
        if (ok) {
            entry.resolve(data);
            return;
        }
        const failure = new Error(error);
        failure.status = status;
        entry.reject(failure);
    }

    applyTheme(theme) {
        ThemeStyle.apply(this.win.document, theme);
        this.theme = theme;
    }

    applyLanguage(bundle) {
        this.i18n.load(bundle);
        const doc = this.win.document;
        doc.documentElement.lang = bundle.language;
        if (doc.querySelectorAll) {
            DomTranslator.apply(doc, this.i18n);
        }
    }

    get language() {
        return this.i18n.language;
    }

    get locale() {
        return this.i18n.locale;
    }

    attachStyles(urls) {
        for (const href of urls) {
            const link = this.win.document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            this.win.document.head.append(link);
        }
    }

    onTheme(listener) {
        this.themeListeners.add(listener);
        return () => this.themeListeners.delete(listener);
    }

    invoke(channel, payload) {
        return this.request(MessageType.INVOKE, { channel, payload });
    }

    config(name) {
        return this.request(MessageType.CONFIG, { name });
    }

    confirm(message, options = {}) {
        return this.request(MessageType.CONFIRM, { message, options });
    }

    setPills(items) {
        this.post({ type: MessageType.PILLS, items });
    }

    reportCrash(reason) {
        const message = reason && reason.message ? reason.message : String(reason);
        this.post({ type: MessageType.CRASH, message });
    }
}
