const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp, rejects } = require('./helpers');
const ConfigService = require('../src/main/core/ConfigService');
const Values = require('../src/main/core/Values');
const ModuleRegistry = require('../src/main/services/ModuleRegistry');
const AssetResolver = require('../src/main/core/AssetResolver');
const MimeTypes = require('../src/main/core/MimeTypes');

const root = path.join(__dirname, '..');
const systemIds = fs.readdirSync(path.join(root, 'src', 'renderer', 'modules')).sort();
const config = new ConfigService(path.join(root, 'config'));

function temporaryModules(manifests) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-modules-'));
    for (const [name, manifest] of Object.entries(manifests)) {
        fs.mkdirSync(path.join(dir, name));
        fs.writeFileSync(path.join(dir, name, 'manifest.json'), typeof manifest === 'string' ? manifest : JSON.stringify(manifest));
    }
    return dir;
}

test('реестр находит встроенные модули и все манифесты валидны', () => {
    const registry = new ModuleRegistry([{ dir: path.join(root, 'src', 'renderer', 'modules'), source: 'system' }], config).scan();
    assert.deepEqual(registry.errors, []);
    for (const module of registry.all()) {
        assert.ok(fs.existsSync(path.join(module.dir, module.entry)), `нет входной страницы у ${module.id}`);
        assert.ok(fs.existsSync(path.join(module.dir, 'README.md')), `нет README у ${module.id}`);
    }
    assert.ok(registry.get('reaction'));
});

test('реестр отклоняет неверные манифесты и не падает', () => {
    const dir = temporaryModules({
        good: { id: 'good', kind: 'page', title: 'Хороший', channels: ['sleep:*', 'profile:get'], category: 'body' },
        wrongid: { id: 'other', kind: 'page', title: 'X' },
        upper: { id: 'Upper', kind: 'page', title: 'X' },
        reserved: { id: 'app', kind: 'page', title: 'X' },
        badkind: { id: 'badkind', kind: 'widget', title: 'X' },
        notitle: { id: 'notitle', kind: 'page' },
        escape: { id: 'escape', kind: 'page', title: 'X', entry: '../../etc/passwd' },
        badchannels: { id: 'badchannels', kind: 'page', title: 'X', channels: ['anything'] },
        badcategory: { id: 'badcategory', kind: 'page', title: 'X', category: 'BAD' },
        plugin: { id: 'plugin', kind: 'plugin', title: 'Стиль', css: ['a.css'] },
        nocss: { id: 'nocss', kind: 'plugin', title: 'X' },
        broken: '{not json'
    });
    const registry = new ModuleRegistry([{ dir, source: 'user' }], config).scan();
    assert.deepEqual(registry.all().map((m) => m.id).sort(), ['good', 'plugin']);
    assert.equal(registry.errors.length, 10);
    assert.equal(registry.get('good').entry, 'index.html');
    assert.equal(registry.get('good').order, 1000);
    assert.equal(registry.get('good').category, 'body');
});

test('реестр использует переданный компаратор для сортировки', () => {
    const dir = temporaryModules({
        a: { id: 'a', kind: 'page', title: 'Alpha', order: 1 },
        b: { id: 'b', kind: 'page', title: 'Beta', order: 1 },
        c: { id: 'c', kind: 'page', title: 'Gamma', order: 1 }
    });
    const ascending = new ModuleRegistry([{ dir, source: 'user' }], config, (x, y) => String(x).localeCompare(String(y))).scan();
    assert.deepEqual(ascending.all().map((m) => m.id), ['a', 'b', 'c']);
    const descending = new ModuleRegistry([{ dir, source: 'user' }], config, (x, y) => String(y).localeCompare(String(x))).scan();
    assert.deepEqual(descending.all().map((m) => m.id), ['c', 'b', 'a']);
});

test('Values: сравнение уважает локаль, ё и ß ведут себя по правилам', () => {
    const pairs = [
        ['ru-RU', 'е', 'ё'],
        ['ru-RU', 'Ель', 'Ёлка'],
        ['de-DE', 'ß', 'ss'],
        ['de-DE', 'daß', 'dass'],
        ['en-US', 'ß', 'ss']
    ];
    for (const [locale, a, b] of pairs) {
        Values.setLocale(locale);
        const collator = new Intl.Collator(locale);
        assert.equal(
            Math.sign(Values.compare(a, b)),
            Math.sign(collator.compare(a, b)),
            `${locale}: ${a} vs ${b}`
        );
    }
    Values.setLocale('ru-RU');
    assert.ok(Values.compare('е', 'ё') < 0, 'ru: е раньше ё');
    Values.setLocale('en');
});

test('Values: смена локали меняет порядок', (t) => {
    const en = new Intl.Collator('en-US');
    const sv = new Intl.Collator('sv-SE');
    if (Math.sign(en.compare('Ål', 'Zebra')) === Math.sign(sv.compare('Ål', 'Zebra'))) {
        t.skip('ICU не различает en-US и sv-SE для пары Ål/Zebra');
        return;
    }
    Values.setLocale('en-US');
    assert.equal(Math.sign(Values.compare('Ål', 'Zebra')), Math.sign(en.compare('Ål', 'Zebra')));
    Values.setLocale('sv-SE');
    assert.equal(Math.sign(Values.compare('Ål', 'Zebra')), Math.sign(sv.compare('Ål', 'Zebra')));
    assert.notEqual(Math.sign(Values.compare('Ål', 'Zebra')), Math.sign(en.compare('Ål', 'Zebra')));
    Values.setLocale('en');
});

test('смена языка обновляет компаратор без перезапуска', async () => {
    const { call, container } = createApp({ systemLocale: 'ru-RU' });
    const ruColl = new Intl.Collator('ru-RU');
    assert.equal(Math.sign(Values.compare('Ёлка', 'Яблоко')), Math.sign(ruColl.compare('Ёлка', 'Яблоко')));
    await call('settings:set', { key: 'language', value: 'en' });
    const enColl = new Intl.Collator('en-US');
    assert.equal(Math.sign(Values.compare('Ёлка', 'Яблоко')), Math.sign(enColl.compare('Ёлка', 'Яблоко')));
    await call('settings:set', { key: 'language', value: 'ru' });
    assert.equal(Math.sign(Values.compare('Ёлка', 'Яблоко')), Math.sign(ruColl.compare('Ёлка', 'Яблоко')));
    container.close();
});

test('резолвер файлов не выпускает за пределы корня и неизвестных хостов', () => {
    const registry = new ModuleRegistry([{ dir: path.join(root, 'src', 'renderer', 'modules'), source: 'system' }], config).scan();
    const resolver = new AssetResolver({ appRoot: path.join(root, 'src', 'renderer'), appHost: 'app', registry });
    const appRoot = path.join(root, 'src', 'renderer');
    assert.equal(resolver.resolve('bm://app/shell/index.html'), path.join(appRoot, 'shell', 'index.html'));
    assert.equal(resolver.resolve('bm://reaction/js/main.js'), path.join(appRoot, 'modules', 'reaction', 'js', 'main.js'));
    assert.equal(resolver.resolve('bm://unknown/index.html'), null);
    const inside = (target, base) => target === null || target === base || target.startsWith(base + path.sep);
    const moduleBase = path.join(appRoot, 'modules', 'reaction');
    for (const url of ['bm://app/../../package.json', 'bm://app/%2e%2e/%2e%2e/package.json', 'bm://app/..%2f..%2fpackage.json', 'bm://app/shell/..%2f..%2f..%2fpackage.json']) {
        assert.ok(inside(resolver.resolve(url), appRoot), url);
    }
    for (const url of ['bm://reaction/..%2f..%2fapp%2fshell/index.html', 'bm://reaction/%2e%2e/%2e%2e/shell/index.html', 'bm://reaction/..%5c..%5cshell%5cindex.html']) {
        assert.ok(inside(resolver.resolve(url), moduleBase), url);
    }
    assert.equal(resolver.resolve('bm://app/a%00b'), null);
    assert.equal(resolver.resolve('bm://app/%E0%A4%A'), null);
    assert.equal(resolver.resolve('not a url'), null);
    assert.equal(MimeTypes.forFile('x.mjs'), 'text/javascript; charset=utf-8');
    assert.equal(MimeTypes.forFile('x.unknown'), 'application/octet-stream');
});

test('модули: список, скрытие, ограничения', async () => {
    const { call, container } = createApp();
    const list = await call('modules:list');
    const reaction = list.find((m) => m.id === 'reaction');
    assert.equal(reaction.url, 'bm://reaction/index.html');
    assert.equal(reaction.hidden, false);
    assert.deepEqual(reaction.channels, ['reaction:*']);
    assert.equal(typeof reaction.category, 'string');
    assert.equal(typeof reaction.pinned, 'boolean');
    assert.ok(reaction.pinOrder === null || typeof reaction.pinOrder === 'number');
    const afterHide = await call('modules:setHidden', { id: 'reaction', hidden: true });
    assert.equal(afterHide.find((m) => m.id === 'reaction').hidden, true);
    assert.equal((await call('modules:list')).find((m) => m.id === 'reaction').hidden, true);
    await call('modules:setHidden', { id: 'reaction', hidden: false });
    assert.equal((await call('modules:list')).find((m) => m.id === 'reaction').hidden, false);
    await rejects(call('modules:setHidden', { id: 'nope', hidden: true }), 404);
    await rejects(call('modules:setHidden', { id: 'reaction', hidden: 'yes' }), 400);
    container.close();
});

test('модули: категории и закрепление по умолчанию при пустых настройках', async () => {
    const { call, container } = createApp();
    const list = await call('modules:list');
    const pages = list.filter((m) => m.kind === 'page');
    const plugins = list.filter((m) => m.kind === 'plugin');
    assert.ok(pages.length > 0);
    for (const page of pages) {
        assert.equal(page.pinned, true);
        assert.equal(typeof page.pinOrder, 'number');
        assert.equal(page.category, 'other');
    }
    for (const plugin of plugins) {
        assert.equal(plugin.pinned, false);
        assert.equal(plugin.pinOrder, null);
    }
    const sortedByPin = [...pages].sort((a, b) => a.pinOrder - b.pinOrder).map((m) => m.id);
    const expected = [...pages].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'ru')).map((m) => m.id);
    assert.deepEqual(sortedByPin, expected);
    const categories = await call('modules:categories');
    for (const id of ['body', 'mind', 'finance', 'knowledge', 'environment', 'other']) {
        const entry = categories.find((c) => c.id === id);
        assert.ok(entry, id);
        assert.equal(entry.builtin, true);
        assert.equal(entry.titleKey, `category.${id}`);
    }
    container.close();
});

test('модули: закрепление, порядок и сброс', async () => {
    const { call, container } = createApp();
    const initial = await call('modules:list');
    const target = initial.find((m) => m.kind === 'page').id;
    await call('modules:setPinned', { id: target, pinned: false });
    let list = await call('modules:list');
    assert.equal(list.find((m) => m.id === target).pinned, false);
    assert.equal(list.find((m) => m.id === target).pinOrder, null);
    await call('modules:setPinned', { id: target, pinned: true });
    list = await call('modules:list');
    assert.equal(list.find((m) => m.id === target).pinned, true);
    assert.equal(typeof list.find((m) => m.id === target).pinOrder, 'number');
    const pages = list.filter((m) => m.kind === 'page').map((m) => m.id);
    const reversed = [...pages].reverse();
    const after = await call('modules:reorderPinned', { ids: reversed });
    for (let i = 0; i < reversed.length; i += 1) {
        assert.equal(after.find((m) => m.id === reversed[i]).pinOrder, i);
    }
    await rejects(call('modules:reorderPinned', { ids: ['ghost'] }), 404);
    await rejects(call('modules:reorderPinned', { ids: ['reaction', 'reaction'] }), 400);
    await rejects(call('modules:reorderPinned', { ids: 'nope' }), 400);
    await rejects(call('modules:setPinned', { id: 'ghost', pinned: true }), 404);
    await rejects(call('modules:setPinned', { id: 'reaction', pinned: 'yes' }), 400);
    container.close();
});

test('модули: пользовательские категории создание, применение, удаление', async () => {
    const { call, container } = createApp();
    const created = await call('modules:createCategory', { name: 'Моё' });
    assert.equal(created.id, 'custom-moe');
    let categories = await call('modules:categories');
    const custom = categories.find((c) => c.id === 'custom-moe');
    assert.ok(custom);
    assert.equal(custom.name, 'Моё');
    assert.equal(custom.builtin, false);
    assert.equal(categories.some((c) => c.id === 'body' && c.builtin), true);
    await call('modules:setCategory', { id: 'reaction', category: 'custom-moe' });
    let list = await call('modules:list');
    assert.equal(list.find((m) => m.id === 'reaction').category, 'custom-moe');
    await call('modules:setCategory', { id: 'reaction', category: null });
    list = await call('modules:list');
    assert.equal(list.find((m) => m.id === 'reaction').category, 'other');
    await call('modules:setCategory', { id: 'reaction', category: 'body' });
    list = await call('modules:list');
    assert.equal(list.find((m) => m.id === 'reaction').category, 'body');
    await call('modules:setCategory', { id: 'reaction', category: null });
    await rejects(call('modules:setCategory', { id: 'reaction', category: 'unknown' }), 404);
    await rejects(call('modules:setCategory', { id: 'ghost', category: 'body' }), 404);
    await rejects(call('modules:setCategory', { id: 'reaction', category: 5 }), 400);
    await rejects(call('modules:createCategory', { name: '' }), 400);
    await rejects(call('modules:createCategory', { name: 'x'.repeat(41) }), 400);
    await rejects(call('modules:createCategory', { name: 'Моё' }), 400);
    await rejects(call('modules:createCategory', {}), 400);
    await call('modules:setCategory', { id: 'reaction', category: 'custom-moe' });
    await call('modules:removeCategory', { id: 'custom-moe' });
    categories = await call('modules:categories');
    assert.equal(categories.some((c) => c.id === 'custom-moe'), false);
    list = await call('modules:list');
    assert.equal(list.find((m) => m.id === 'reaction').category, 'other');
    await rejects(call('modules:removeCategory', { id: 'custom-moe' }), 404);
    await rejects(call('modules:removeCategory', { id: 'body' }), 404);
    await rejects(call('modules:removeCategory', {}), 400);
    container.close();
});

test('конфиги: только публичные, доступны до входа', async () => {
    const { call, container } = createApp();
    await call('auth:setup', { login: 'a', password: 'abcd' });
    await call('auth:lock');
    const themes = await call('config:get', { name: 'themes' });
    assert.ok(themes.themes.dark.variables['--bg']);
    assert.ok(themes.themes.light.chart.grid);
    assert.equal((await call('config:get', { name: 'reaction' })).stages, 5);
    await rejects(call('config:get', { name: 'app' }), 403);
    await rejects(call('config:get', { name: 'nothing' }), 404);
    assert.equal((await call('config:get', { name: 'health' })).profileDefaults.height, 175);
    await rejects(call('modules:list'), 401);
    container.close();
});

test('темы в настройках берутся из конфига', async () => {
    const { call, container } = createApp();
    await call('settings:set', { key: 'theme', value: 'light' });
    assert.equal((await call('settings:get')).theme, 'light');
    await rejects(call('settings:set', { key: 'theme', value: 'sepia' }), 400);
    container.close();
});

test('сообщения модулей на английском', async () => {
    const { call, container } = createApp({ systemLocale: 'ru-RU' });
    await call('settings:set', { key: 'language', value: 'en' });
    await rejects(call('modules:setHidden', { id: 'reaction', hidden: 'yes' }), 400, 'Module id and hidden flag are required');
    await rejects(call('modules:createCategory', {}), 400, 'Category name is required');
    container.close();
});