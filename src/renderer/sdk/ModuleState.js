export class ModuleState {
    static SKIP_TYPES = new Set(['password', 'file', 'hidden', 'button', 'submit', 'reset', 'image']);

    constructor(win) {
        this.win = win;
        this.settings = { windowMs: 0, maxValueLength: 0 };
        this.custom = new Map();
        this.retry = null;
    }

    configure(settings) {
        this.settings = { ...this.settings, ...settings };
    }

    register(name, handlers) {
        this.custom.set(name, handlers);
        if (this.retry) {
            this.retry();
        }
    }

    static skip(element) {
        return ModuleState.SKIP_TYPES.has(String(element.type).toLowerCase()) || Boolean(element.closest('[data-persist="off"]'));
    }

    capture() {
        const document = this.win.document;
        const controls = {};
        for (const element of document.querySelectorAll('input[id], select[id], textarea[id]')) {
            if (ModuleState.skip(element)) {
                continue;
            }
            const kind = String(element.type).toLowerCase();
            if (kind === 'checkbox' || kind === 'radio') {
                controls[element.id] = { checked: element.checked };
            } else if (!this.settings.maxValueLength || String(element.value).length <= this.settings.maxValueLength) {
                controls[element.id] = { value: element.value };
            }
        }
        const scrolls = {};
        for (const element of document.querySelectorAll('[id]')) {
            if (element.scrollHeight > element.clientHeight && (element.scrollTop || element.scrollLeft)) {
                scrolls[element.id] = { x: element.scrollLeft, y: element.scrollTop };
            }
        }
        const custom = {};
        for (const [name, handlers] of this.custom) {
            custom[name] = handlers.capture();
        }
        return { scroll: { x: this.win.scrollX, y: this.win.scrollY }, scrolls, controls, custom };
    }

    setControl(element, snapshot) {
        const kind = String(element.type).toLowerCase();
        if (snapshot.checked !== undefined) {
            element.checked = snapshot.checked;
        } else {
            element.value = snapshot.value;
        }
        const name = kind === 'checkbox' || kind === 'radio' || kind.startsWith('select') ? 'change' : 'input';
        element.dispatchEvent(new this.win.Event(name, { bubbles: true }));
    }

    restore(data, windowMs) {
        const document = this.win.document;
        const pending = {
            controls: new Map(Object.entries(data.controls || {})),
            scrolls: new Map(Object.entries(data.scrolls || {})),
            custom: new Map(Object.entries(data.custom || {})),
            scroll: data.scroll || null
        };
        const apply = () => {
            for (const [id, snapshot] of pending.controls) {
                const element = document.getElementById(id);
                if (element && !ModuleState.skip(element)) {
                    this.setControl(element, snapshot);
                    pending.controls.delete(id);
                }
            }
            for (const [id, position] of pending.scrolls) {
                const element = document.getElementById(id);
                if (element && element.scrollHeight > element.clientHeight) {
                    element.scrollLeft = position.x;
                    element.scrollTop = position.y;
                    pending.scrolls.delete(id);
                }
            }
            for (const [name, value] of pending.custom) {
                const handlers = this.custom.get(name);
                if (handlers) {
                    handlers.restore(value);
                    pending.custom.delete(name);
                }
            }
            if (pending.scroll) {
                this.win.scrollTo(pending.scroll.x, pending.scroll.y);
                if (Math.abs(this.win.scrollY - pending.scroll.y) < 1) {
                    pending.scroll = null;
                }
            }
            return pending.controls.size + pending.scrolls.size + pending.custom.size === 0 && !pending.scroll;
        };
        if (apply()) {
            return;
        }
        const finish = () => {
            observer.disconnect();
            this.win.clearTimeout(timer);
            this.retry = null;
        };
        const observer = new this.win.MutationObserver(() => {
            if (apply()) {
                finish();
            }
        });
        const timer = this.win.setTimeout(finish, windowMs);
        this.retry = () => {
            if (apply()) {
                finish();
            }
        };
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }
}
