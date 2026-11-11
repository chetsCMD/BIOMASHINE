const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createI18nTool } = require('./helpers');

function setup() {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'biomashine-i18n-'));
    const configDir = path.join(base, 'config');
    const rendererRoot = path.join(base, 'renderer');
    fs.cpSync(path.join(__dirname, '..', 'config'), configDir, { recursive: true });
    fs.mkdirSync(path.join(rendererRoot, 'shell', 'locales'), { recursive: true });
    fs.mkdirSync(path.join(rendererRoot, 'shared', 'locales'), { recursive: true });
    fs.mkdirSync(path.join(rendererRoot, 'modules'), { recursive: true });
    const files = {
        'shell/locales/en.json': {
            'nav.settings': 'Settings',
            'nav.about': 'About',
            'items': { one: '{count} item', other: '{count} items' }
        },
        'shell/locales/ru.json': {
            'nav.settings': 'Настройки',
            'nav.about': 'О программе',
            'items': {
                one: '{count} предмет',
                few: '{count} предмета',
                many: '{count} предметов',
                other: '{count} предмета'
            }
        },
        'shared/locales/en.json': { 'button.save': 'Save' },
        'shared/locales/ru.json': { 'button.save': 'Сохранить' }
    };
    for (const [relative, value] of Object.entries(files)) {
        fs.writeFileSync(path.join(rendererRoot, relative), JSON.stringify(value, null, 2));
    }
    const app = createI18nTool({ configDir, rendererRoot, mainLocalesDir: null });
    return { base, configDir, rendererRoot, ...app };
}

test('add создаёт файлы языка и обновляет i18n.builtin', async () => {
    const { tool, configDir, rendererRoot } = setup();
    const result = await tool.add('de', 'Deutsch', 'de-DE');
    assert.equal(result.code, 'de');
    assert.ok(result.created.length >= 2);
    assert.ok(result.totalKeys > 0);
    const shellDe = JSON.parse(fs.readFileSync(path.join(rendererRoot, 'shell', 'locales', 'de.json'), 'utf8'));
    assert.deepEqual(Object.keys(shellDe.items).sort(), ['one', 'other']);
    assert.equal(shellDe.items.other, '{count} items');
    const app = JSON.parse(fs.readFileSync(path.join(configDir, 'app.json'), 'utf8'));
    const entry = app.i18n.builtin.find((item) => item.code === 'de');
    assert.ok(entry);
    assert.equal(entry.locale, 'de-DE');
    assert.ok(tool.locale.languages().some((language) => language.code === 'de'));
    await assert.rejects(tool.add('de', 'Deutsch', 'de-DE'), /уже есть/);
});

test('files перечисляет области и помечает отсутствующие файлы', async () => {
    const { tool, rendererRoot } = setup();
    const existing = await tool.files('en');
    assert.deepEqual(existing.map((entry) => entry.scope).sort(), ['shared', 'shell']);
    assert.ok(existing.every((entry) => entry.exists));
    const missing = await tool.files('de');
    assert.deepEqual(missing.map((entry) => entry.scope).sort(), ['shared', 'shell']);
    assert.ok(missing.every((entry) => entry.exists === false));
    assert.ok(missing.every((entry) => entry.needsWork));
    const onlyMissing = await tool.files('de', { missing: true });
    assert.equal(onlyMissing.length, missing.length);
    fs.mkdirSync(path.join(rendererRoot, 'shell', 'locales'), { recursive: true });
    fs.writeFileSync(path.join(rendererRoot, 'shell', 'locales', 'de.json'), '{}');
    const after = await tool.files('de');
    const shell = after.find((entry) => entry.scope === 'shell');
    assert.equal(shell.exists, true);
    assert.ok(shell.missing.length > 0);
    assert.ok(shell.needsWork);
});

test('status считает отсутствующие и непереведённые значения', async () => {
    const { tool, rendererRoot } = setup();
    await tool.add('de', 'Deutsch', 'de-DE');
    const deFile = path.join(rendererRoot, 'shell', 'locales', 'de.json');
    const strings = JSON.parse(fs.readFileSync(deFile, 'utf8'));
    delete strings['nav.about'];
    fs.writeFileSync(deFile, JSON.stringify(strings, null, 2));
    const result = await tool.status({});
    const de = result.languages.find((language) => language.code === 'de');
    assert.ok(de);
    assert.ok(de.missing >= 1);
    assert.ok(de.untranslated >= 1);
    const shell = result.scopes.find((scope) => scope.scope === 'shell');
    assert.ok(shell.files.de.missing.includes('nav.about'));
    assert.ok(shell.files.de.untranslated.includes('nav.settings'));
    const ru = result.languages.find((language) => language.code === 'ru');
    assert.equal(ru.untranslated, 0);
    const en = result.languages.find((language) => language.code === 'en');
    assert.equal(en.untranslated, 0);
});

test('check проверяет формы множественного числа для de, pl и ar', async () => {
    const { tool } = setup();
    const languages = [
        ['de', 'Deutsch', 'de-DE'],
        ['pl', 'Polski', 'pl-PL'],
        ['ar', 'العربية', 'ar-EG']
    ];
    for (const [code, name, locale] of languages) {
        await tool.add(code, name, locale);
        const problems = await tool.check(code);
        const plural = problems.filter((problem) => problem.message.includes('форм'));
        assert.equal(plural.length, 0, `${code}: ${JSON.stringify(plural)}`);
    }
});

test('check находит недостающую форму множественного числа', async () => {
    const { tool, rendererRoot } = setup();
    await tool.add('de', 'Deutsch', 'de-DE');
    const deFile = path.join(rendererRoot, 'shell', 'locales', 'de.json');
    const strings = JSON.parse(fs.readFileSync(deFile, 'utf8'));
    strings.items = { one: '{count} item' };
    fs.writeFileSync(deFile, JSON.stringify(strings, null, 2));
    const problems = await tool.check('de');
    assert.ok(problems.some((problem) => problem.key === 'items' && problem.message.includes('other')));
    const allowed = await tool.check('de', { allowMissing: true });
    assert.ok(allowed.some((problem) => problem.key === 'items' && problem.message.includes('other')));
});