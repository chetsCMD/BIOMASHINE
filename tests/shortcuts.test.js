const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp, rejects } = require('./helpers');

const press = (code, extra = {}) => ({ type: 'keyDown', code, key: 'x', control: false, meta: false, alt: false, shift: false, ...extra });

test('shortcuts:list возвращает реестр действий с привязками и признаком переопределения', async () => {
    const { call } = createApp();
    const list = await call('shortcuts:list');
    assert.ok(Array.isArray(list));
    const ids = list.map((item) => item.id).sort();
    assert.deepEqual(ids, ['fullscreen', 'moduleHub', 'quickSwitch']);
    const fullscreen = list.find((item) => item.id === 'fullscreen');
    assert.equal(fullscreen.titleKey, 'shortcut.fullscreen');
    assert.deepEqual(fullscreen.binding, { code: 'F11', ctrlOrMeta: false, shift: false, alt: false });
    assert.deepEqual(fullscreen.defaultBinding, fullscreen.binding);
    assert.equal(fullscreen.custom, false);
    const hub = list.find((item) => item.id === 'moduleHub');
    assert.equal(hub.titleKey, 'shortcut.moduleHub');
    assert.equal(hub.binding.code, 'KeyH');
    assert.equal(hub.binding.ctrlOrMeta, true);
});

test('shortcuts:set сохраняет переопределение и применяется без перезапуска', async () => {
    const { call, shortcuts } = createApp();
    const updated = await call('shortcuts:set', { id: 'quickSwitch', binding: { code: 'KeyK', ctrlOrMeta: true } });
    const item = updated.find((x) => x.id === 'quickSwitch');
    assert.deepEqual(item.binding, { code: 'KeyK', ctrlOrMeta: true, shift: false, alt: false });
    assert.equal(item.custom, true);
    assert.equal(shortcuts.match(press('KeyK', { control: true })), 'quickSwitch');
    assert.equal(shortcuts.match(press('KeyP', { control: true })), null);
});

test('shortcuts:set запрещает дубликаты и указывает конфликтующее действие', async () => {
    const { call } = createApp();
    await rejects(call('shortcuts:set', { id: 'quickSwitch', binding: { code: 'F11' } }), 400, 'fullscreen');
    await rejects(call('shortcuts:set', { id: 'moduleHub', binding: { code: 'KeyP', ctrlOrMeta: true } }), 400, 'quickSwitch');
});

test('shortcuts:set запрещает Escape, Tab, Enter', async () => {
    const { call } = createApp();
    await rejects(call('shortcuts:set', { id: 'quickSwitch', binding: { code: 'Escape', ctrlOrMeta: true } }), 400);
    await rejects(call('shortcuts:set', { id: 'quickSwitch', binding: { code: 'Tab', ctrlOrMeta: true } }), 400);
    await rejects(call('shortcuts:set', { id: 'quickSwitch', binding: { code: 'Enter', ctrlOrMeta: true } }), 400);
});

test('shortcuts:set без модификатора разрешено только для F1–F12', async () => {
    const { call } = createApp();
    await rejects(call('shortcuts:set', { id: 'quickSwitch', binding: { code: 'KeyK' } }), 400);
    const list = await call('shortcuts:set', { id: 'quickSwitch', binding: { code: 'F5' } });
    assert.equal(list.find((x) => x.id === 'quickSwitch').binding.code, 'F5');
});

test('shortcuts:set принимает только допустимые коды клавиш', async () => {
    const { call } = createApp();
    await rejects(call('shortcuts:set', { id: 'quickSwitch', binding: { code: 'Space', ctrlOrMeta: true } }), 400);
    await rejects(call('shortcuts:set', { id: 'quickSwitch', binding: { code: 'F13' } }), 400);
    await rejects(call('shortcuts:set', { id: 'quickSwitch', binding: { code: 'KeyZZ', ctrlOrMeta: true } }), 400);
    await rejects(call('shortcuts:set', { id: 'quickSwitch', binding: { code: 'Key1', ctrlOrMeta: true } }), 400);
});

test('shortcuts:reset сбрасывает одно действие и все действия', async () => {
    const { call } = createApp();
    await call('shortcuts:set', { id: 'quickSwitch', binding: { code: 'KeyK', ctrlOrMeta: true } });
    await call('shortcuts:set', { id: 'moduleHub', binding: { code: 'KeyJ', ctrlOrMeta: true } });
    const one = await call('shortcuts:reset', { id: 'quickSwitch' });
    assert.equal(one.find((x) => x.id === 'quickSwitch').custom, false);
    assert.deepEqual(one.find((x) => x.id === 'quickSwitch').binding, one.find((x) => x.id === 'quickSwitch').defaultBinding);
    assert.equal(one.find((x) => x.id === 'moduleHub').custom, true);
    const all = await call('shortcuts:reset', {});
    assert.ok(all.every((item) => item.custom === false));
});

test('shortcuts:set и shortcuts:reset отклоняют неизвестный идентификатор', async () => {
    const { call } = createApp();
    await rejects(call('shortcuts:set', { id: 'unknown', binding: { code: 'F2' } }), 400);
    await rejects(call('shortcuts:reset', { id: 'unknown' }), 400);
});

test('shortcuts: сообщения об ошибках на английском', async () => {
    const { call } = createApp({ systemLocale: 'ru-RU' });
    await call('settings:set', { key: 'language', value: 'en' });
    await rejects(call('shortcuts:set', { id: 'quickSwitch', binding: { code: 'F11' } }), 400, 'Combination is already assigned');
    await rejects(call('shortcuts:set', { id: 'unknown', binding: { code: 'F2' } }), 400, 'Unknown action: unknown');
    await rejects(call('shortcuts:set', { id: 'quickSwitch', binding: { code: 'Escape', ctrlOrMeta: true } }), 400, 'Key Escape is reserved');
    await rejects(call('shortcuts:set', { id: 'quickSwitch', binding: { code: 'KeyK' } }), 400, 'Only F1');
    await rejects(call('shortcuts:set', { id: 'quickSwitch', binding: { code: 'Space', ctrlOrMeta: true } }), 400, 'Invalid key code: Space');
});