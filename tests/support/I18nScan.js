const fs = require('fs');
const path = require('path');

const CYRILLIC = /[А-Яа-яЁё]/;

function readText(file) {
    return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

function loadI18n(root) {
    return JSON.parse(readText(path.join(root, 'config', 'app.json'))).i18n;
}

function placeholders(text) {
    return [...new Set([...String(text).matchAll(/\{(\w+)\}/g)].map((match) => match[1]))].sort();
}

function pluralCategories(locale) {
    try {
        return new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
    } catch {
        return ['other'];
    }
}

function normalizeForms(value) {
    if (typeof value === 'string') {
        return { '': value };
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value;
    }
    return null;
}

function usedKeys(code, html, keyProperty = true) {
    const keys = new Set();
    const translationKeys = new Set();
    const dynamic = [];
    let rest = code;
    const ternary = /\bt\(\s*[^()?]*\?\s*['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]\s*[,)]/g;
    for (const [, first, second] of code.matchAll(ternary)) {
        keys.add(first);
        keys.add(second);
        translationKeys.add(first);
        translationKeys.add(second);
    }
    rest = rest.replace(ternary, 't(__ternary__)');
    for (const [, key] of rest.matchAll(/\bt\(\s*['"]([^'"]+)['"]/g)) {
        keys.add(key);
        translationKeys.add(key);
    }
    for (const [, argument] of rest.matchAll(/\bt\(\s*([^'"\s)][^,)]*)/g)) {
        const text = argument.trim();
        if (text !== '__ternary__' && !/(^|\.)key$/.test(text) && !/Key$/.test(text)) {
            dynamic.push(text);
        }
    }
    if (keyProperty) {
        for (const [, key] of rest.matchAll(/\b(?:key|\w+Key)\s*:\s*['"]([^'"]+)['"]/g)) {
            keys.add(key);
        }
    }
    for (const [, key] of (html || '').matchAll(/\sdata-i18n(?:-[a-z-]+)?="([^"]+)"/g)) {
        keys.add(key);
        translationKeys.add(key);
    }
    return { keys, dynamic, translationKeys };
}

function cyrillicLiterals(code) {
    const found = [];
    for (const match of code.matchAll(/(['"`])((?:(?!\1)[^\\\n]|\\.)*)\1/g)) {
        if (CYRILLIC.test(match[2])) {
            found.push(match[2]);
        }
    }
    return found;
}

function compareDictionaries(reference, other, options = {}) {
    const problems = [];
    if (!reference || !other) {
        return problems;
    }
    const referenceName = options.referenceName || 'reference';
    const otherName = options.otherName || 'other';
    const referenceLocale = options.referenceLocale;
    const otherLocale = options.otherLocale;
    const refKeys = Object.keys(reference);
    const otherKeys = Object.keys(other);
    for (const key of refKeys.filter((item) => !(item in other))) {
        problems.push(`ключ «${key}» есть в ${referenceName}, но нет в ${otherName}`);
    }
    for (const key of otherKeys.filter((item) => !(item in reference))) {
        problems.push(`ключ «${key}» есть в ${otherName}, но нет в ${referenceName}`);
    }
    const refCategories = referenceLocale ? pluralCategories(referenceLocale) : [];
    const otherCategories = otherLocale ? pluralCategories(otherLocale) : [];
    for (const key of refKeys.filter((item) => item in other)) {
        const refForms = normalizeForms(reference[key]);
        const otherForms = normalizeForms(other[key]);
        if (!refForms || !otherForms) {
            problems.push(`ключ «${key}»: некорректное значение в ${!refForms ? referenceName : otherName}`);
            continue;
        }
        if ((typeof reference[key] === 'object') !== (typeof other[key] === 'object')) {
            problems.push(`ключ «${key}»: в ${referenceName} и ${otherName} разный тип (строка или формы множественного числа)`);
            continue;
        }
        if (typeof reference[key] === 'object') {
            for (const form of refCategories.filter((name) => !(name in refForms))) {
                problems.push(`ключ «${key}»: в ${referenceName} нет формы ${form}`);
            }
            for (const form of otherCategories.filter((name) => !(name in otherForms))) {
                problems.push(`ключ «${key}»: в ${otherName} нет формы ${form}`);
            }
        }
        const sets = [...Object.values(refForms), ...Object.values(otherForms)].map(placeholders);
        const first = sets[0].join(',');
        if (sets.some((set) => set.join(',') !== first)) {
            problems.push(`ключ «${key}»: подстановки {…} различаются между формами или языками`);
        }
    }
    return problems;
}

function checkDictionaries(i18n, dictionaryDir) {
    const problems = [];
    const required = i18n.required || [];
    const reference = i18n.reference || (i18n.builtin && i18n.builtin[0] && i18n.builtin[0].code) || 'en';
    const dictionaries = new Map();
    for (const entry of i18n.builtin || []) {
        const file = path.join(dictionaryDir, `${entry.code}.json`);
        const exists = fs.existsSync(file);
        let strings = null;
        let error = null;
        if (exists) {
            try {
                strings = JSON.parse(readText(file));
            } catch (parseError) {
                error = parseError.message;
            }
        }
        dictionaries.set(entry.code, { entry, file, exists, strings, error });
        if (required.includes(entry.code) && !exists) {
            problems.push(`обязательный словарь ${entry.code}.json отсутствует`);
        }
        if (error) {
            problems.push(`словарь ${entry.code}.json: некорректный JSON (${error})`);
        }
    }
    const referenceDict = dictionaries.get(reference);
    if (!referenceDict || !referenceDict.exists || referenceDict.error) {
        problems.push(`эталонный словарь ${reference}.json недоступен`);
        return { problems, dictionaries };
    }
    for (const [code, dict] of dictionaries) {
        if (code === reference || !dict.exists || dict.error) {
            continue;
        }
        problems.push(...compareDictionaries(referenceDict.strings, dict.strings, {
            referenceName: reference,
            otherName: code,
            referenceLocale: referenceDict.entry.locale,
            otherLocale: dict.entry.locale
        }));
    }
    return { problems, dictionaries };
}

function checkScope({ label, jsFiles, htmlFiles = [], dictionaryDir, extraKeys = [], allowCyrillicIn = [], shared = {}, i18n, enforceUnused = false, keyProperty = true }) {
    if (!i18n) {
        throw new Error('checkScope: требуется i18n из config/app.json');
    }
    const problems = [];
    const required = i18n.required || [];
    const reference = i18n.reference || (i18n.builtin && i18n.builtin[0] && i18n.builtin[0].code) || 'en';
    const { problems: dictProblems, dictionaries } = checkDictionaries(i18n, dictionaryDir);
    for (const item of dictProblems) {
        problems.push(`${label}: ${item}`);
    }
    const referenceDict = dictionaries.get(reference);
    const referenceStrings = referenceDict && referenceDict.strings ? referenceDict.strings : {};
    const used = new Set(extraKeys);
    const translationUsed = new Set(extraKeys);
    const quoted = new Set();
    for (const file of jsFiles) {
        const code = readText(file);
        for (const [, literal] of code.matchAll(/['"]([^'"\n]+)['"]/g)) {
            quoted.add(literal);
        }
        const { keys, dynamic, translationKeys } = usedKeys(code, '', keyProperty);
        keys.forEach((key) => used.add(key));
        translationKeys.forEach((key) => translationUsed.add(key));
        for (const expression of dynamic) {
            problems.push(`${path.basename(file)}: ключ перевода должен быть строковым литералом или полем, оканчивающимся на Key: t(${expression})`);
        }
        if (!allowCyrillicIn.includes(path.basename(file))) {
            for (const literal of cyrillicLiterals(code)) {
                problems.push(`${path.basename(file)}: русский текст вне словаря: ${literal.slice(0, 60)}`);
            }
        }
    }
    for (const file of htmlFiles) {
        const html = readText(file);
        const { keys, translationKeys } = usedKeys('', html, keyProperty);
        keys.forEach((key) => used.add(key));
        translationKeys.forEach((key) => translationUsed.add(key));
        for (const match of html.matchAll(/<([a-z0-9]+)\b[^>]*\sdata-i18n="([^"]+)"[^>]*>([^<]*)</g)) {
            const [, , key, text] = match;
            const expected = key in referenceStrings ? referenceStrings[key] : (shared[reference] && shared[reference][key]);
            if (typeof expected === 'string' && text.trim() !== expected) {
                problems.push(`${path.basename(file)}: текст внутри элемента с data-i18n="${key}" должен совпадать с ${reference}.json («${expected}»)`);
            }
        }
    }
    for (const key of Object.keys(referenceStrings)) {
        if (quoted.has(key)) {
            used.add(key);
            translationUsed.add(key);
        }
    }
    for (const key of translationUsed) {
        for (const code of required) {
            const dict = dictionaries.get(code);
            const strings = dict && dict.strings ? dict.strings : {};
            const sharedStrings = shared[code] || {};
            if (!(key in strings) && !(key in sharedStrings)) {
                problems.push(`${label}: ключ «${key}» используется, но отсутствует в ${code}.json (и в общем словаре ${code})`);
            }
        }
    }
    if (enforceUnused) {
        for (const key of Object.keys(referenceStrings).filter((item) => !used.has(item))) {
            problems.push(`${label}: ключ «${key}» есть в словаре, но нигде не используется`);
        }
    }
    const ru = dictionaries.get('ru') && dictionaries.get('ru').strings ? dictionaries.get('ru').strings : {};
    const en = dictionaries.get('en') && dictionaries.get('en').strings ? dictionaries.get('en').strings : {};
    return { problems, used, translationUsed, dictionaries, reference: referenceStrings, ru, en };
}

module.exports = {
    checkScope,
    checkDictionaries,
    compareDictionaries,
    usedKeys,
    cyrillicLiterals,
    placeholders,
    pluralCategories,
    readText,
    loadI18n,
    CYRILLIC
};