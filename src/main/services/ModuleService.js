const AppError = require('../core/AppError');

class ModuleService {
    static HIDDEN_KEY = 'modules.hidden';

    constructor(registry, settings, scheme, locales, language) {
        this.registry = registry;
        this.locales = locales;
        this.language = language;
        this.settings = settings;
        this.scheme = scheme;
    }

    hiddenIds() {
        const stored = this.settings.get(ModuleService.HIDDEN_KEY);
        return new Set(Array.isArray(stored) ? stored : []);
    }

    texts(module) {
        if (!module.i18n) {
            return { title: module.title, description: module.description };
        }
        const { strings } = this.locales.bundle(module.id, this.language());
        const pick = (key, fallback) => (typeof strings[key] === 'string' ? strings[key] : fallback);
        return { title: pick('module.title', module.title), description: pick('module.description', module.description) };
    }

    describe(module, hidden) {
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
            hidden: module.hideable && hidden.has(module.id)
        };
        if (module.kind === 'page') {
            return { ...base, url: url(module.entry), channels: module.channels };
        }
        return { ...base, cssUrls: module.css.map(url) };
    }

    list() {
        const hidden = this.hiddenIds();
        return this.registry.all().map((module) => this.describe(module, hidden));
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
            throw AppError.notFound(`Модуль не найден: ${id}`);
        }
        if (!module.hideable) {
            throw AppError.badRequest('Этот модуль нельзя скрыть');
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
}

module.exports = ModuleService;
