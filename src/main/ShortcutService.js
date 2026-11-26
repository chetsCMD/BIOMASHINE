const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const AppError = require('./core/AppError');

class ShortcutService {
    static OVERRIDES = 'shortcuts';
    static CONTEXTUAL = 'shortcuts.context';
    static MACROS = 'shortcuts.macros';

    constructor({ defaults, settings, actions, rules }) {
        this.defaults = defaults;
        this.settings = settings;
        this.actions = actions || {};
        this.rules = rules || JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'config', 'shortcuts.json'), 'utf8'));
        rules = this.rules;
        this.context = 'global';
        this.codePatterns = rules.codes.map((pattern) => new RegExp(pattern));
        this.barePatterns = rules.withoutModifier.map((pattern) => new RegExp(pattern));
        this.forbidden = new Set(rules.forbidden);
        this.contextPattern = new RegExp(rules.contextPattern);
        this.stepPatterns = rules.stepPatterns.map((pattern) => new RegExp(pattern));
    }

    bind(actions) {
        this.actions = actions || {};
        return this;
    }

    macros() {
        const stored = this.settings.get(ShortcutService.MACROS);
        return Array.isArray(stored) ? stored : [];
    }

    ids() {
        return [...Object.keys(this.defaults), ...this.macros().map((macro) => `macro:${macro.id}`)];
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
        return this.defaults[id] ? this.normalize(this.defaults[id]) : null;
    }

    overrides() {
        const stored = this.settings.get(ShortcutService.OVERRIDES);
        return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
    }

    bindingOf(id) {
        const override = this.overrides()[id];
        return override ? this.normalize(override) : this.defaultBinding(id);
    }

    bindings() {
        const result = {};
        for (const id of this.ids()) {
            const binding = this.bindingOf(id);
            if (binding) {
                result[id] = binding;
            }
        }
        return result;
    }

    list() {
        const overrides = this.overrides();
        const names = new Map(this.macros().map((macro) => [`macro:${macro.id}`, macro.name]));
        return this.ids().map((id) => ({
            id,
            titleKey: names.has(id) ? null : `shortcut.${id}`,
            name: names.get(id) || null,
            macro: names.has(id),
            binding: this.bindingOf(id),
            defaultBinding: this.defaultBinding(id),
            custom: Boolean(overrides[id])
        }));
    }

    sameBinding(a, b) {
        return a.code === b.code && Boolean(a.ctrlOrMeta) === Boolean(b.ctrlOrMeta) && Boolean(a.shift) === Boolean(b.shift) && Boolean(a.alt) === Boolean(b.alt);
    }

    conflicting(normalized, excludeId) {
        const result = [];
        for (const [id, binding] of Object.entries(this.bindings())) {
            if (id !== excludeId && this.sameBinding(binding, normalized)) {
                result.push(id);
            }
        }
        return result;
    }

    check(binding) {
        if (!binding || typeof binding !== 'object') {
            throw AppError.badRequest('shortcut.invalidBinding');
        }
        const code = binding.code;
        if (typeof code !== 'string' || code.length === 0) {
            throw AppError.badRequest('shortcut.invalidCode');
        }
        if (this.forbidden.has(code)) {
            throw AppError.badRequest('shortcut.reservedKey', { code });
        }
        if (!this.codePatterns.some((pattern) => pattern.test(code))) {
            throw AppError.badRequest('shortcut.invalidCodeValue', { code });
        }
        const normalized = this.normalize(binding);
        const hasModifier = normalized.ctrlOrMeta || normalized.shift || normalized.alt;
        if (!hasModifier && !this.barePatterns.some((pattern) => pattern.test(code))) {
            throw AppError.badRequest('shortcut.modifierRequired');
        }
        return normalized;
    }

    validate(binding, excludeId) {
        const normalized = this.check(binding);
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
        this.settings.set(ShortcutService.OVERRIDES, { ...this.overrides(), [id]: normalized });
        return this.list();
    }

    reset(id) {
        if (id !== undefined && id !== null && !this.ids().includes(id)) {
            throw AppError.badRequest('shortcut.unknownAction', { id });
        }
        if (id === undefined || id === null) {
            this.settings.set(ShortcutService.OVERRIDES, {});
        } else {
            const overrides = { ...this.overrides() };
            delete overrides[id];
            this.settings.set(ShortcutService.OVERRIDES, overrides);
        }
        return this.list();
    }

    contextual() {
        const stored = this.settings.get(ShortcutService.CONTEXTUAL);
        return Array.isArray(stored) ? stored : [];
    }

    setContext(context) {
        if (typeof context !== 'string' || !this.contextPattern.test(context)) {
            throw AppError.badRequest('shortcut.invalidContext');
        }
        this.context = context;
    }

    addContextual({ context, action, binding }) {
        if (typeof context !== 'string' || context === 'global' || !this.contextPattern.test(context)) {
            throw AppError.badRequest('shortcut.invalidContext');
        }
        if (!this.ids().includes(action)) {
            throw AppError.badRequest('shortcut.unknownAction', { id: String(action) });
        }
        const normalized = this.check(binding);
        const list = this.contextual();
        if (list.length >= this.rules.maxContextBindings) {
            throw AppError.badRequest('shortcut.tooMany', { max: this.rules.maxContextBindings });
        }
        const conflicts = list.filter((entry) => entry.context === context && this.sameBinding(entry.binding, normalized)).map((entry) => entry.action);
        if (conflicts.length > 0) {
            throw AppError.badRequest('shortcut.alreadyAssigned', { conflicts: conflicts.join(', ') });
        }
        list.push({ context, action, binding: normalized });
        this.settings.set(ShortcutService.CONTEXTUAL, list);
        return list;
    }

    removeContextual(index) {
        const list = this.contextual();
        if (!Number.isInteger(index) || index < 0 || index >= list.length) {
            throw AppError.badRequest('shortcut.invalidContext');
        }
        list.splice(index, 1);
        this.settings.set(ShortcutService.CONTEXTUAL, list);
        return list;
    }

    checkSteps(steps) {
        if (!Array.isArray(steps) || steps.length === 0 || steps.length > this.rules.maxSteps) {
            throw AppError.badRequest('shortcut.invalidMacro', { reason: 'steps' });
        }
        for (const step of steps) {
            const known = typeof step === 'string' && (this.rules.macroActions.includes(step) || this.stepPatterns.some((pattern) => pattern.test(step)));
            const tooLong = typeof step === 'string' && step.startsWith('wait:') && Number(step.slice(5)) > this.rules.maxWaitMs;
            if (!known || tooLong) {
                throw AppError.badRequest('shortcut.invalidMacro', { reason: String(step) });
            }
        }
        return steps;
    }

    saveMacro({ id, name, steps }) {
        const title = typeof name === 'string' ? name.trim() : '';
        if (!title || title.length > this.rules.maxNameLength) {
            throw AppError.badRequest('shortcut.invalidMacroName', { max: this.rules.maxNameLength });
        }
        const clean = this.checkSteps(steps);
        const list = this.macros();
        if (id) {
            const entry = list.find((macro) => macro.id === id);
            if (!entry) {
                throw AppError.notFound('shortcut.unknownMacro', { id: String(id) });
            }
            entry.name = title;
            entry.steps = clean;
        } else {
            if (list.length >= this.rules.maxMacros) {
                throw AppError.badRequest('shortcut.tooMany', { max: this.rules.maxMacros });
            }
            let fresh;
            do {
                fresh = crypto.randomBytes(3).toString('hex');
            } while (list.some((macro) => macro.id === fresh));
            list.push({ id: fresh, name: title, steps: clean });
        }
        this.settings.set(ShortcutService.MACROS, list);
        return this.macros();
    }

    removeMacro(id) {
        const list = this.macros();
        if (!list.some((macro) => macro.id === id)) {
            throw AppError.notFound('shortcut.unknownMacro', { id: String(id) });
        }
        const action = `macro:${id}`;
        this.settings.set(ShortcutService.MACROS, list.filter((macro) => macro.id !== id));
        const overrides = { ...this.overrides() };
        delete overrides[action];
        this.settings.set(ShortcutService.OVERRIDES, overrides);
        this.settings.set(ShortcutService.CONTEXTUAL, this.contextual().filter((entry) => entry.action !== action));
        return this.macros();
    }

    inputBinding(input) {
        return { code: input.code, ctrlOrMeta: Boolean(input.control || input.meta), shift: Boolean(input.shift), alt: Boolean(input.alt) };
    }

    match(input) {
        if (input.type !== 'keyDown') {
            return null;
        }
        const pressed = this.inputBinding(input);
        for (const [id, binding] of Object.entries(this.bindings())) {
            if (this.sameBinding(binding, pressed)) {
                return id;
            }
        }
        return null;
    }

    matchContextual(input) {
        if (input.type !== 'keyDown' || this.context === 'global') {
            return null;
        }
        const pressed = this.inputBinding(input);
        const entry = this.contextual().find((item) => item.context === this.context && this.sameBinding(item.binding, pressed));
        return entry ? entry.action : null;
    }

    dispatch(id, contents) {
        if (this.actions && this.actions[id]) {
            this.actions[id]();
        } else {
            contents.send(this.rules.channel, id);
        }
    }

    attach(contents) {
        contents.on('before-input-event', (event, input) => {
            const id = this.matchContextual(input) || this.match(input);
            if (id) {
                event.preventDefault();
                this.dispatch(id, contents);
            }
        });
    }
}

module.exports = ShortcutService;
