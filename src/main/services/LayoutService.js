const AppError = require('../core/AppError');

class LayoutService {
    static PREFIX = 'layout.';
    static SCOPE = /^(shell|module:[a-z][a-z0-9-]{0,63}|view:[a-z][a-z0-9-]{0,63})$/;
    static KEY = /^[A-Za-z0-9_@#:>~.-]+$/;

    constructor(store, config) {
        this.store = store;
        this.settings = config.get('canvas');
    }

    key(scope) {
        return `${LayoutService.PREFIX}${scope}`;
    }

    get(scope) {
        return this.store.get(this.key(scope)) || null;
    }

    reset(scope) {
        this.store.remove(this.key(scope));
    }

    integer(value, min, max, key) {
        if (!Number.isFinite(value)) {
            throw AppError.badRequest('layout.invalidItem', { key });
        }
        const rounded = Math.round(value);
        if (rounded < min || rounded > max) {
            throw AppError.badRequest('layout.invalidItem', { key });
        }
        return rounded;
    }

    item(key, raw) {
        const settings = this.settings;
        if (typeof key !== 'string' || key.length > settings.maxKeyLength || !LayoutService.KEY.test(key) || !raw || typeof raw !== 'object' || Array.isArray(raw)) {
            throw AppError.badRequest('layout.invalidItem', { key: String(key).slice(0, settings.maxKeyLength) });
        }
        const item = {
            dx: this.integer(raw.dx === undefined ? 0 : raw.dx, -settings.maxOffsetPx, settings.maxOffsetPx, key),
            dy: this.integer(raw.dy === undefined ? 0 : raw.dy, -settings.maxOffsetPx, settings.maxOffsetPx, key)
        };
        if (raw.w !== undefined) item.w = this.integer(raw.w, 1, settings.maxSizePx, key);
        if (raw.h !== undefined) item.h = this.integer(raw.h, 1, settings.maxSizePx, key);
        if (raw.z !== undefined) {
            const z = this.integer(raw.z, 0, settings.zMax, key);
            if (z > 0) item.z = z;
        }
        if (raw.hidden === true) item.hidden = true;
        if (raw.text !== undefined) {
            if (typeof raw.text !== 'string' || raw.text.length > settings.maxTextLength) {
                throw AppError.badRequest('layout.invalidItem', { key });
            }
            item.text = raw.text;
        }
        const plain = item.dx === 0 && item.dy === 0 && item.w === undefined && item.h === undefined && item.z === undefined && !item.hidden && item.text === undefined;
        return plain ? null : item;
    }

    save(scope, layout) {
        if (!layout || typeof layout !== 'object' || Array.isArray(layout) || layout.version !== 2 || !layout.items || typeof layout.items !== 'object' || Array.isArray(layout.items)) {
            throw AppError.badRequest('layout.invalid');
        }
        const entries = Object.entries(layout.items);
        if (entries.length > this.settings.maxItems) {
            throw AppError.badRequest('layout.tooManyItems', { max: this.settings.maxItems });
        }
        const items = {};
        for (const [key, raw] of entries) {
            const item = this.item(key, raw);
            if (item) {
                items[key] = item;
            }
        }
        const normalized = { version: 2, items };
        if (JSON.stringify(normalized).length > this.settings.maxLayoutBytes) {
            throw AppError.badRequest('layout.tooLarge', { max: this.settings.maxLayoutBytes });
        }
        this.store.set(this.key(scope), normalized);
        return normalized;
    }
}

module.exports = LayoutService;
