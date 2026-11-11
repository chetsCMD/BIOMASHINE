process.env.TZ = 'UTC';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp, rejects } = require('./helpers');

function makeModule(root, id, permissions) {
    const dir = path.join(root, id);
    fs.mkdirSync(dir, { recursive: true });
    const manifest = { id, kind: 'page', title: id, entry: 'index.html' };
    if (permissions) {
        manifest.permissions = permissions;
    }
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
}

function setup(nowIso = '2024-05-01T12:00:00Z') {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-notify-'));
    makeModule(root, 'test-notify', ['notifications']);
    makeModule(root, 'plain');
    let current = new Date(nowIso);
    const app = createApp({ userModulesDir: root, now: () => current });
    app.container.notifications.stop();
    return {
        ...app,
        root,
        setNow: (iso) => { current = new Date(iso); },
        current: () => current
    };
}

test('schedule once and list', async () => {
    const { call } = setup();
    const result = await call('notifications:schedule', {
        module: 'test-notify',
        title: 'Hello',
        body: 'World',
        at: '2024-05-01 12:05:00'
    });
    assert.ok(result.id);
    const list = await call('notifications:list', { module: 'test-notify' });
    assert.equal(list.length, 1);
    assert.equal(list[0].title, 'Hello');
    assert.equal(list[0].kind, 'once');
    assert.equal(list[0].nextAt, '2024-05-01 12:05:00');
});

test('module without permission gets 403', async () => {
    const { call } = setup();
    await rejects(call('notifications:schedule', { module: 'plain', title: 'X', at: '2024-05-01 13:00:00' }), 403);
    await rejects(call('notifications:list', { module: 'plain' }), 403);
});

test('daily repeat fires and advances', async () => {
    const ctx = setup();
    const { call, container, system, setNow } = ctx;
    await call('notifications:schedule', {
        module: 'test-notify',
        title: 'Daily',
        repeat: { type: 'daily', time: '13:00' }
    });
    let list = await call('notifications:list', { module: 'test-notify' });
    assert.equal(list[0].nextAt, '2024-05-01 13:00:00');
    setNow('2024-05-01T13:00:01Z');
    container.notifications.tick();
    assert.equal(system.notifications.length, 1);
    assert.equal(system.notifications[0].title, 'Daily');
    list = await call('notifications:list', { module: 'test-notify' });
    assert.equal(list[0].nextAt, '2024-05-02 13:00:00');
});

test('weekdays repeat advances to next allowed day', async () => {
    const ctx = setup('2024-05-01T12:00:00Z');
    const { call, container, setNow } = ctx;
    await call('notifications:schedule', {
        module: 'test-notify',
        title: 'Weekdays',
        repeat: { type: 'weekdays', time: '13:00', weekdays: [1, 3] }
    });
    let list = await call('notifications:list', { module: 'test-notify' });
    assert.equal(list[0].nextAt, '2024-05-01 13:00:00');
    setNow('2024-05-01T13:00:01Z');
    container.notifications.tick();
    list = await call('notifications:list', { module: 'test-notify' });
    assert.equal(list[0].nextAt, '2024-05-06 13:00:00');
});

test('missed notifications are shown once grouped at start', async () => {
    const { container, system, call } = setup();
    container.notificationsRepository.insert({
        module: 'test-notify',
        title: 'A',
        body: 'a',
        kind: 'once',
        at: '2024-05-01 10:00:00',
        nextAt: '2024-05-01 10:00:00'
    });
    container.notificationsRepository.insert({
        module: 'test-notify',
        title: 'B',
        body: 'b',
        kind: 'once',
        at: '2024-05-01 11:00:00',
        nextAt: '2024-05-01 11:00:00'
    });
    container.notifications.start();
    assert.equal(system.notifications.length, 1);
    assert.match(system.notifications[0].body, /A/);
    assert.match(system.notifications[0].body, /B/);
    const list = await call('notifications:list', { module: 'test-notify' });
    assert.equal(list.length, 0);
});

test('disabled module does not show but repeat advances', async () => {
    const ctx = setup();
    const { call, container, system, setNow } = ctx;
    await call('notifications:schedule', {
        module: 'test-notify',
        title: 'Disabled',
        repeat: { type: 'daily', time: '13:00' }
    });
    container.notifications.setEnabled('test-notify', false);
    setNow('2024-05-01T13:00:01Z');
    container.notifications.tick();
    assert.equal(system.notifications.length, 0);
    const list = await call('notifications:list', { module: 'test-notify' });
    assert.equal(list[0].nextAt, '2024-05-02 13:00:00');
});

test('cancel removes a scheduled notification', async () => {
    const { call } = setup();
    const { id } = await call('notifications:schedule', {
        module: 'test-notify',
        title: 'Cancel me',
        at: '2024-05-01 13:00:00'
    });
    await call('notifications:cancel', { module: 'test-notify', id });
    const list = await call('notifications:list', { module: 'test-notify' });
    assert.equal(list.length, 0);
});

test('notifications:modules reports enabled state and count', async () => {
    const { call } = setup();
    await call('notifications:schedule', {
        module: 'test-notify',
        title: 'One',
        repeat: { type: 'daily', time: '13:00' }
    });
    const modules = await call('notifications:modules', {});
    const entry = modules.find((item) => item.module === 'test-notify');
    assert.ok(entry);
    assert.equal(entry.enabled, true);
    assert.equal(entry.count, 1);
});

test('notification errors in English', async () => {
    const { call } = setup();
    await call('settings:set', { key: 'language', value: 'en' });
    await rejects(call('notifications:schedule', { module: 'plain', title: 'X', at: '2024-05-01 13:00:00' }), 403, 'Module does not have notifications permission');
    await rejects(call('notifications:schedule', { module: 'test-notify' }), 400, 'title is required');
    await rejects(call('notifications:schedule', { module: 'test-notify', title: 'X', at: 'bad' }), 400, 'at: YYYY-MM-DD HH:MM:SS');
    await rejects(call('notifications:schedule', { module: 'test-notify', title: 'X', repeat: { type: 'bad' } }), 400, 'repeat.type: daily or weekdays');
});