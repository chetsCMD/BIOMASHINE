const fs = require('fs');
const path = require('path');

class LocaleService {
    constructor({ config, registry, rendererRoot, userLocalesDir }) {
        this.registry = registry;
        this.rendererRoot = rendererRoot;
        this.userLocalesDir = userLocalesDir;
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

    report(file, message) {
        this.found.set(`${file}|${message}`, { file, message });
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
                cached.problem = `некорректный JSON: ${error.message}`;
            }
            this.cache.set(file, cached);
        }
        if (cached.problem) {
            this.report(path.basename(file), cached.problem);
        }
        return cached.value;
    }

    builtinEntry(code) {
        return this.builtin.find((entry) => entry.code === code) || null;
    }

    scopeFile(scope, code) {
        if (scope === 'shell' || scope === 'shared') {
            return path.join(this.rendererRoot, scope, 'locales', `${code}.json`);
        }
        const module = this.registry.get(scope);
        return module ? path.join(module.dir, 'locales', `${code}.json`) : null;
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
                this.report(label, `ключ «${key}»: значение должно быть строкой или набором форм множественного числа с обязательной формой other`);
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
                this.report(file, 'meta.code (например "de") и meta.name обязательны');
                continue;
            }
            if (found.has(meta.code)) {
                this.report(file, `язык «${meta.code}» уже описан другим файлом`);
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
            if (scope !== 'shared') {
                Object.assign(strings, this.stringsOf('shared', item, user));
            }
            Object.assign(strings, this.stringsOf(scope, item, user));
        }
        return { language: code, locale: this.localeOf(code), strings };
    }

    scopeNames() {
        return ['shell', 'shared', ...this.registry.all().filter((module) => module.kind === 'page').map((module) => module.id)];
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
