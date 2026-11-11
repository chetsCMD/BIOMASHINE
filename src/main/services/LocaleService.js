const fs = require('fs');
const path = require('path');

class LocaleService {
    constructor({ config, registry, rendererRoot, userLocalesDir, mainLocalesDir }) {
        this.registry = registry;
        this.rendererRoot = rendererRoot;
        this.userLocalesDir = userLocalesDir;
        this.mainLocalesDir = mainLocalesDir === undefined ? path.join(rendererRoot, '..', 'main', 'locales') : mainLocalesDir;
        const settings = config.get('app.i18n');
        this.defaultCode = settings.default;
        this.builtin = settings.builtin;
        this.codePattern = new RegExp(settings.codePattern);
        this.pluralForms = settings.pluralForms;
        this.cache = new Map();
        this.found = new Map();
    }

    get problems() {
        return [...this.found.values()];
    }

    report(file, key, params) {
        this.found.set(`${file}|${key}|${JSON.stringify(params || {})}`, { file, key, params });
    }

    readJson(file) {
        if (!fs.existsSync(file)) {
            return null;
        }
        const stamp = fs.statSync(file).mtimeMs;
        let cached = this.cache.get(file);
        if (!cached || cached.stamp !== stamp) {
            cached = { stamp, value: null, problem: null };
            try {
                cached.value = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
            } catch (error) {
                cached.problem = error.message;
            }
            this.cache.set(file, cached);
        }
        if (cached.problem) {
            this.report(path.basename(file), 'locale.invalidJson', { message: cached.problem });
        }
        return cached.value;
    }

    builtinEntry(code) {
        return this.builtin.find((entry) => entry.code === code) || null;
    }

    scopeDir(scope) {
        if (scope === 'shell' || scope === 'shared') {
            return path.join(this.rendererRoot, scope, 'locales');
        }
        if (scope === 'backend') {
            return this.mainLocalesDir && fs.existsSync(this.mainLocalesDir) ? this.mainLocalesDir : null;
        }
        const module = this.registry.get(scope);
        return module ? path.join(module.dir, 'locales') : null;
    }

    scopeFile(scope, code) {
        const dir = this.scopeDir(scope);
        return dir ? path.join(dir, `${code}.json`) : null;
    }

    catalog() {
        return this.scopeNames().map((scope) => {
            const dir = this.scopeDir(scope);
            return {
                scope,
                dir,
                file: (code) => (dir ? path.join(dir, `${code}.json`) : null)
            };
        });
    }

    validateStrings(strings, label) {
        const clean = {};
        if (!strings || typeof strings !== 'object' || Array.isArray(strings)) {
            return clean;
        }
        for (const [key, value] of Object.entries(strings)) {
            if (typeof value === 'string') {
                clean[key] = value;
            } else if (value && typeof value === 'object' && !Array.isArray(value) && typeof value.other === 'string' && Object.entries(value).every(([form, text]) => this.pluralForms.includes(form) && typeof text === 'string')) {
                clean[key] = value;
            } else {
                this.report(label, 'locale.invalidStringFormat', { key });
            }
        }
        return clean;
    }

    userLanguages() {
        const found = new Map();
        if (!fs.existsSync(this.userLocalesDir)) {
            return found;
        }
        for (const file of fs.readdirSync(this.userLocalesDir).sort()) {
            if (!file.endsWith('.json')) {
                continue;
            }
            const data = this.readJson(path.join(this.userLocalesDir, file));
            if (!data) {
                continue;
            }
            const meta = data.meta || {};
            if (typeof meta.code !== 'string' || !this.codePattern.test(meta.code) || typeof meta.name !== 'string' || !meta.name.trim()) {
                this.report(file, 'locale.metaRequired');
                continue;
            }
            if (found.has(meta.code)) {
                this.report(file, 'locale.duplicateLanguage', { code: meta.code });
                continue;
            }
            found.set(meta.code, { meta, scopes: data.scopes && typeof data.scopes === 'object' ? data.scopes : {}, file });
        }
        return found;
    }

    languages() {
        this.found.clear();
        const user = this.userLanguages();
        const list = this.builtin.map((entry) => ({ code: entry.code, name: entry.name, locale: entry.locale, builtin: true }));
        for (const [code, entry] of user) {
            if (!this.builtinEntry(code)) {
                list.push({ code, name: entry.meta.name, locale: entry.meta.locale || code, builtin: false });
            }
        }
        return list;
    }

    has(code) {
        return this.languages().some((language) => language.code === code);
    }

    localeOf(code) {
        const builtin = this.builtinEntry(code);
        if (builtin) {
            return builtin.locale;
        }
        const user = this.userLanguages().get(code);
        return user && user.meta.locale ? user.meta.locale : code;
    }

    chain(code) {
        const user = this.userLanguages();
        const order = [code];
        const own = user.get(code);
        if (own && own.meta.fallback) {
            order.push(own.meta.fallback);
        }
        order.push(this.defaultCode, ...this.builtin.map((entry) => entry.code));
        return [...new Set(order)].filter((item) => this.builtinEntry(item) || user.has(item));
    }

    stringsOf(scope, code, user) {
        const file = this.scopeFile(scope, code);
        const base = file ? this.readJson(file) : null;
        const merged = { ...this.validateStrings(base, `${scope}/${code}.json`) };
        const override = user.get(code);
        if (override && override.scopes[scope]) {
            Object.assign(merged, this.validateStrings(override.scopes[scope], override.file));
        }
        return merged;
    }

    bundle(scope, code) {
        this.found.clear();
        const user = this.userLanguages();
        const strings = {};
        for (const item of [...this.chain(code)].reverse()) {
            if (scope !== 'shared' && scope !== 'backend') {
                Object.assign(strings, this.stringsOf('shared', item, user));
            }
            Object.assign(strings, this.stringsOf(scope, item, user));
        }
        return { language: code, locale: this.localeOf(code), strings };
    }

    scopeNames() {
        return ['backend', 'shell', 'shared', ...this.registry.all().filter((module) => module.kind === 'page').map((module) => module.id)];
    }

    master(code) {
        this.found.clear();
        const user = this.userLanguages();
        const scopes = {};
        for (const scope of this.scopeNames()) {
            const strings = {};
            for (const item of [...this.chain(code)].reverse()) {
                Object.assign(strings, this.stringsOf(scope, item, user));
            }
            if (Object.keys(strings).length > 0) {
                scopes[scope] = strings;
            }
        }
        return { meta: { code: 'xx', name: 'Language name', locale: 'xx-XX', fallback: this.defaultCode, basedOn: code }, scopes };
    }

    detect(systemLocale) {
        const primary = String(systemLocale || '').toLowerCase().split(/[-_]/)[0];
        const available = this.languages().map((language) => language.code);
        const full = String(systemLocale || '').replace('_', '-');
        if (available.includes(full)) {
            return full;
        }
        return available.includes(primary) ? primary : this.defaultCode;
    }

    errors() {
        this.found.clear();
        const user = this.userLanguages();
        const codes = [...new Set([...this.builtin.map((entry) => entry.code), ...user.keys()])];
        for (const scope of this.scopeNames()) {
            for (const code of codes) {
                this.stringsOf(scope, code, user);
            }
        }
        return this.problems;
    }
}

module.exports = LocaleService;