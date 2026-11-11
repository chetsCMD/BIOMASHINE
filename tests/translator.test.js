const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { checkScope, checkDictionaries, cyrillicLiterals, usedKeys, loadI18n } = require('./support/I18nScan');

const root = path.join(__dirname, '..');
const renderer = path.join(root, 'src', 'renderer');
const load = (...parts) => import(pathToFileURL(path.join(renderer, ...parts)).href);

test('Translator: подстановки, формы множественного числа, запасные случаи', async () => {
    const { Translator } = await load('sdk', 'Translator.js');
    const ru = new Translator({
        language: 'ru',
        locale: 'ru-RU',
        strings: {
            hello: 'Привет, {name}!',
            count: { one: '{count} запись', few: '{count} записи', many: '{count} записей', other: '{count} записи' },
            only: { other: 'всегда {count}' }
        }
    });
    assert.equal(ru.t('hello', { name: 'Олег' }), 'Привет, Олег!');
    assert.equal(ru.t('hello'), 'Привет, {name}!');
    assert.deepEqual([1, 2, 5, 11, 21, 22, 25].map((count) => ru.t('count', { count })), ['1 запись', '2 записи', '5 записей', '11 записей', '21 запись', '22 записи', '25 записей']);
    assert.equal(ru.t('count', { count: 1.5 }), '1.5 записи');
    assert.equal(ru.t('count'), '{count} записи');
    assert.equal(ru.t('only', { count: 3 }), 'всегда 3');
    assert.equal(ru.t('absent.key'), 'absent.key');
    assert.deepEqual([...ru.missing], ['absent.key']);
    assert.equal(ru.has('hello'), true);
    assert.equal(ru.has('toString'), false);
    const en = new Translator({ language: 'en', locale: 'en-US', strings: { count: { one: '{count} entry', other: '{count} entries' } } });
    assert.deepEqual([0, 1, 2].map((count) => en.t('count', { count })), ['0 entries', '1 entry', '2 entries']);
    ru.load({ language: 'en', locale: 'en-US', strings: { hello: 'Hi' } });
    assert.equal(ru.t('hello'), 'Hi');
    assert.equal(ru.language, 'en');
    const broken = new Translator({ language: 'xx', locale: 'not a locale!!', strings: { a: 'b' } });
    assert.equal(broken.t('a'), 'b');
});

test('DomTranslator: текст и атрибуты по data-i18n', async () => {
    const { DomTranslator } = await load('sdk', 'DomTranslator.js');
    const { Translator } = await load('sdk', 'Translator.js');
    const makeNode = (attributes) => ({
        attributes: { ...attributes },
        textContent: 'старый',
        getAttributeNames() {
            return Object.keys(this.attributes);
        },
        getAttribute(name) {
            return this.attributes[name];
        },
        setAttribute(name, value) {
            this.attributes[name] = value;
        }
    });
    const title = makeNode({ 'data-i18n': 'title', class: 'x' });
    const input = makeNode({ 'data-i18n-placeholder': 'search', 'data-i18n-aria-label': 'search', 'data-other': 'nope' });
    const plain = makeNode({ id: 'a' });
    const root = { querySelectorAll: (selector) => (selector === '*' ? [title, input, plain] : []) };
    DomTranslator.apply(root, new Translator({ language: 'en', locale: 'en-US', strings: { title: 'Hello', search: 'Search' } }));
    assert.equal(title.textContent, 'Hello');
    assert.equal(input.attributes.placeholder, 'Search');
    assert.equal(input.attributes['aria-label'], 'Search');
    assert.equal(input.textContent, 'старый');
    assert.equal(plain.textContent, 'старый');
    assert.equal(input.attributes['data-other'], 'nope');
});

test('помощники проверки: поиск ключей, русских литералов и расхождений словарей', () => {
    const { keys, dynamic } = usedKeys("this.bm.t('a.b', { n: 1 }); i18n.t(\"c\"); x.t(item.titleKey); y.t(`k.${id}`); z.t(name); w.t(on ? 'f' : 'g'); v.t(key, p);", '<p data-i18n="d">q</p><input data-i18n-placeholder="e">');
    assert.deepEqual([...keys].sort(), ['a.b', 'c', 'd', 'e', 'f', 'g']);
    assert.deepEqual(dynamic, ['`k.${id}`', 'name']);
    assert.deepEqual(cyrillicLiterals("const a = 'English'; const b = `Привет ${x}`; const c = \"ещё\";"), ['Привет ${x}', 'ещё']);
});

test('MenuLayout: помещение в панель, крайние случаи', async () => {
    const { MenuLayout } = await load('shell', 'MenuLayout.js');
    const items = [
        { id: 'a', width: 50 },
        { id: 'b', width: 50 },
        { id: 'c', width: 50 },
        { id: 'd', width: 50 }
    ];
    const options = { gap: 10, moreWidth: 60, settingsWidth: 70 };
    const wide = MenuLayout.fit(items, 500, options);
    assert.equal(wide.needsMore, false);
    assert.deepEqual(wide.visible.map((i) => i.id), ['a', 'b', 'c', 'd']);
    assert.deepEqual(wide.overflow, []);
    const overflow = MenuLayout.fit(items, 200, options);
    assert.equal(overflow.needsMore, true);
    assert.deepEqual(overflow.visible.map((i) => i.id), ['a']);
    assert.deepEqual(overflow.overflow.map((i) => i.id), ['b', 'c', 'd']);
    const noSpace = MenuLayout.fit(items, 0, options);
    assert.equal(noSpace.needsMore, true);
    assert.deepEqual(noSpace.visible, []);
    assert.deepEqual(noSpace.overflow.map((i) => i.id), ['a', 'b', 'c', 'd']);
    const empty = MenuLayout.fit([], 200, options);
    assert.equal(empty.needsMore, false);
    assert.deepEqual(empty.visible, []);
    assert.deepEqual(empty.overflow, []);
    const exactAll = MenuLayout.fit(items, 310, options);
    assert.equal(exactAll.needsMore, false);
    assert.equal(exactAll.visible.length, 4);
    const justBelowAll = MenuLayout.fit(items, 309, options);
    assert.equal(justBelowAll.needsMore, true);
    assert.deepEqual(justBelowAll.visible.map((i) => i.id), ['a', 'b']);
    const exactTwo = MenuLayout.fit(items, 260, options);
    assert.equal(exactTwo.needsMore, true);
    assert.deepEqual(exactTwo.visible.map((i) => i.id), ['a', 'b']);
    const justBelowTwo = MenuLayout.fit(items, 259, options);
    assert.equal(justBelowTwo.needsMore, true);
    assert.deepEqual(justBelowTwo.visible.map((i) => i.id), ['a']);
    const onlyMore = MenuLayout.fit(items, 140, options);
    assert.equal(onlyMore.needsMore, true);
    assert.deepEqual(onlyMore.visible, []);
    assert.equal(onlyMore.overflow.length, 4);
});

test('MenuLayout: порядок не меняется, нечисловые широты считаются нулём', async () => {
    const { MenuLayout } = await load('shell', 'MenuLayout.js');
    const items = [
        { id: 'x', width: 20 },
        { id: 'y', width: 30 }
    ];
    const result = MenuLayout.fit(items, 1000, { gap: 5, moreWidth: 40, settingsWidth: 50 });
    assert.deepEqual(result.visible.map((i) => i.id), ['x', 'y']);
    const broken = MenuLayout.fit([{ id: 'p' }, { id: 'q', width: 40 }], 200, { gap: 0, moreWidth: 0, settingsWidth: 0 });
    assert.equal(broken.needsMore, false);
    assert.equal(broken.visible.length, 2);
});

test('оболочка: все встроенные языки согласованы, все ключи есть, русских текстов в коде нет', () => {
    const i18n = loadI18n(root);
    const shell = path.join(renderer, 'shell');
    const jsFiles = fs.readdirSync(shell).filter((file) => file.endsWith('.js') && file !== 'TextSearch.js').map((file) => path.join(shell, file));
    const result = checkScope({
        label: 'shell',
        jsFiles,
        htmlFiles: [path.join(shell, 'index.html')],
        dictionaryDir: path.join(shell, 'locales'),
        keyProperty: false,
        i18n
    });
    assert.deepEqual(result.problems, []);
    assert.ok(result.used.size > 40);
    const referenceStrings = result.dictionaries.get(i18n.reference).strings;
    const allowed = new Set([
        'palette.settingsKeywords',
        'palette.hubKeywords',
        'shortcut.fullscreen',
        'shortcut.quickSwitch',
        'shortcut.moduleHub',
        'category.body',
        'category.mind',
        'category.finance',
        'category.knowledge',
        'category.environment',
        'category.other',
        'trash.nutrition.add', 'trash.nutrition.update', 'trash.nutrition.remove',
        'trash.sleep.add', 'trash.sleep.update', 'trash.sleep.remove',
        'trash.running.add', 'trash.running.update', 'trash.running.remove',
        'trash.workouts.add', 'trash.workouts.update', 'trash.workouts.remove',
        'trash.measurements.add', 'trash.measurements.update', 'trash.measurements.remove',
        'trash.mood.add', 'trash.mood.update', 'trash.mood.remove',
        'trash.reaction.add', 'trash.reaction.remove',
        'trash.profile.update',
        'trash.storage.add', 'trash.storage.update', 'trash.storage.remove'
    ]);
    const unused = Object.keys(referenceStrings).filter((key) => !result.used.has(key) && !allowed.has(key));
    assert.deepEqual(unused, []);
});

test('общий словарь: все встроенные языки согласованы', () => {
    const i18n = loadI18n(root);
    const dir = path.join(renderer, 'shared', 'locales');
    const { problems } = checkDictionaries(i18n, dir);
    assert.deepEqual(problems, []);
});

test('словари не завязаны на ru и en: воображаемый язык de проходит те же проверки', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-i18n-de-'));
    const localeDir = path.join(base, 'locales');
    fs.mkdirSync(localeDir, { recursive: true });
    const i18n = {
        ...loadI18n(root),
        builtin: [...loadI18n(root).builtin, { code: 'de', name: 'Deutsch', locale: 'de-DE' }]
    };
    const write = (code, strings) => fs.writeFileSync(path.join(localeDir, `${code}.json`), `${JSON.stringify(strings, null, 2)}\n`, 'utf8');
    write('ru', { hello: 'Привет', count: { one: '{n} запись', few: '{n} записи', many: '{n} записей', other: '{n} записи' } });
    write('en', { hello: 'Hello', count: { one: '{n} entry', other: '{n} entries' } });
    write('de', { hello: 'Hallo', count: { one: '{n} Eintrag', other: '{n} Einträge' } });
    assert.deepEqual(checkDictionaries(i18n, localeDir).problems, []);

    write('de', { hello: 'Hallo' });
    const missingKey = checkDictionaries(i18n, localeDir);
    assert.ok(missingKey.problems.some((message) => message.includes('count') && message.includes('de')), JSON.stringify(missingKey.problems));

    write('de', { hello: 'Hallo {x}', count: { one: '{n} Eintrag', other: '{n} Einträge' } });
    const wrongPlaceholder = checkDictionaries(i18n, localeDir);
    assert.ok(wrongPlaceholder.problems.some((message) => message.includes('hello')), JSON.stringify(wrongPlaceholder.problems));

    write('de', { hello: 'Hallo', count: { one: '{n} Eintrag' } });
    const missingForm = checkDictionaries(i18n, localeDir);
    assert.ok(missingForm.problems.some((message) => message.includes('count') && message.includes('other')), JSON.stringify(missingForm.problems));

    write('de', { hello: 'Hallo', count: { one: '{n} Eintrag', other: '{n} Einträge' }, extra_de: 'Extra' });
    const extraKey = checkDictionaries({ ...i18n, reference: 'de' }, localeDir);
    assert.ok(extraKey.problems.some((message) => message.includes('extra_de')), JSON.stringify(extraKey.problems));

    write('de', { hello: 'Hallo', count: { one: '{n} Eintrag', other: '{n} Einträge' } });
    assert.deepEqual(checkDictionaries(i18n, localeDir).problems, []);

    const optional = { ...i18n, required: ['ru', 'en'] };
    fs.unlinkSync(path.join(localeDir, 'de.json'));
    assert.deepEqual(checkDictionaries(optional, localeDir).problems, []);

    const forced = { ...i18n, required: ['ru', 'en', 'de'] };
    const requiredMissing = checkDictionaries(forced, localeDir);
    assert.ok(requiredMissing.problems.some((message) => message.includes('de') && message.includes('отсутствует')), JSON.stringify(requiredMissing.problems));
});

test('словарь оболочки: ключи уведомлений в обеих локалях', () => {
    const dir = path.join(renderer, 'shell', 'locales');
    const ru = JSON.parse(fs.readFileSync(path.join(dir, 'ru.json'), 'utf8'));
    const en = JSON.parse(fs.readFileSync(path.join(dir, 'en.json'), 'utf8'));
    const keys = ['settings.section.notifications', 'settings.notifications.empty', 'settings.notifications.count'];
    for (const key of keys) {
        assert.equal(typeof ru[key], 'string', `ru.${key}`);
        assert.equal(typeof en[key], 'string', `en.${key}`);
        assert.ok(ru[key].length > 0, `ru.${key} пуст`);
        assert.ok(en[key].length > 0, `en.${key} пуст`);
    }
});

test('словарь оболочки: ключи корзины в обеих локалях', () => {
    const dir = path.join(renderer, 'shell', 'locales');
    const ru = JSON.parse(fs.readFileSync(path.join(dir, 'ru.json'), 'utf8'));
    const en = JSON.parse(fs.readFileSync(path.join(dir, 'en.json'), 'utf8'));
    const uiKeys = ['settings.section.trash', 'trash.info', 'trash.empty', 'trash.undo', 'trash.confirm', 'trash.confirmYes', 'trash.confirmNo', 'trash.conflict', 'trash.entries'];
    for (const key of uiKeys) {
        assert.equal(typeof ru[key], 'string', `ru.${key}`);
        assert.equal(typeof en[key], 'string', `en.${key}`);
        assert.ok(ru[key].length > 0, `ru.${key} пуст`);
        assert.ok(en[key].length > 0, `en.${key} пуст`);
    }
    const labelKeys = [
        'trash.nutrition.add', 'trash.nutrition.update', 'trash.nutrition.remove',
        'trash.sleep.add', 'trash.sleep.update', 'trash.sleep.remove',
        'trash.running.add', 'trash.running.update', 'trash.running.remove',
        'trash.workouts.add', 'trash.workouts.update', 'trash.workouts.remove',
        'trash.measurements.add', 'trash.measurements.update', 'trash.measurements.remove',
        'trash.mood.add', 'trash.mood.update', 'trash.mood.remove',
        'trash.reaction.add', 'trash.reaction.remove',
        'trash.profile.update',
        'trash.storage.add', 'trash.storage.update', 'trash.storage.remove'
    ];
    for (const key of labelKeys) {
        assert.equal(typeof ru[key], 'string', `ru.${key}`);
        assert.equal(typeof en[key], 'string', `en.${key}`);
        assert.ok(ru[key].length > 0, `ru.${key} пуст`);
        assert.ok(en[key].length > 0, `en.${key} пуст`);
    }
});

test('конфиги ссылаются на существующие ключи общего словаря', () => {
    const shared = JSON.parse(fs.readFileSync(path.join(renderer, 'shared', 'locales', 'ru.json'), 'utf8'));
    const themes = JSON.parse(fs.readFileSync(path.join(root, 'config', 'themes.json'), 'utf8')).themes;
    for (const theme of Object.values(themes)) {
        assert.ok(theme.titleKey in shared, theme.titleKey);
    }
    const achievements = JSON.parse(fs.readFileSync(path.join(root, 'config', 'achievements.json'), 'utf8')).running;
    for (const item of achievements) {
        assert.ok(item.nameKey in shared && item.descriptionKey in shared, item.id);
    }
});

test('BmClock: время выбранной зоны, переход через полночь, запасной вариант', async () => {
    const { BmClock } = await load('sdk', 'BmClock.js');
    const at = (iso) => () => new Date(iso);
    const tokyo = new BmClock('Asia/Tokyo', at('2026-03-01T22:30:00Z'));
    assert.equal(tokyo.timestamp(), '2026-03-02 07:30:00');
    assert.equal(tokyo.today(), '2026-03-02');
    const wall = tokyo.now();
    assert.deepEqual([wall.getFullYear(), wall.getMonth(), wall.getDate(), wall.getHours(), wall.getMinutes()], [2026, 2, 2, 7, 30]);
    const la = new BmClock('America/Los_Angeles', at('2026-03-01T22:30:00Z'));
    assert.equal(la.today(), '2026-03-01');
    assert.equal(la.now().getHours(), 14);
    const fallback = new BmClock('Not/AZone', at('2026-03-01T22:30:00Z'));
    assert.equal(fallback.timezone, 'system');
    const system = new BmClock(undefined, at('2026-03-01T22:30:00Z'));
    assert.equal(system.timezone, 'system');
    assert.match(system.timestamp(), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    assert.equal(new BmClock('UTC', at('2026-12-31T23:59:59Z')).today(), '2026-12-31');
    assert.equal(new BmClock('Pacific/Kiritimati', at('2026-12-31T23:59:59Z')).today(), '2027-01-01');
});