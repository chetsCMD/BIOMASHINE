const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const Database = require('better-sqlite3');
const { createApp, rejects } = require('./helpers');
const ConfigService = require('../src/main/core/ConfigService');
const WorkspaceRegistry = require('../src/main/services/WorkspaceRegistry');

const root = path.join(__dirname, '..');
const appConfig = JSON.parse(fs.readFileSync(path.join(root, 'config', 'app.json'), 'utf8'));
const temp = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), prefix));

test('состояние: режимы, сохранение, загрузка, очистка и ограничения', async () => {
    const { call, container } = createApp();
    assert.deepEqual(await call('session:get'), { mode: 'ask', hasState: false });
    await call('session:setMode', { mode: 'always' });
    assert.equal((await call('session:get')).mode, 'always');
    await rejects(call('session:setMode', { mode: 'sometimes' }), 400);
    const state = { version: 1, route: '#module/sleep', modules: { sleep: { scroll: { x: 0, y: 120 }, controls: { filter: { value: 'x' } } } } };
    await call('session:save', { state });
    assert.equal((await call('session:get')).hasState, true);
    assert.deepEqual(await call('session:load'), state);
    await rejects(call('session:save', { state: { version: 2 } }), 400);
    await rejects(call('session:save', { state: [1] }), 400);
    const limit = JSON.parse(fs.readFileSync(path.join(root, 'config', 'session.json'), 'utf8')).maxStateBytes;
    await rejects(call('session:save', { state: { version: 1, big: 'x'.repeat(limit) } }), 400);
    await call('session:clear');
    assert.equal(await call('session:load'), null);
    await call('auth:setup', { login: 'a', password: 'abcd' });
    await call('auth:lock');
    await rejects(call('session:get'), 401);
    container.close();
});

test('состояние: окно закрывается принудительно через window:closeNow', async () => {
    const { call, container, system } = createApp();
    await call('window:closeNow');
    assert.equal(system.closedNow, true);
    container.close();
});

test('состояние (интерфейс): снимок и восстановление полей, прокрутки и пользовательского состояния', async () => {
    const { ModuleState } = await import(pathToFileURL(path.join(root, 'src', 'renderer', 'sdk', 'ModuleState.js')).href);
    const events = [];
    const element = (props) => ({ type: 'text', value: '', checked: false, scrollHeight: 0, clientHeight: 0, scrollTop: 0, scrollLeft: 0, closest: () => null, dispatchEvent: (event) => events.push([props.id, event.name]), ...props });
    const filter = element({ id: 'filter', value: 'foo' });
    const select = element({ id: 'sort', type: 'select-one', value: 'date' });
    const box = element({ id: 'box', type: 'checkbox', checked: true });
    const secret = element({ id: 'secret', type: 'password', value: 'hunter2' });
    const hidden = element({ id: 'skip', value: 'nope', closest: () => ({}) });
    const list = element({ id: 'list', type: 'div', scrollHeight: 500, clientHeight: 100, scrollTop: 240 });
    const all = [filter, select, box, secret, hidden, list];
    const doc = {
        documentElement: {},
        querySelectorAll: (selector) => (selector === '[id]' ? all : all.filter((item) => item.type !== 'div')),
        getElementById: (id) => all.find((item) => item.id === id) || null
    };
    class FakeEvent {
        constructor(name) {
            this.name = name;
        }
    }
    const win = { document: doc, scrollX: 5, scrollY: 77, scrollTo(x, y) { this.scrollX = x; this.scrollY = y; }, Event: FakeEvent, MutationObserver: class { observe() {} disconnect() {} }, setTimeout: () => 1, clearTimeout() {} };
    const state = new ModuleState(win);
    let custom = 'tab-2';
    state.register('tab', { capture: () => custom, restore: (value) => (custom = value) });
    const snapshot = state.capture();
    assert.deepEqual(snapshot.scroll, { x: 5, y: 77 });
    assert.deepEqual(snapshot.controls, { filter: { value: 'foo' }, sort: { value: 'date' }, box: { checked: true } });
    assert.deepEqual(snapshot.scrolls, { list: { x: 0, y: 240 } });
    assert.deepEqual(snapshot.custom, { tab: 'tab-2' });
    filter.value = '';
    select.value = 'name';
    box.checked = false;
    list.scrollTop = 0;
    win.scrollY = 0;
    custom = 'tab-0';
    state.restore(snapshot, 1000);
    assert.equal(filter.value, 'foo');
    assert.equal(select.value, 'date');
    assert.equal(box.checked, true);
    assert.equal(secret.value, 'hunter2');
    assert.equal(list.scrollTop, 240);
    assert.equal(win.scrollY, 77);
    assert.equal(custom, 'tab-2');
    assert.deepEqual(events.filter((item) => item[0] === 'sort' || item[0] === 'box'), [['sort', 'change'], ['box', 'change']]);
    assert.ok(events.some((item) => item[0] === 'filter' && item[1] === 'input'));
});

test('конфиги: список, просмотр, сохранение только отличий, живое применение и сброс', async () => {
    const dir = temp('bm-cfg-edit-');
    const { call, container } = createApp({ overridesDir: dir });
    const list = await call('configs:list');
    assert.ok(list.some((item) => item.name === 'reaction' && !item.hasOverride && !item.restart));
    assert.equal(list.find((item) => item.name === 'app').restart, true);
    assert.equal(list.find((item) => item.name === 'app').private, true);
    const snapshot = await call('configs:read', { name: 'reaction' });
    const result = await call('configs:write', { name: 'reaction', data: { ...snapshot.effective, stages: 3 } });
    assert.equal(result.effective.stages, 3);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'reaction.json'), 'utf8')), { stages: 3 });
    assert.equal((await call('config:get', { name: 'reaction' })).stages, 3);
    assert.equal((await call('configs:list')).find((item) => item.name === 'reaction').hasOverride, true);
    await call('configs:write', { name: 'reaction', data: snapshot.base });
    assert.ok(!fs.existsSync(path.join(dir, 'reaction.json')));
    await call('configs:write', { name: 'reaction', data: { ...snapshot.effective, stages: 4 } });
    await call('configs:reset', { name: 'reaction' });
    assert.equal((await call('config:get', { name: 'reaction' })).stages, snapshot.base.stages);
    await rejects(call('configs:write', { name: 'Bad Name', data: {} }), 400);
    await rejects(call('configs:write', { name: 'reaction', data: [1] }), 400);
    await rejects(call('configs:write', { name: 'reaction', data: 'x' }), 400);
    await rejects(call('configs:read', { name: 'nothing' }), 404);
    await rejects(call('configs:reset', { name: 'nothing' }), 404);
    container.close();
});

test('конфиги: diff хранит только изменённые ключи, массивы заменяются целиком', () => {
    assert.deepEqual(ConfigService.diff({ a: 1, b: { c: 2, d: 3 }, e: [1, 2] }, { a: 1, b: { c: 5, d: 3 }, e: [1, 2, 3], f: 9 }), { b: { c: 5 }, e: [1, 2, 3], f: 9 });
    assert.equal(ConfigService.diff({ a: 1 }, { a: 1 }), undefined);
});

test('профили: реестр создаёт основной профиль, создаёт, дублирует, переименовывает, удаляет и переключает', async () => {
    const dir = temp('bm-workspaces-');
    const registry = new WorkspaceRegistry({ dataDir: dir, settings: appConfig.workspaces, fileName: appConfig.database.fileName });
    const initial = registry.ensure();
    assert.equal(initial.active, 'default');
    assert.equal(initial.profiles[0].file, appConfig.database.fileName);
    assert.equal(initial.profiles[0].nameKey, 'workspace.default');
    const { call, container, system } = createApp({ workspaces: registry, workspaceId: 'default' });
    const listed = await call('workspace:list');
    assert.equal(listed.running, 'default');
    assert.equal(listed.profiles.length, 1);

    const created = await call('workspace:create', { name: '  Эксперимент  ' });
    assert.equal(registry.get(created.id).name, 'Эксперимент');
    assert.match(registry.get(created.id).file, /^profile-[0-9a-f]{8}\.sqlite$/);
    const rude = await call('workspace:create', { name: 'хуй' });
    assert.equal(registry.get(rude.id).name, 'хуй');
    const copy = await call('workspace:create', { name: 'Копия', from: 'default' });
    const copyFile = registry.dbPath(copy.id);
    assert.ok(fs.existsSync(copyFile));
    const opened = new Database(copyFile, { readonly: true });
    assert.ok(opened.prepare("SELECT COUNT(*) AS total FROM sqlite_master WHERE type = 'table'").get().total > 5);
    opened.close();

    await call('workspace:rename', { id: created.id, name: 'Песочница' });
    assert.equal(registry.get(created.id).name, 'Песочница');
    await rejects(call('workspace:create', { name: '   ' }), 400);
    await rejects(call('workspace:create', { name: 'x'.repeat(appConfig.workspaces.maxNameLength + 1) }), 400);
    await rejects(call('workspace:create', { name: 'ok', from: 'nope' }), 404);
    await rejects(call('workspace:rename', { id: 'nope', name: 'x' }), 404);
    await rejects(call('workspace:remove', { id: 'default' }), 400);

    fs.writeFileSync(registry.dbPath(created.id), 'x');
    await call('workspace:remove', { id: created.id });
    assert.equal(registry.get(created.id), null);
    assert.ok(!fs.existsSync(path.join(dir, `profile-${created.id}.sqlite`)));

    const switched = await call('workspace:switch', { id: copy.id });
    assert.equal(switched.relaunching, true);
    assert.equal(registry.read().active, copy.id);
    assert.equal(system.relaunched, true);
    await rejects(call('workspace:switch', { id: 'nope' }), 404);
    await rejects(call('workspace:remove', { id: copy.id }), 400);
    assert.equal(registry.resolve('nope'), copy.id);
    assert.equal(registry.resolve('default'), 'default');
    assert.equal(registry.dbPath('default'), path.join(dir, appConfig.database.fileName));
    container.close();
});

test('профили: повреждённый реестр восстанавливается', () => {
    const dir = temp('bm-workspaces-bad-');
    fs.writeFileSync(path.join(dir, appConfig.workspaces.registryFile), '{oops');
    const registry = new WorkspaceRegistry({ dataDir: dir, settings: appConfig.workspaces, fileName: appConfig.database.fileName });
    assert.equal(registry.ensure().profiles.length, 1);
    fs.writeFileSync(path.join(dir, appConfig.workspaces.registryFile), JSON.stringify({ active: 'gone', profiles: [{ id: 'one', name: 'Один', file: 'one.sqlite' }] }));
    assert.equal(registry.ensure().active, 'one');
});
