const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createApp, rejects } = require('./helpers');
const ShortcutService = require('../src/main/ShortcutService');

const root = path.join(__dirname, '..', 'config');
const rules = JSON.parse(fs.readFileSync(path.join(root, 'shortcuts.json'), 'utf8'));
const defaults = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).shortcuts;
const memory = () => {
    const map = new Map();
    return { get: (key) => (map.has(key) ? map.get(key) : null), set: (key, value) => map.set(key, JSON.parse(JSON.stringify(value))), remove: (key) => map.delete(key) };
};

test('сочетания: правила допускают стрелки, цифровую клавиатуру и знаки, но не одиночные модификаторы', () => {
    const service = new ShortcutService({ defaults, settings: memory(), actions: {}, rules });
    for (const code of ['ArrowLeft', 'Numpad5', 'Backquote', 'Slash', 'Space', 'PageUp', 'KeyZ', 'Digit4', 'F5']) {
        assert.equal(service.validate({ code, ctrlOrMeta: true }, 'quickSwitch').code, code);
    }
    for (const code of ['ControlLeft', 'AltLeft', 'ShiftRight', 'MetaLeft', 'CapsLock', 'Escape', 'Tab', 'Enter']) {
        assert.throws(() => service.validate({ code, ctrlOrMeta: true }, 'quickSwitch'), code);
    }
    assert.throws(() => service.validate({ code: 'KeyA' }, 'quickSwitch'));
    assert.throws(() => service.validate({ code: 'ArrowUp' }, 'quickSwitch'));
    assert.equal(service.validate({ code: 'F7' }, 'quickSwitch').code, 'F7');
    assert.throws(() => service.validate({ code: 'KeyP', ctrlOrMeta: true }, 'canvasMode'), /./);
});

test('сочетания: действия без обработчика в главном процессе пересылаются в окно, контекст имеет приоритет', () => {
    const sent = [];
    const ran = [];
    const service = new ShortcutService({ defaults, settings: memory(), actions: { quickSwitch: () => ran.push('quickSwitch') }, rules });
    let handler;
    service.attach({ on: (name, fn) => (handler = fn), send: (channel, id) => sent.push([channel, id]) });
    const press = (input) => {
        let prevented = false;
        handler({ preventDefault: () => (prevented = true) }, { type: 'keyDown', ...input });
        return prevented;
    };
    assert.equal(press({ code: 'KeyP', control: true }), true);
    assert.deepEqual(ran, ['quickSwitch']);
    assert.equal(press({ code: 'KeyE', control: true }), true);
    assert.equal(press({ code: 'KeyO', meta: true }), true);
    assert.deepEqual(sent, [[rules.channel, 'canvasMode'], [rules.channel, 'globalSearch']]);
    assert.equal(press({ code: 'KeyZ', control: true }), false);
    assert.equal(press({ code: 'KeyP', control: true, shift: true }), false);

    service.addContextual({ context: 'module:weight', action: 'canvasMode', binding: { code: 'KeyP', ctrlOrMeta: true } });
    service.setContext('module:weight');
    assert.equal(press({ code: 'KeyP', control: true }), true);
    assert.deepEqual(ran, ['quickSwitch']);
    assert.deepEqual(sent.at(-1), [rules.channel, 'canvasMode']);
    service.setContext('module:sleep');
    press({ code: 'KeyP', control: true });
    assert.deepEqual(ran, ['quickSwitch', 'quickSwitch']);
    service.setContext('global');
    press({ code: 'KeyP', control: true });
    assert.equal(ran.length, 3);
});

test('сочетания: каналы контекстов и макросов', async () => {
    const { call, container } = createApp();
    const list = await call('shortcuts:list');
    assert.ok(list.some((item) => item.id === 'globalSearch' && item.binding.code === 'KeyO'));

    await call('hotkeys:context', { context: 'module:weight' });
    await call('hotkeys:context', { context: 'view:settings' });
    await call('hotkeys:context', { context: 'global' });
    await rejects(call('hotkeys:context', { context: 'bad context' }), 400);
    await rejects(call('hotkeys:context', {}), 400);

    const binding = { code: 'KeyJ', ctrlOrMeta: true };
    const added = await call('hotkeys:contextAdd', { context: 'module:weight', action: 'canvasMode', binding });
    assert.deepEqual(added, [{ context: 'module:weight', action: 'canvasMode', binding: { code: 'KeyJ', ctrlOrMeta: true, shift: false, alt: false } }]);
    await call('hotkeys:contextAdd', { context: 'module:sleep', action: 'canvasMode', binding });
    await rejects(call('hotkeys:contextAdd', { context: 'module:weight', action: 'moduleHub', binding }), 400);
    await rejects(call('hotkeys:contextAdd', { context: 'global', action: 'moduleHub', binding }), 400);
    await rejects(call('hotkeys:contextAdd', { context: 'module:weight', action: 'nope', binding: { code: 'KeyK', ctrlOrMeta: true } }), 400);
    await rejects(call('hotkeys:contextAdd', { context: 'module:weight', action: 'moduleHub', binding: { code: 'ControlLeft', ctrlOrMeta: true } }), 400);
    assert.equal((await call('hotkeys:contextual')).length, 2);
    assert.equal((await call('hotkeys:contextRemove', { index: 0 })).length, 1);
    await rejects(call('hotkeys:contextRemove', { index: 9 }), 400);

    assert.deepEqual(await call('hotkeys:macros'), []);
    const macros = await call('hotkeys:macroSave', { name: '  Утро  ', steps: ['open:weight', 'wait:300', 'globalSearch', 'open:settings'] });
    assert.equal(macros.length, 1);
    assert.equal(macros[0].name, 'Утро');
    const id = macros[0].id;
    const withMacro = await call('shortcuts:list');
    const item = withMacro.find((entry) => entry.id === `macro:${id}`);
    assert.deepEqual([item.macro, item.name, item.binding], [true, 'Утро', null]);
    await call('shortcuts:set', { id: `macro:${id}`, binding: { code: 'KeyM', ctrlOrMeta: true, shift: true } });
    assert.equal((await call('shortcuts:list')).find((entry) => entry.id === `macro:${id}`).binding.code, 'KeyM');
    await call('hotkeys:contextAdd', { context: 'module:kbju', action: `macro:${id}`, binding: { code: 'KeyL', ctrlOrMeta: true } });
    await call('hotkeys:macroSave', { id, name: 'Вечер', steps: ['fullscreen'] });
    assert.equal((await call('hotkeys:macros'))[0].name, 'Вечер');

    await rejects(call('hotkeys:macroSave', { name: '', steps: ['fullscreen'] }), 400);
    await rejects(call('hotkeys:macroSave', { name: 'x'.repeat(rules.maxNameLength + 1), steps: ['fullscreen'] }), 400);
    await rejects(call('hotkeys:macroSave', { name: 'a', steps: [] }), 400);
    await rejects(call('hotkeys:macroSave', { name: 'a', steps: ['launch:missiles'] }), 400);
    await rejects(call('hotkeys:macroSave', { name: 'a', steps: [`wait:${rules.maxWaitMs + 1}`] }), 400);
    await rejects(call('hotkeys:macroSave', { name: 'a', steps: Array(rules.maxSteps + 1).fill('fullscreen') }), 400);
    await rejects(call('hotkeys:macroSave', { id: 'ghost', name: 'a', steps: ['fullscreen'] }), 404);

    await call('hotkeys:macroRemove', { id });
    assert.deepEqual(await call('hotkeys:macros'), []);
    assert.equal((await call('shortcuts:list')).some((entry) => entry.macro), false);
    assert.equal((await call('hotkeys:contextual')).some((entry) => entry.action === `macro:${id}`), false);
    await rejects(call('hotkeys:macroRemove', { id }), 404);
    container.close();
});
