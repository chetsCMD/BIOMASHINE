const AppError = require('../core/AppError');

class DesignService {
    static NAME = /^[a-z][a-z0-9-]*$/;
    static MAX_VALUE = 300;
    static MAX_CSS = 50000;
    static KEYS = { overrides: 'design.overrides', moduleOverrides: 'design.moduleOverrides', customCss: 'design.customCss', moduleCss: 'design.moduleCss' };

    constructor({ config, catalog, settings, store }) {
        this.config = config;
        this.catalog = catalog;
        this.settings = settings;
        this.store = store;
    }

    read(key, fallback) {
        const value = this.store.get(key);
        return value === null || value === undefined ? fallback : value;
    }

    baseTokens() {
        return this.config.get('design.tokens', {});
    }

    overrides() {
        return this.read(DesignService.KEYS.overrides, {});
    }

    moduleOverrides(id) {
        return this.read(DesignService.KEYS.moduleOverrides, {})[id] || {};
    }

    effectiveOverrides(id = null) {
        return id ? { ...this.overrides(), ...this.moduleOverrides(id) } : this.overrides();
    }

    tokens(id = null) {
        return { ...this.baseTokens(), ...this.effectiveOverrides(id) };
    }

    customCss(id = null) {
        return id ? this.read(DesignService.KEYS.moduleCss, {})[id] || '' : this.read(DesignService.KEYS.customCss, '');
    }

    effectiveCss(id = null) {
        return [this.customCss(null), id ? this.customCss(id) : ''].filter(Boolean).join('\n');
    }

    theme() {
        const catalog = this.catalog.load();
        const name = this.settings.getAll().theme;
        return { name, ...(catalog.themes[name] || catalog.themes[catalog.default]) };
    }

    css() {
        const theme = this.theme();
        const lines = Object.entries(this.baseTokens()).map(([name, value]) => `  --${name}: ${value};`);
        Object.entries(theme.variables).forEach(([name, value]) => lines.push(`  ${name}: ${value};`));
        lines.push(`  --color-scheme: ${theme.colorScheme};`, `  color-scheme: ${theme.colorScheme};`);
        Object.entries(this.overrides()).forEach(([name, value]) => lines.push(`  --${name}: ${value};`));
        return `:root {\n${lines.join('\n')}\n}\n`;
    }

    expand(css) {
        const tokens = this.tokens();
        return css.replace(/\$([a-z][a-z0-9-]*)/g, (match, name) => (tokens[name] !== undefined ? tokens[name] : match));
    }

    validateTokens(tokens) {
        if (!tokens || typeof tokens !== 'object' || Array.isArray(tokens)) {
            throw AppError.badRequest('design.invalidTokens');
        }
        for (const [name, value] of Object.entries(tokens)) {
            if (!DesignService.NAME.test(name)) {
                throw AppError.badRequest('design.invalidName', { name });
            }
            if (typeof value !== 'string' || !value.trim() || value.length > DesignService.MAX_VALUE || /[;{}]|<\//.test(value)) {
                throw AppError.badRequest('design.invalidValue', { name });
            }
        }
        return tokens;
    }

    validateCss(css) {
        if (typeof css !== 'string') {
            throw AppError.badRequest('design.invalidCss', { reason: 'type' });
        }
        if (css.length > DesignService.MAX_CSS) {
            throw AppError.badRequest('design.cssTooLong', { max: DesignService.MAX_CSS });
        }
        if (/<\/style/i.test(css)) {
            throw AppError.badRequest('design.invalidCss', { reason: '</style' });
        }
        if (/@import\s+(url\(\s*)?['"]?\s*(https?:)?\/\//i.test(css)) {
            throw AppError.badRequest('design.invalidCss', { reason: '@import' });
        }
        return css;
    }

    setOverrides(id, tokens) {
        this.validateTokens(tokens);
        if (id) {
            const all = this.read(DesignService.KEYS.moduleOverrides, {});
            all[id] = { ...(all[id] || {}), ...tokens };
            this.store.set(DesignService.KEYS.moduleOverrides, all);
        } else {
            this.store.set(DesignService.KEYS.overrides, { ...this.overrides(), ...tokens });
        }
    }

    resetOverrides(id, names) {
        const prune = (map) => (Array.isArray(names) ? Object.fromEntries(Object.entries(map).filter(([name]) => !names.includes(name))) : {});
        if (id) {
            const all = this.read(DesignService.KEYS.moduleOverrides, {});
            all[id] = prune(all[id] || {});
            if (Object.keys(all[id]).length === 0) {
                delete all[id];
            }
            this.store.set(DesignService.KEYS.moduleOverrides, all);
        } else {
            this.store.set(DesignService.KEYS.overrides, prune(this.overrides()));
        }
    }

    setCss(id, css) {
        this.validateCss(css);
        if (id) {
            const all = this.read(DesignService.KEYS.moduleCss, {});
            all[id] = css;
            this.store.set(DesignService.KEYS.moduleCss, all);
        } else {
            this.store.set(DesignService.KEYS.customCss, css);
        }
    }

    resetCss(id) {
        if (id) {
            const all = this.read(DesignService.KEYS.moduleCss, {});
            delete all[id];
            this.store.set(DesignService.KEYS.moduleCss, all);
        } else {
            this.store.set(DesignService.KEYS.customCss, '');
        }
    }

    groups() {
        const groups = new Map();
        for (const [name, value] of Object.entries(this.baseTokens())) {
            const match = name.match(/^(.*?)-(n?\d[\w.]*)$/);
            const group = match ? match[1] : name.split('-')[0];
            if (!groups.has(group)) {
                groups.set(group, []);
            }
            groups.get(group).push({ name, value });
        }
        return [...groups.entries()].map(([group, tokens]) => ({ group, tokens }));
    }

    exportData() {
        return {
            version: 1,
            overrides: this.overrides(),
            moduleOverrides: this.read(DesignService.KEYS.moduleOverrides, {}),
            customCss: this.customCss(null),
            moduleCss: this.read(DesignService.KEYS.moduleCss, {})
        };
    }

    importData(data) {
        if (!data || typeof data !== 'object' || data.version !== 1) {
            throw AppError.badRequest('design.invalidImport');
        }
        const overrides = this.validateTokens(data.overrides || {});
        const moduleOverrides = data.moduleOverrides || {};
        const moduleCss = data.moduleCss || {};
        if (typeof moduleOverrides !== 'object' || typeof moduleCss !== 'object') {
            throw AppError.badRequest('design.invalidImport');
        }
        Object.values(moduleOverrides).forEach((tokens) => this.validateTokens(tokens));
        Object.values(moduleCss).forEach((css) => this.validateCss(css));
        this.validateCss(data.customCss || '');
        this.store.set(DesignService.KEYS.overrides, overrides);
        this.store.set(DesignService.KEYS.moduleOverrides, moduleOverrides);
        this.store.set(DesignService.KEYS.customCss, data.customCss || '');
        this.store.set(DesignService.KEYS.moduleCss, moduleCss);
    }
}

module.exports = DesignService;
