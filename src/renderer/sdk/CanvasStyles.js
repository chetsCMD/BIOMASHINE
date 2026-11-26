export class CanvasStyles {
    static PROPERTIES = ['translate', 'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'flex', 'z-index', 'position', 'display', 'box-sizing'];
    static saved = new WeakMap();
    static texts = new WeakMap();

    static read(element) {
        const values = {};
        for (const name of CanvasStyles.PROPERTIES) {
            values[name] = element.style.getPropertyValue(name);
        }
        return values;
    }

    static write(element, values) {
        for (const name of CanvasStyles.PROPERTIES) {
            if (values[name]) {
                element.style.setProperty(name, values[name]);
            } else {
                element.style.removeProperty(name);
            }
        }
    }

    static text(element, item, skipText) {
        if (skipText || element.children.length > 0) {
            return;
        }
        if (item.text === undefined) {
            if (CanvasStyles.texts.has(element)) {
                element.textContent = CanvasStyles.texts.get(element);
                CanvasStyles.texts.delete(element);
            }
            return;
        }
        if (!CanvasStyles.texts.has(element)) {
            CanvasStyles.texts.set(element, element.textContent);
        }
        if (element.textContent !== item.text) {
            element.textContent = item.text;
        }
    }

    static remember(element) {
        if (!CanvasStyles.saved.has(element)) {
            CanvasStyles.saved.set(element, CanvasStyles.read(element));
        }
    }

    static restore(element) {
        const saved = CanvasStyles.saved.get(element);
        if (saved) {
            CanvasStyles.write(element, saved);
            CanvasStyles.saved.delete(element);
        }
        if (CanvasStyles.texts.has(element)) {
            element.textContent = CanvasStyles.texts.get(element);
            CanvasStyles.texts.delete(element);
        }
    }

    static suspend(element) {
        const current = CanvasStyles.read(element);
        CanvasStyles.write(element, CanvasStyles.saved.get(element) || {});
        return current;
    }

    static resume(element, values) {
        CanvasStyles.write(element, values);
    }

    static apply(element, item, win, skipText = false) {
        CanvasStyles.remember(element);
        CanvasStyles.text(element, item, skipText);
        CanvasStyles.write(element, CanvasStyles.saved.get(element));
        const set = (name, value, priority = '') => element.style.setProperty(name, value, priority);
        const computed = win.getComputedStyle(element);
        if (item.dx || item.dy) {
            set('translate', `${item.dx || 0}px ${item.dy || 0}px`);
        }
        if (item.w || item.h) {
            if (computed.display === 'inline') {
                set('display', 'inline-block');
            }
            set('box-sizing', 'border-box');
            set('max-width', 'none');
            set('max-height', 'none');
            const parent = element.parentElement;
            if (parent && /flex|grid/.test(win.getComputedStyle(parent).display)) {
                set('flex', 'none');
            }
        }
        if (item.w) {
            set('width', `${item.w}px`);
            set('min-width', '0');
        }
        if (item.h) {
            set('height', `${item.h}px`);
            set('min-height', '0');
        }
        if (item.z) {
            set('z-index', String(item.z));
            if (computed.position === 'static') {
                set('position', 'relative');
            }
        }
        if (item.hidden) {
            set('display', 'none', 'important');
        }
    }
}
