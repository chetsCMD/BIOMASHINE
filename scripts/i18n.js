const fs = require('fs');
const path = require('path');

const PLACEHOLDER = /\{([^}]+)\}/g;

function placeholders(value) {
    const found = new Set();
    const scan = (text) => {
        if (typeof text !== 'string') return;
        for (const match of text.matchAll(PLACEHOLDER)) {
            found.add(match[1]);
        }
    };
    if (typeof value === 'string') {
        scan(value);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const text of Object.values(value)) {
            scan(text);
        }
    }
    return [...found].sort();
}

function normalize(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        const sorted = {};
        for (const key of Object.keys(value).sort()) {
            sorted[key] = value[key];
        }
        return sorted;
    }
    return value;
}

function sameValue(left, right) {
    return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

function expandPlural(value, categories) {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    const forms = Object.entries(value).filter(([, text]) => typeof text === 'string');
    if (forms.length === 0) return value;
    const other = forms.find(([form]) => form === 'other');
    const fallback = other || forms[0];
    const result = {};
    for (const category of categories) {
        const exact = forms.find(([form]) => form === category);
        result[category] = exact ? exact[1] : fallback[1];
    }
    return result;
}

function resolve(container, ...names) {
    for (const name of names) {
        if (container[name] !== undefined) {
            return container[name];
        }
    }
    throw new Error(`Container не содержит ни одного из: ${names.join(', ')}`);
}

class I18nTool {
    constructor({ config, registry, locale, configFile, root }) {
        this.config = config || null;
        this.registry = registry || null;
        this.locale = locale;
        this.configFile = configFile;
        this.root = root;
    }

    readApp() {
        const raw = fs.readFileSync(this.configFile, 'utf8').replace(/^\uFEFF/, '');
        return JSON.parse(raw);
    }

    writeApp(data) {
        fs.writeFileSync(this.configFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
        if (this.locale && data.i18n && Array.isArray(data.i18n.builtin)) {
            this.locale.builtin = data.i18n.builtin;
        }
    }

    i18nSettings() {
        if (this.config) {
            const settings = this.config.get('app.i18n');
            if (settings) {
                return settings;
            }
        }
        return this.readApp().i18n;
    }

    relative(file) {
        if (!file) return '';
        return this.root ? path.relative(this.root, file) : file;
    }

    catalog() {
        return this.locale.catalog().filter((entry) => entry.dir);
    }

    readStrings(scope, code) {
        const file = this.locale.scopeFile(scope, code);
        if (!file) {
            return { file: null, exists: false, strings: {}, error: null };
        }
        if (!fs.existsSync(file)) {
            return { file, exists: false, strings: {}, error: null };
        }
        try {
            const data = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
            const strings = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
            return { file, exists: true, strings, error: null };
        } catch (error) {
            return { file, exists: true, strings: {}, error: error.message };
        }
    }

    async status(options = {}) {
        const settings = this.i18nSettings();
        const source = options.source || settings.source || 'en';
        const reference = settings.reference || 'ru';
        const skip = new Set([reference, source]);
        const catalog = this.catalog();
        const languages = this.locale.languages();
        const scopes = [];
        const totals = new Map();
        for (const language of languages) {
            totals.set(language.code, { keys: 0, missing: 0, extra: 0, untranslated: 0, reference: 0 });
        }
        for (const { scope } of catalog) {
            const referenceStrings = this.readStrings(scope, reference).strings;
            const referenceKeys = Object.keys(referenceStrings);
            const sourceStrings = this.readStrings(scope, source).strings;
            const files = {};
            for (const language of languages) {
                const read = this.readStrings(scope, language.code);
                const keys = Object.keys(read.strings);
                const missing = referenceKeys.filter((key) => !(key in read.strings));
                const extra = keys.filter((key) => !(key in referenceStrings));
                const untranslated = skip.has(language.code)
                    ? []
                    : keys.filter((key) => key in sourceStrings && sameValue(read.strings[key], sourceStrings[key]));
                files[language.code] = {
                    file: read.file,
                    relative: this.relative(read.file),
                    exists: read.exists,
                    error: read.error,
                    keys: keys.length,
                    missing,
                    extra,
                    untranslated
                };
                const total = totals.get(language.code);
                total.keys += keys.length;
                total.missing += missing.length;
                total.extra += extra.length;
                total.untranslated += untranslated.length;
                total.reference += referenceKeys.length;
            }
            scopes.push({ scope, reference: referenceKeys.length, files });
        }
        const summary = languages.map((language) => {
            const total = totals.get(language.code);
            const translated = Math.max(0, total.reference - total.missing - total.untranslated);
            const percent = total.reference > 0 ? (translated / total.reference) * 100 : 100;
            return {
                code: language.code,
                name: language.name,
                locale: language.locale,
                builtin: language.builtin,
                keys: total.keys,
                reference: total.reference,
                missing: total.missing,
                extra: total.extra,
                untranslated: total.untranslated,
                percent: Math.round(percent * 10) / 10
            };
        });
        return { source, reference, scopes, languages: summary };
    }

    async files(code, options = {}) {
        if (!this.locale.codePattern.test(code)) {
            throw new Error(`Некорректный код языка: «${code}»`);
        }
        const reference = this.i18nSettings().reference || 'ru';
        const list = [];
        for (const { scope } of this.catalog()) {
            const referenceStrings = this.readStrings(scope, reference).strings;
            const read = this.readStrings(scope, code);
            const keys = Object.keys(read.strings);
            const missing = Object.keys(referenceStrings).filter((key) => !(key in read.strings));
            const needsWork = !read.exists || missing.length > 0;
            if (options.missing && !needsWork) {
                continue;
            }
            list.push({
                scope,
                file: read.file,
                relative: this.relative(read.file),
                exists: read.exists,
                keys: keys.length,
                missing,
                needsWork
            });
        }
        return list;
    }

    async add(code, name, locale, options = {}) {
        const settings = this.i18nSettings();
        const pattern = new RegExp(settings.codePattern);
        if (!pattern.test(code)) {
            throw new Error(`Некорректный код языка: «${code}»`);
        }
        if (!pattern.test(locale)) {
            throw new Error(`Некорректная локаль: «${locale}»`);
        }
        const app = this.readApp();
        const builtin = Array.isArray(app.i18n.builtin) ? app.i18n.builtin : [];
        if (builtin.some((entry) => entry.code === code)) {
            throw new Error(`Язык «${code}» уже есть в i18n.builtin`);
        }
        if (this.locale.userLanguages().has(code)) {
            throw new Error(`Язык «${code}» уже описан пользовательским файлом`);
        }
        const from = options.from || settings.source || 'en';
        const fallback = options.fallback || settings.source || 'en';
        const categories = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
        const created = [];
        let totalKeys = 0;
        for (const { scope } of this.catalog()) {
            const source = this.readStrings(scope, from);
            const strings = {};
            for (const [key, value] of Object.entries(source.strings)) {
                strings[key] = expandPlural(value, categories);
            }
            totalKeys += Object.keys(strings).length;
            const file = this.locale.scopeFile(scope, code);
            if (!file) {
                continue;
            }
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(file, `${JSON.stringify(strings, null, 2)}\n`, 'utf8');
            created.push({ scope, file, relative: this.relative(file), keys: Object.keys(strings).length });
        }
        builtin.push({ code, name, locale, fallback });
        app.i18n.builtin = builtin;
        this.writeApp(app);
        return { code, name, locale, fallback, from, created, totalKeys };
    }

    async check(code, options = {}) {
        const settings = this.i18nSettings();
        const reference = settings.reference || 'ru';
        const languages = code ? [code] : this.locale.languages().map((language) => language.code);
        const problems = [];
        for (const language of languages) {
            if (!this.locale.has(language)) {
                problems.push({ file: null, scope: null, language, key: null, message: `Язык «${language}» не найден` });
                continue;
            }
            const locale = this.locale.localeOf(language);
            const categories = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
            const categorySet = new Set(categories);
            for (const { scope } of this.catalog()) {
                const referenceStrings = this.readStrings(scope, reference).strings;
                const referenceKeys = Object.keys(referenceStrings);
                const read = this.readStrings(scope, language);
                const file = this.relative(read.file);
                if (read.error) {
                    problems.push({ file, scope, language, key: null, message: `некорректный JSON: ${read.error}` });
                    continue;
                }
                for (const [key, value] of Object.entries(read.strings)) {
                    if (typeof value === 'string') {
                        if (value.trim() === '') {
                            problems.push({ file, scope, language, key, message: 'пустая строка' });
                        }
                    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
                        const forms = Object.keys(value);
                        const extra = forms.filter((form) => !categorySet.has(form));
                        const missing = categories.filter((form) => !forms.includes(form));
                        if (extra.length > 0) {
                            problems.push({ file, scope, language, key, message: `лишние формы: ${extra.join(', ')}` });
                        }
                        if (missing.length > 0) {
                            problems.push({ file, scope, language, key, message: `нет форм: ${missing.join(', ')}` });
                        }
                        for (const [form, text] of Object.entries(value)) {
                            if (typeof text !== 'string' || text.trim() === '') {
                                problems.push({ file, scope, language, key, message: `пустая форма «${form}»` });
                            }
                        }
                    } else {
                        problems.push({ file, scope, language, key, message: 'значение должно быть строкой или объектом форм' });
                    }
                    if (key in referenceStrings) {
                        const expected = placeholders(referenceStrings[key]);
                        const actual = placeholders(value);
                        if (expected.join(',') !== actual.join(',')) {
                            problems.push({
                                file,
                                scope,
                                language,
                                key,
                                message: `подстановки не совпадают с ${reference}: ожидалось [${expected.join(', ')}], получено [${actual.join(', ')}]`
                            });
                        }
                    }
                }
                for (const key of Object.keys(read.strings)) {
                    if (!(key in referenceStrings)) {
                        problems.push({ file, scope, language, key, message: `лишний ключ относительно ${reference}` });
                    }
                }
                if (!options.allowMissing) {
                    for (const key of referenceKeys) {
                        if (!(key in read.strings)) {
                            problems.push({ file, scope, language, key, message: `нет ключа относительно ${reference}` });
                        }
                    }
                }
            }
        }
        return problems;
    }
}

function parseArgs(argv) {
    const positional = [];
    const options = {};
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg.startsWith('--')) {
            const name = arg.slice(2);
            const next = argv[index + 1];
            if (next !== undefined && !next.startsWith('--')) {
                options[name] = next;
                index += 1;
            } else {
                options[name] = true;
            }
        } else {
            positional.push(arg);
        }
    }
    return { positional, options };
}

function stubSystem() {
    return {
        systemLocale: () => 'en-US',
        openExternal: async () => {},
        relaunch: () => {},
        windowState: () => ({ fullscreen: false }),
        toggleFullscreen: () => ({ fullscreen: false }),
        closeWindow: () => {},
        applyAutostart: () => {},
        openFolder: async () => ({ opened: false, path: null, error: null }),
        saveFile: async () => ({ saved: false, path: null }),
        saveFolder: async () => ({ saved: false, path: null }),
        showNotification: () => true
    };
}

function buildTool() {
    const Container = require('../src/main/Container');
    const root = path.join(__dirname, '..');
    const container = new Container({
        dbPath: ':memory:',
        configDir: path.join(root, 'config'),
        migrationsDir: path.join(root, 'migrations'),
        rendererRoot: path.join(root, 'src', 'renderer'),
        userModulesDir: null,
        userLocalesDir: null,
        system: stubSystem(),
        appVersion: 'i18n'
    }).build();
    return new I18nTool({
        config: resolve(container, 'configService', 'config', 'configs'),
        registry: resolve(container, 'registry', 'moduleRegistry', 'modules'),
        locale: resolve(container, 'localeService', 'locale', 'locales'),
        configFile: path.join(root, 'config', 'app.json'),
        root
    });
}

function printStatus(result) {
    process.stdout.write(`Source: ${result.source}, reference: ${result.reference}\n`);
    for (const scope of result.scopes) {
        process.stdout.write(`Scope: ${scope.scope}\n`);
        for (const language of result.languages) {
            const file = scope.files[language.code];
            const flags = [];
            if (!file.exists) flags.push('missing-file');
            if (file.error) flags.push(`error: ${file.error}`);
            const suffix = flags.length ? `  ${flags.join('; ')}` : '';
            process.stdout.write(
                `  ${language.code}  ${file.relative || '(none)'}  keys=${file.keys} missing=${file.missing.length} extra=${file.extra.length} untranslated=${file.untranslated.length}${suffix}\n`
            );
        }
    }
    process.stdout.write('Totals:\n');
    for (const language of result.languages) {
        process.stdout.write(
            `  ${language.code}  ${language.percent}%  keys=${language.keys} missing=${language.missing} extra=${language.extra} untranslated=${language.untranslated}\n`
        );
    }
}

async function main() {
    const { positional, options } = parseArgs(process.argv.slice(2));
    const command = positional[0];
    const tool = buildTool();
    if (command === 'status') {
        const result = await tool.status({ source: options.source });
        if (options.json) {
            process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
            return 0;
        }
        printStatus(result);
        return 0;
    }
    if (command === 'files') {
        const code = positional[1];
        if (!code) {
            throw new Error('Укажите код языка: i18n files <код>');
        }
        const list = await tool.files(code, { missing: Boolean(options.missing) });
        for (const entry of list) {
            const mark = entry.exists ? 'exists' : 'create';
            process.stdout.write(`[${mark}] ${entry.relative} (${entry.keys} keys, ${entry.missing.length} missing)\n`);
        }
        return 0;
    }
    if (command === 'add') {
        const [code, name, locale] = positional.slice(1);
        if (!code || !name || !locale) {
            throw new Error('Использование: i18n add <код> "<Название>" <locale>');
        }
        const result = await tool.add(code, name, locale, { fallback: options.fallback, from: options.from });
        process.stdout.write(
            `Добавлен язык ${result.code} (${result.name}, ${result.locale}), файлов: ${result.created.length}, ключей: ${result.totalKeys}\n`
        );
        for (const entry of result.created) {
            process.stdout.write(`  ${entry.relative} (${entry.keys})\n`);
        }
        return 0;
    }
    if (command === 'check') {
        const code = positional[1];
        const problems = await tool.check(code, { allowMissing: Boolean(options['allow-missing']) });
        if (problems.length === 0) {
            process.stdout.write('Проблем не найдено\n');
            return 0;
        }
        for (const problem of problems) {
            const location = problem.file || problem.scope || problem.language;
            const key = problem.key ? ` [${problem.key}]` : '';
            process.stdout.write(`${location}${key}: ${problem.message}\n`);
        }
        return 1;
    }
    process.stderr.write('Команды: status, files, add, check\n');
    return 1;
}

module.exports = I18nTool;
module.exports.I18nTool = I18nTool;
module.exports.buildTool = buildTool;
module.exports.parseArgs = parseArgs;
module.exports.main = main;

if (require.main === module) {
    main().then((code) => {
        process.exitCode = code;
    }).catch((error) => {
        process.stderr.write(`${error.message}\n`);
        process.exitCode = 1;
    });
}