const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { createApp, rejects } = require('./helpers');
const ConfigService = require('../src/main/core/ConfigService');

const health = new ConfigService(path.join(__dirname, '..', 'config')).get('health.profileDefaults');

test('начальные данные: профиль по умолчанию', async () => {
    const { call, container } = createApp();
    assert.deepEqual(await call('profile:get'), { height: health.height, age: health.age, trainings_count: health.trainings_count });
    container.close();
});

test('неизвестный канал возвращает 404', async () => {
    const { call, container } = createApp();
    await rejects(call('nothing:here'), 404);
    container.close();
});

test('авторизация необязательна и защищает данные после включения', async () => {
    const { call, container } = createApp();
    assert.deepEqual(await call('auth:status'), { protected: false, unlocked: true, login: null });
    await rejects(call('auth:setup', { login: 'oleg', password: '12' }), 400);
    const status = await call('auth:setup', { login: 'oleg', password: 'secret1' });
    assert.equal(status.protected, true);
    assert.equal(status.login, 'oleg');
    await call('auth:lock');
    await rejects(call('profile:get'), 401, 'Требуется вход');
    assert.equal((await call('settings:get')).theme, 'dark');
    await rejects(call('auth:login', { login: 'oleg', password: 'wrong' }), 401);
    await rejects(call('auth:login', { login: 'other', password: 'secret1' }), 401);
    await call('auth:login', { login: 'oleg', password: 'secret1' });
    assert.equal((await call('profile:get')).age, health.age);
    await call('auth:change', { login: 'oleg', password: 'secret1', newLogin: 'oleg2', newPassword: 'secret2' });
    await call('auth:lock');
    await call('auth:login', { login: 'oleg2', password: 'secret2' });
    await call('auth:remove', { login: 'oleg2', password: 'secret2' });
    assert.equal((await call('auth:status')).protected, false);
    container.close();
});

test('настройки валидируются и применяют автозапуск', async () => {
    const { call, container, system } = createApp();
    assert.deepEqual(await call('settings:get'), { theme: 'dark', autostart: false, language: 'ru', timezone: 'system', menuLayout: 'top', menuCollapsed: [], 'notifications.disabled': [] });
    await call('settings:set', { key: 'theme', value: 'light' });
    await rejects(call('settings:set', { key: 'theme', value: 'pink' }), 400);
    await rejects(call('settings:set', { key: 'unknown', value: 1 }), 400);
    const result = await call('settings:set', { key: 'autostart', value: true });
    assert.equal(result.autostart, true);
    assert.equal(system.autostart, true);
    container.close();
});

test('экспорт не содержит данных авторизации', async () => {
    const { call, container, system } = createApp();
    await call('auth:setup', { login: 'a', password: 'abcd' });
    await call('measurements:save', { date: '2026-01-01', weight: 80 });
    await call('export:json');
    const exported = JSON.parse(system.saved[0].content);
    assert.equal(exported.tables.measurements.length, 1);
    assert.ok(exported.tables.settings.every((row) => !row.key.startsWith('auth.')));
    assert.equal(exported.tables.currencies, undefined);
    assert.equal(exported.tables.pills, undefined);
    await call('export:csv');
    assert.ok(system.saved[1].files['measurements.csv'].startsWith('id,date,weight'));
    container.close();
});

test('сообщения авторизации и настроек на английском', async () => {
    const { call, container } = createApp({ systemLocale: 'ru-RU' });
    await call('settings:set', { key: 'language', value: 'en' });
    await rejects(call('auth:setup', { login: '', password: '1234' }), 400, 'Login cannot be empty');
    await rejects(call('auth:setup', { login: 'user', password: '12' }), 400, 'Password must be at least 4 characters long');
    await rejects(call('settings:set', { key: 'unknown', value: 1 }), 400, 'Unknown setting: unknown');
    await rejects(call('settings:set', { key: 'theme', value: 'pink' }), 400, 'Invalid setting value: theme');
    container.close();
});