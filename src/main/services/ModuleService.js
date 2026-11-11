const AppError = require('../core/AppError');

class ModuleService {
    static HIDDEN_KEY = 'modules.hidden';
    static PINNED_KEY = 'modules.pinned';
    static CUSTOM_CATEGORIES_KEY = 'modules.customCategories';
    static CATEGORY_OVERRIDES_KEY = 'modules.categoryOverrides';
    static TRANSLIT = {
        '\u0430': 'a', '\u0431': 'b', '\u0432': 'v', '\u0433': 'g', '\u0434': 'd',
        '\u0435': 'e', '\u0451': 'e', '\u0436': 'zh', '\u0437': 'z', '\u0438': 'i',
        '\u0439': 'y', '\u043A': 'k', '\u043B': 'l', '\u043C': 'm', '\u043D': 'n',
        '\u043E': 'o', '\u043F': 'p', '\u0440': 'r', '\u0441': 's', '\u0442': 't',
        '\u0443': 'u', '\u0444': 'f', '\u0445': 'kh', '\u0446': 'ts', '\u0447': 'ch',
        '\u0448': 'sh', '\u0449': 'shch', '\u044A': '', '\u044B': 'y', '\u044C': '',
        '\u044D': 'e', '\u044E': 'yu', '\u044F': 'ya'
    };

    constructor(registry, settings, scheme, locales, language, config) {
        this.registry = registry;
        this.locales = locales;
        this.language = language;
        this.settings = settings;
        this.scheme = scheme;
        this.config = config;
    }

    get builtinCategories() {
        const list = this.config.get('app.modules.categories');
        return Array.isArray(list) ? list : [];
    }

    hiddenIds() {
        const stored = this.settings.get(ModuleService.HIDDEN_KEY);
        return new Set(Array.isArray(stored) ? stored : []);
    }

    customCategories() {
        const stored = this.settings.get(ModuleService.CUSTOM_CATEGORIES_KEY);
        return Array.isArray(stored) ? stored : [];
    }

    categoryOverrides() {
        const stored = this.settings.get(ModuleService.CATEGORY_OVERRIDES_KEY);
        return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
    }

    categoryExists(id) {
        if (typeof id !== 'string') {
            return false;
        }
        return this.builtinCategories.some((c) => c.id === id) || this.customCategories().some((c) => c.id === id);
    }

    categories() {
        return [
            ...this.builtinCategories.map((c) => ({ id: c.id, titleKey: c.titleKey, builtin: true })),
            ...this.customCategories().map((c) => ({ id: c.id, name: c.name, builtin: false }))
        ];
    }

    texts(module) {
        if (!module.i18n) {
            return { title: module.title, description: module.description };
        }
        const { strings } = this.locales.bundle(module.id, this.language());
        const pick = (key, fallback) => (typeof strings[key] === 'string' ? strings[key] : fallback);
        return { title: pick('module.title', module.title), description: pick('module.description', module.description) };
    }

    describe(module, hidden, category, pinOrder) {
        const url = (file) => `${this.scheme}://${module.id}/${file}`;
        const base = {
            id: module.id,
            kind: module.kind,
            title: this.texts(module).title,
            version: module.version,
            description: this.texts(module).description,
            order: module.order,
            source: module.source,
            hideable: module.hideable,
            hidden: module.hideable && hidden.has(module.id),
            category,
            pinned: pinOrder !== null,
            pinOrder,
            permissions: module.permissions || []
        };
        if (module.kind === 'page') {
            return { ...base, url: url(module.entry), channels: module.channels };
        }
        return { ...base, cssUrls: module.css.map(url) };
    }

    resolveCategory(module, overrides, builtinSet, customSet) {
        const exists = (id) => builtinSet.has(id) || customSet.has(id);
        const override = overrides[module.id];
        if (override && exists(override)) {
            return override;
        }
        if (module.category && exists(module.category)) {
            return module.category;
        }
        return 'other';
    }

    pinnedMap() {
        const stored = this.settings.get(ModuleService.PINNED_KEY);
        if (Array.isArray(stored)) {
            return new Map(stored.map((id, index) => [id, index]));
        }
        const map = new Map();
        let index = 0;
        for (const module of this.registry.all()) {
            if (module.kind === 'page') {
                map.set(module.id, index++);
            }
        }
        return map;
    }

    list() {
        const hidden = this.hiddenIds();
        const overrides = this.categoryOverrides();
        const builtinSet = new Set(this.builtinCategories.map((c) => c.id));
        const customSet = new Set(this.customCategories().map((c) => c.id));
        const pinMap = this.pinnedMap();
        return this.registry.all().map((module) => {
            const category = this.resolveCategory(module, overrides, builtinSet, customSet);
            const pinOrder = pinMap.has(module.id) ? pinMap.get(module.id) : null;
            return this.describe(module, hidden, category, pinOrder);
        });
    }

    errors() {
        return this.registry.errors.map((error) => ({ ...error }));
    }

    rescan() {
        this.registry.scan();
        return { modules: this.list(), errors: this.errors() };
    }

    setHidden(id, isHidden) {
        const module = this.registry.get(id);
        if (!module) {
            throw AppError.notFound('module.notFound', { id });
        }
        if (!module.hideable) {
            throw AppError.badRequest('module.notHideable');
        }
        const hidden = this.hiddenIds();
        if (isHidden) {
            hidden.add(id);
        } else {
            hidden.delete(id);
        }
        this.settings.set(ModuleService.HIDDEN_KEY, [...hidden]);
        return this.list();
    }

    setPinned(id, isPinned) {
        const module = this.registry.get(id);
        if (!module) {
            throw AppError.notFound('module.notFound', { id });
        }
        const stored = this.settings.get(ModuleService.PINNED_KEY);
        const current = Array.isArray(stored)
            ? [...stored]
            : this.registry.all().filter((m) => m.kind === 'page').map((m) => m.id);
        const index = current.indexOf(id);
        if (isPinned) {
            if (index < 0) {
                current.push(id);
            }
        } else if (index >= 0) {
            current.splice(index, 1);
        }
        this.settings.set(ModuleService.PINNED_KEY, current);
        return this.list();
    }

    reorderPinned(ids) {
        if (!Array.isArray(ids)) {
            throw AppError.badRequest('modules.idsArrayRequired');
        }
        const seen = new Set();
        for (const id of ids) {
            if (typeof id !== 'string') {
                throw AppError.badRequest('module.idsStringsOnly');
            }
            if (seen.has(id)) {
                throw AppError.badRequest('module.duplicateId', { id });
            }
            seen.add(id);
            if (!this.registry.get(id)) {
                throw AppError.notFound('module.notFound', { id });
            }
        }
        this.settings.set(ModuleService.PINNED_KEY, [...ids]);
        return this.list();
    }

    setCategory(id, category) {
        const module = this.registry.get(id);
        if (!module) {
            throw AppError.notFound('module.notFound', { id });
        }
        if (category !== null && !this.categoryExists(category)) {
            throw AppError.notFound('module.categoryNotFound', { category });
        }
        const overrides = { ...this.categoryOverrides() };
        if (category === null) {
            delete overrides[id];
        } else {
            overrides[id] = category;
        }
        this.settings.set(ModuleService.CATEGORY_OVERRIDES_KEY, overrides);
        return this.list();
    }

    slug(text) {
        let out = '';
        for (const ch of text.toLowerCase()) {
            if (/[a-z0-9]/.test(ch)) {
                out += ch;
            } else if (ModuleService.TRANSLIT[ch] !== undefined) {
                out += ModuleService.TRANSLIT[ch];
            } else {
                out += ' ';
            }
        }
        return out.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }

    createCategory(name) {
        if (typeof name !== 'string') {
            throw AppError.badRequest('module.nameString');
        }
        const trimmed = name.trim();
        if (trimmed.length < 1 || trimmed.length > 40) {
            throw AppError.badRequest('module.categoryNameLength');
        }
        const custom = this.customCategories();
        const lower = trimmed.toLowerCase();
        if (custom.some((c) => c.name.toLowerCase() === lower)) {
            throw AppError.badRequest('module.categoryExists');
        }
        const taken = new Set(custom.map((c) => c.id));
        let slug = this.slug(trimmed);
        if (!slug) {
            slug = 'cat';
        }
        let id = `custom-${slug}`;
        let counter = 2;
        while (taken.has(id)) {
            id = `custom-${slug}-${counter++}`;
        }
        this.settings.set(ModuleService.CUSTOM_CATEGORIES_KEY, [...custom, { id, name: trimmed }]);
        return { id };
    }

    removeCategory(id) {
        const custom = this.customCategories();
        if (!custom.some((c) => c.id === id)) {
            throw AppError.notFound('module.categoryNotFound', { category: id });
        }
        const next = custom.filter((c) => c.id !== id);
        const overrides = { ...this.categoryOverrides() };
        for (const key of Object.keys(overrides)) {
            if (overrides[key] === id) {
                delete overrides[key];
            }
        }
        this.settings.set(ModuleService.CUSTOM_CATEGORIES_KEY, next);
        this.settings.set(ModuleService.CATEGORY_OVERRIDES_KEY, overrides);
        return this.list();
    }
}

module.exports = ModuleService;