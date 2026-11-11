const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp, rejects } = require('./helpers');

const systemIds = fs.readdirSync(path.join(__dirname, '..', 'src', 'renderer', 'modules')).sort();

function userDir(modules) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-user-'));
    for (const [id, manifest] of Object.entries(modules)) {
        fs.mkdirSync(path.join(dir, id));
        fs.writeFileSync(path.join(dir, id, 'manifest.json'), JSON.stringify(manifest));
        fs.writeFileSync(path.join(dir, id, 'index.html'), '<html></html>');
    }
    return dir;
}

test('пользовательские и системные модули разделены по источнику', async () => {
    const dir = userDir({
        cigarettes: { id: 'cigarettes', kind: 'page', title: 'Сигареты', channels: [] },
        reaction: { id: 'reaction', kind: 'page', title: 'Подделка' },
        look: { id: 'look', kind: 'plugin', title: 'Вид', css: ['look.css'] }
    });
    fs.mkdirSync(path.join(dir, 'empty'));
    const { call, container } = createApp({ userModulesDir: dir });
    const list = await call('modules:list');
    const bySource = (source) => list.filter((module) => module.source === source).map((module) => module.id).sort();
    assert.deepEqual(bySource('system'), systemIds);
    assert.deepEqual(bySource('user'), ['cigarettes', 'look']);
    assert.equal(list.find((module) => module.id === 'reaction').title, 'Реакция');
    assert.equal(list.find((module) => module.id === 'cigarettes').url, 'bm://cigarettes/index.html');
    assert.deepEqual(list.find((module) => module.id === 'look').cssUrls, ['bm://look/look.css']);
    assert.equal(list.find((module) => module.id === 'cigarettes').pinned, true);
    assert.equal(list.find((module) => module.id === 'look').pinned, false);
    assert.equal(list.find((module) => module.id === 'cigarettes').category, 'other');
    const errors = await call('modules:errors');
    assert.equal(errors.length, 2);
    assert.ok(errors.some((error) => error.dir === 'reaction' && /уже занят/.test(error.message) && error.source === 'user'));
    assert.ok(errors.some((error) => error.dir === 'empty' && /manifest\.json/.test(error.message)));
    assert.equal(container.assets.resolve('bm://cigarettes/index.html'), path.join(dir, 'cigarettes', 'index.html'));
    container.close();
});

test('пользовательский модуль берёт категорию из манифеста', async () => {
    const dir = userDir({
        tracker: { id: 'tracker', kind: 'page', title: 'Трекер', category: 'finance' }
    });
    const { call, container } = createApp({ userModulesDir: dir });
    const list = await call('modules:list');
    assert.equal(list.find((module) => module.id === 'tracker').category, 'finance');
    container.close();
});

test('пользовательские категории и закрепление работают с пользовательскими модулями', async () => {
    const dir = userDir({
        alpha: { id: 'alpha', kind: 'page', title: 'A' },
        beta: { id: 'beta', kind: 'page', title: 'B' }
    });
    const { call, container } = createApp({ userModulesDir: dir });
    const { id } = await call('modules:createCategory', { name: 'Практика' });
    await call('modules:setCategory', { id: 'alpha', category: id });
    let list = await call('modules:list');
    assert.equal(list.find((m) => m.id === 'alpha').category, id);
    await call('modules:setPinned', { id: 'beta', pinned: false });
    list = await call('modules:list');
    assert.equal(list.find((m) => m.id === 'beta').pinned, false);
    container.close();
});

test('пересканирование подхватывает новые модули без перезапуска, openFolder вызывает систему', async () => {
    const dir = userDir({});
    const { call, container, system } = createApp({ userModulesDir: dir });
    assert.equal((await call('modules:list')).length, systemIds.length);
    fs.mkdirSync(path.join(dir, 'fresh'));
    fs.writeFileSync(path.join(dir, 'fresh', 'manifest.json'), JSON.stringify({ id: 'fresh', kind: 'page', title: 'Новый' }));
    const result = await call('modules:rescan');
    assert.deepEqual(result.modules.map((module) => module.id).sort(), [...systemIds, 'fresh'].sort());
    assert.deepEqual(result.errors, []);
    await call('modules:setHidden', { id: 'fresh', hidden: true });
    assert.equal((await call('modules:list')).find((module) => module.id === 'fresh').hidden, true);
    const opened = await call('modules:openFolder');
    assert.equal(opened.opened, true);
    assert.equal(system.opened, dir);
    container.close();
});

test('хранилище: CRUD, изоляция модулей и коллекций, валидация', async () => {
    const dir = userDir({
        alpha: { id: 'alpha', kind: 'page', title: 'A' },
        beta: { id: 'beta', kind: 'page', title: 'B' },
        skin: { id: 'skin', kind: 'plugin', title: 'S', css: ['s.css'] }
    });
    const { call, container } = createApp({ userModulesDir: dir });
    const id = (await call('storage:insert', { module: 'alpha', collection: 'items', data: { text: 'раз', n: 1 } })).id;
    await call('storage:insert', { module: 'alpha', collection: 'items', data: { text: 'два' } });
    await call('storage:insert', { module: 'alpha', collection: 'other', data: { text: 'чужая коллекция' } });
    await call('storage:insert', { module: 'beta', collection: 'items', data: { text: 'чужой модуль' } });

    const items = await call('storage:list', { module: 'alpha', collection: 'items' });
    assert.deepEqual(items.map((item) => item.data.text), ['раз', 'два']);
    assert.ok(items[0].createdAt && items[0].updatedAt);
    assert.equal((await call('storage:list', { module: 'beta', collection: 'items' })).length, 1);
    assert.equal((await call('storage:get', { module: 'alpha', collection: 'items', id })).data.n, 1);
    await rejects(call('storage:get', { module: 'beta', collection: 'items', id }), 404);

    await call('storage:update', { module: 'alpha', collection: 'items', id, data: { text: 'раз!', n: 2 } });
    assert.equal((await call('storage:get', { module: 'alpha', collection: 'items', id })).data.text, 'раз!');
    await rejects(call('storage:update', { module: 'beta', collection: 'items', id, data: { x: 1 } }), 404);
    await rejects(call('storage:remove', { module: 'beta', collection: 'items', id }), 404);
    await call('storage:remove', { module: 'alpha', collection: 'items', id });
    await rejects(call('storage:remove', { module: 'alpha', collection: 'items', id }), 404);

    assert.deepEqual(await call('storage:clear', { module: 'alpha', collection: 'items' }), { removed: 1 });
    assert.equal((await call('storage:list', { module: 'alpha', collection: 'other' })).length, 1);

    await rejects(call('storage:list', { module: 'ghost', collection: 'items' }), 400, 'Неизвестный модуль');
    await rejects(call('storage:list', { module: 'skin', collection: 'items' }), 400, 'Неизвестный модуль');
    await rejects(call('storage:list', { module: 'alpha', collection: 'Bad Name' }), 400, 'Имя коллекции');
    await rejects(call('storage:list', { module: 'alpha', collection: '1abc' }), 400);
    await rejects(call('storage:insert', { module: 'alpha', collection: 'items', data: [1] }), 400, 'объектом');
    await rejects(call('storage:insert', { module: 'alpha', collection: 'items', data: 'text' }), 400);
    await rejects(call('storage:insert', { module: 'alpha', collection: 'items', data: { big: 'x'.repeat(300000) } }), 400, 'больше');
    container.close();
});

test('данные пользовательских модулей попадают в экспорт', async () => {
    const dir = userDir({ alpha: { id: 'alpha', kind: 'page', title: 'A' } });
    const { call, container, system } = createApp({ userModulesDir: dir });
    await call('storage:insert', { module: 'alpha', collection: 'items', data: { text: 'сохрани меня' } });
    await call('export:json');
    const exported = JSON.parse(system.saved[0].content);
    assert.equal(exported.tables.module_documents.length, 1);
    assert.equal(JSON.parse(exported.tables.module_documents[0].data).text, 'сохрани меня');
    container.close();
});

test('пользовательский конфиг доступен модулям, приватный app — нет', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-cfg-'));
    fs.writeFileSync(path.join(dataDir, 'mytracker.json'), JSON.stringify({ goalPerDay: 5 }));
    fs.writeFileSync(path.join(dataDir, 'reaction.json'), JSON.stringify({ stages: 3 }));
    const Container = require('../src/main/Container');
    const container = new Container({
        dbPath: ':memory:',
        configDir: path.join(__dirname, '..', 'config'),
        overridesDir: dataDir,
        migrationsDir: path.join(__dirname, '..', 'migrations'),
        rendererRoot: path.join(__dirname, '..', 'src', 'renderer'),
        system: { applyAutostart() {} },
        appVersion: 'test'
    }).build();
    const call = async (channel, payload) => {
        const response = await container.router.dispatch(channel, payload);
        if (!response.ok) {
            throw new Error(response.error);
        }
        return response.data;
    };
    assert.deepEqual(await call('config:get', { name: 'mytracker' }), { goalPerDay: 5 });
    const reaction = await call('config:get', { name: 'reaction' });
    assert.equal(reaction.stages, 3);
    assert.equal(reaction.waitMinMs, 1000);
    container.close();
});

test('битые пользовательские конфиги и темы не роняют запуск', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-bad-'));
    fs.writeFileSync(path.join(dataDir, 'reaction.json'), '{oops');
    fs.writeFileSync(path.join(dataDir, 'with-bom.json'), `\uFEFF${JSON.stringify({ ok: true })}`);
    fs.writeFileSync(
        path.join(dataDir, 'themes.json'),
        JSON.stringify({
            themes: {
                broken: { title: 'Сломанная', colorScheme: 'dark', variables: { '--bg': '#000' }, chart: { text: '#fff', grid: '#111' } },
                nochart: { title: 'Без графиков', colorScheme: 'light', variables: {} },
                sepia: {
                    title: 'Сепия',
                    colorScheme: 'light',
                    variables: Object.fromEntries(
                        ['--bg', '--s1', '--s2', '--s3', '--br', '--br2', '--t', '--td', '--tdd', '--tddd', '--wh', '--overlay', '--header-bg'].map((name) => [name, '#c8b89a'])
                    ),
                    chart: { text: '#443', grid: '#bba' }
                }
            }
        })
    );
    const Container = require('../src/main/Container');
    const container = new Container({
        dbPath: ':memory:',
        configDir: path.join(__dirname, '..', 'config'),
        overridesDir: dataDir,
        migrationsDir: path.join(__dirname, '..', 'migrations'),
        rendererRoot: path.join(__dirname, '..', 'src', 'renderer'),
        system: { applyAutostart() {}, systemLocale: () => 'ru-RU' },
        appVersion: 'test'
    }).build();
    const call = async (channel, payload) => {
        const response = await container.router.dispatch(channel, payload);
        if (!response.ok) {
            throw Object.assign(new Error(response.error), { status: response.status });
        }
        return response.data;
    };
    const themes = await call('config:get', { name: 'themes' });
    assert.deepEqual(Object.keys(themes.themes).sort(), ['dark', 'light', 'sepia']);
    const errors = await call('config:errors');
    assert.ok(errors.some((error) => error.file === 'reaction.json' && /JSON/.test(error.message) && error.key === 'config.invalidJson'));
    assert.ok(errors.some((error) => /тема «broken»/.test(error.message) && /нет переменных/.test(error.message)));
    assert.ok(errors.some((error) => /тема «nochart»/.test(error.message)));
    assert.equal((await call('config:get', { name: 'reaction' })).stages, 5);
    assert.deepEqual(await call('config:get', { name: 'with-bom' }), { ok: true });
    await call('settings:set', { key: 'theme', value: 'sepia' });
    assert.equal((await call('settings:get')).theme, 'sepia');
    await assert.rejects(call('settings:set', { key: 'theme', value: 'broken' }), /Недопустимое/);
    container.close();
});

test('папка пользовательских конфигов открывается через систему', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-cfgdir-'));
    const opened = [];
    const Container = require('../src/main/Container');
    const container = new Container({
        dbPath: ':memory:',
        configDir: path.join(__dirname, '..', 'config'),
        overridesDir: dir,
        migrationsDir: path.join(__dirname, '..', 'migrations'),
        rendererRoot: path.join(__dirname, '..', 'src', 'renderer'),
        system: { applyAutostart() {}, openFolder: async (folder) => (opened.push(folder), { opened: true, path: folder, error: null }) },
        appVersion: 'test'
    }).build();
    const response = await container.router.dispatch('config:openFolder', {});
    assert.equal(response.data.opened, true);
    assert.deepEqual(opened, [dir]);
    container.close();
});

test('ошибки хранилища на английском', async () => {
    const dir = userDir({
        alpha: { id: 'alpha', kind: 'page', title: 'A' }
    });
    const { call, container } = createApp({ userModulesDir: dir });
    await call('settings:set', { key: 'language', value: 'en' });
    await rejects(call('storage:list', { module: 'ghost', collection: 'items' }), 400, 'Unknown module');
    await rejects(call('storage:insert', { module: 'alpha', collection: 'items', data: [1] }), 400, 'data must be an object');
    await rejects(call('storage:insert', { module: 'alpha', collection: 'items', data: { big: 'x'.repeat(300000) } }), 400, 'Document is larger than');
    container.close();
});