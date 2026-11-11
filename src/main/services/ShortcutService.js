const AppError = require('../core/AppError');

const FUNCTION_KEY = /^F([1-9]|1[0-2])$/;
const LETTER_KEY = /^Key[A-Z]$/;
const DIGIT_KEY = /^Digit[0-9]$/;
const FORBIDDEN_KEYS = new Set(['Escape', 'Tab', 'Enter']);

class ShortcutService {
    constructor({ defaults, settings, actions }) {
        this.defaults = defaults;
        this.settings = settings;
        this.actions = actions || {};
    }

    bind(actions) {
        this.actions = actions || {};
        return this;
    }

    ids() {
        return Object.keys(this.defaults);
    }

    normalize(binding) {
        return {
            code: binding.code,
            ctrlOrMeta: Boolean(binding.ctrlOrMeta),
            shift: Boolean(binding.shift),
            alt: Boolean(binding.alt)
        };
    }

    defaultBinding(id) {
        return this.normalize(this.defaults[id]);
    }

    overrides() {
        const stored = this.settings.get('shortcuts');
        return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
    }

    bindingOf(id) {
        const override = this.overrides()[id];
        return override ? this.normalize(override) : this.defaultBinding(id);
    }

    bindings() {
        const overrides = this.overrides();
        const result = {};
        for (const id of this.ids()) {
            result[id] = overrides[id] ? this.normalize(overrides[id]) : this.defaultBinding(id);
        }
        return result;
    }

    list() {
        const overrides = this.overrides();
        return this.ids().map((id) => ({
            id,
            titleKey: `shortcut.${id}`,
            binding: this.bindingOf(id),
            defaultBinding: this.defaultBinding(id),
            custom: Boolean(overrides[id])
        }));
    }

    sameBinding(a, b) {
        return a.code === b.code &&
            Boolean(a.ctrlOrMeta) === Boolean(b.ctrlOrMeta) &&
            Boolean(a.shift) === Boolean(b.shift) &&
            Boolean(a.alt) === Boolean(b.alt);
    }

    conflicting(normalized, excludeId) {
        const result = [];
        for (const [id, binding] of Object.entries(this.bindings())) {
            if (id === excludeId) {
                continue;
            }
            if (this.sameBinding(binding, normalized)) {
                result.push(id);
            }
        }
        return result;
    }

    validate(binding, excludeId) {
        if (!binding || typeof binding !== 'object') {
            throw AppError.badRequest('shortcut.invalidBinding');
        }
        const code = binding.code;
        if (typeof code !== 'string' || code.length === 0) {
            throw AppError.badRequest('shortcut.invalidCode');
        }
        if (FORBIDDEN_KEYS.has(code)) {
            throw AppError.badRequest('shortcut.reservedKey', { code });
        }
        const isFunction = FUNCTION_KEY.test(code);
        if (!isFunction && !LETTER_KEY.test(code) && !DIGIT_KEY.test(code)) {
            throw AppError.badRequest('shortcut.invalidCodeValue', { code });
        }
        const normalized = this.normalize(binding);
        const hasModifier = normalized.ctrlOrMeta || normalized.shift || normalized.alt;
        if (!hasModifier && !isFunction) {
            throw AppError.badRequest('shortcut.modifierRequired');
        }
        const conflicts = this.conflicting(normalized, excludeId);
        if (conflicts.length > 0) {
            throw AppError.badRequest('shortcut.alreadyAssigned', { conflicts: conflicts.join(', ') });
        }
        return normalized;
    }

    set(id, binding) {
        if (!this.ids().includes(id)) {
            throw AppError.badRequest('shortcut.unknownAction', { id });
        }
        const normalized = this.validate(binding, id);
        const overrides = { ...this.overrides(), [id]: normalized };
        this.settings.set('shortcuts', overrides);
        return this.list();
    }

    reset(id) {
        if (id !== undefined && id !== null && !this.ids().includes(id)) {
            throw AppError.badRequest('shortcut.unknownAction', { id });
        }
        if (id === undefined || id === null) {
            this.settings.set('shortcuts', {});
        } else {
            const overrides = { ...this.overrides() };
            delete overrides[id];
            this.settings.set('shortcuts', overrides);
        }
        return this.list();
    }

    match(input) {
        if (input.type !== 'keyDown') {
            return null;
        }
        const inputBinding = {
            code: input.code,
            ctrlOrMeta: Boolean(input.control || input.meta),
            shift: Boolean(input.shift),
            alt: Boolean(input.alt)
        };
        for (const [id, binding] of Object.entries(this.bindings())) {
            if (this.sameBinding(binding, inputBinding)) {
                return id;
            }
        }
        return null;
    }

    attach(contents) {
        contents.on('before-input-event', (event, input) => {
            const id = this.match(input);
            if (id && this.actions && this.actions[id]) {
                event.preventDefault();
                this.actions[id]();
            }
        });
    }
}

module.exports = ShortcutService;