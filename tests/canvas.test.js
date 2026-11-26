const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');
const { createApp, rejects } = require('./helpers');
const { FakeNode, createEnvironment } = require('./support/FakeCanvas');

const load = (file) => import(pathToFileURL(path.join(__dirname, '..', 'src', 'renderer', 'sdk', file)).href);
const limits = { snapPx: 10, minWidthPx: 50, minHeightPx: 40, maxHeightPx: 5000, nudgeLargeFactor: 5, precision: 4, zMax: 1000 };
const bounds = { width: 1000 };
const rect = { x: 100, y: 100, w: 200, h: 100 };
const config = {
    snapPx: 8, nudgeLargeFactor: 5, minWidthPx: 24, minHeightPx: 16, maxHeightPx: 20000, historyLimit: 100, precision: 4, zMax: 1000, defaultRoot: 'body', pickMinSizePx: 4, labelMaxLength: 10,
    ignoreTags: ['html', 'body', 'script'], protectedSelectors: ['[data-bm-canvas-ui]'], swallowedEvents: []
};

test('холст: привязка к сетке, перемещение без изменения размера и границы', async () => {
    const { CanvasGeometry } = await load('CanvasGeometry.js');
    assert.equal(CanvasGeometry.snap(14, 10), 10);
    assert.equal(CanvasGeometry.snap(15, 10), 20);
    assert.equal(CanvasGeometry.snap(5, 0), 5);
    assert.deepEqual(CanvasGeometry.move(rect, 33, -7, bounds, limits), { x: 130, y: 90, w: 200, h: 100 });
    assert.deepEqual(CanvasGeometry.move(rect, 33, -7, bounds, limits, false), { x: 133, y: 93, w: 200, h: 100 });
    assert.deepEqual(CanvasGeometry.move(rect, -500, -500, bounds, limits), { x: 0, y: 0, w: 200, h: 100 });
    assert.deepEqual(CanvasGeometry.move(rect, 5000, 0, bounds, limits), { x: 800, y: 100, w: 200, h: 100 });
    const tiny = { x: 10, y: 10, w: 16, h: 12 };
    assert.deepEqual(CanvasGeometry.move(tiny, 40, 40, bounds, limits), { x: 50, y: 50, w: 16, h: 12 });
});

test('холст: изменение размера за каждую ручку, минимальный размер и границы', async () => {
    const { CanvasGeometry } = await load('CanvasGeometry.js');
    assert.deepEqual(CanvasGeometry.resize(rect, 'se', 47, 33, bounds, limits), { x: 100, y: 100, w: 250, h: 130 });
    assert.deepEqual(CanvasGeometry.resize(rect, 'nw', 30, 20, bounds, limits), { x: 130, y: 120, w: 170, h: 80 });
    assert.deepEqual(CanvasGeometry.resize(rect, 'e', -190, 0, bounds, limits), { x: 100, y: 100, w: 50, h: 100 });
    assert.deepEqual(CanvasGeometry.resize(rect, 'w', 190, 0, bounds, limits), { x: 250, y: 100, w: 50, h: 100 });
    assert.deepEqual(CanvasGeometry.resize(rect, 'e', 2000, 0, bounds, limits), { x: 100, y: 100, w: 900, h: 100 });
    assert.deepEqual(CanvasGeometry.resize(rect, 'n', 0, -500, bounds, limits), { x: 100, y: 0, w: 200, h: 200 });
    assert.deepEqual(CanvasGeometry.resize(rect, 's', 0, -90, bounds, limits), { x: 100, y: 100, w: 200, h: 40 });
    assert.deepEqual(CanvasGeometry.resize(rect, 'se', 13, 13, bounds, limits, false), { x: 100, y: 100, w: 213, h: 113 });
});

test('холст: стрелки, смещения относительно исходного места, перевод в раскладку, слои', async () => {
    const { CanvasGeometry } = await load('CanvasGeometry.js');
    assert.equal(CanvasGeometry.nudge(rect, 'ArrowRight', bounds, limits).x, 110);
    assert.equal(CanvasGeometry.nudge(rect, 'ArrowRight', bounds, limits, true).x, 150);
    assert.equal(CanvasGeometry.nudge({ ...rect, y: 0 }, 'ArrowUp', bounds, limits).y, 0);
    assert.deepEqual(CanvasGeometry.nudge(rect, 'Enter', bounds, limits), rect);

    const natural = { x: 100, y: 200, w: 300, h: 50 };
    assert.deepEqual(CanvasGeometry.itemFromRect(natural, { x: 130, y: 180, w: 300, h: 50 }), { dx: 30, dy: -20 });
    assert.deepEqual(CanvasGeometry.itemFromRect(natural, { x: 100, y: 200, w: 340, h: 50 }), { dx: 0, dy: 0, w: 340 });
    assert.deepEqual(CanvasGeometry.rectOf(natural, { dx: 30, dy: -20, w: 340 }), { x: 130, y: 180, w: 340, h: 50 });

    const layout = CanvasGeometry.toLayout({ x: 250, y: 90, w: 500, h: 120 }, 1000, 4);
    assert.deepEqual(layout, { x: 0.25, y: 90, w: 0.5, h: 120 });
    assert.deepEqual(CanvasGeometry.fromLayout(layout, 1000), { x: 250, y: 90, w: 500, h: 120 });
    const blocks = { a: { z: 1 }, b: { z: 5 }, c: { z: 3 } };
    const front = CanvasGeometry.reorder(blocks, 'a', true);
    assert.deepEqual([front.c.z, front.b.z, front.a.z], [0, 1, 2]);
    assert.equal(CanvasGeometry.contentBottom({ a: { y: 10, h: 50 }, b: { y: 900, h: 100, hidden: true } }), 60);
});

test('холст: история отмены и повтора с ограничением длины', async () => {
    const { CanvasHistory } = await load('CanvasHistory.js');
    const history = new CanvasHistory(2);
    history.reset({ a: 1 });
    assert.equal(history.push({ a: 1 }), false);
    history.push({ a: 2 });
    history.push({ a: 3 });
    history.push({ a: 4 });
    assert.deepEqual(history.undo(), { a: 3 });
    assert.deepEqual(history.undo(), { a: 2 });
    assert.equal(history.undo(), null);
    assert.deepEqual(history.redo(), { a: 3 });
    history.push({ a: 9 });
    assert.equal(history.canRedo, false);
});

function page() {
    const title = new FakeNode('h1', { text: 'Заголовок страницы' }, [], { x: 20, y: 20, w: 300, h: 40 });
    const item1 = new FakeNode('li', { text: 'один' }, [], { x: 20, y: 120, w: 300, h: 30 });
    const item2 = new FakeNode('li', { text: 'два' }, [], { x: 20, y: 160, w: 300, h: 30 });
    const list = new FakeNode('ul', { id: 'list' }, [item1, item2], { x: 20, y: 110, w: 300, h: 90 });
    const marked = new FakeNode('section', { 'data-bm-block': 'panel' }, [], { x: 400, y: 20, w: 200, h: 100 });
    const plain = new FakeNode('div', {}, [new FakeNode('span', { text: 'вложенный' }, [], { x: 20, y: 300, w: 80, h: 20 })], { x: 20, y: 290, w: 400, h: 60 });
    const ui = new FakeNode('div', { 'data-bm-canvas-ui': '' }, [], { x: 0, y: 0, w: 1000, h: 1000 });
    const main = new FakeNode('main', { id: 'main' }, [title, list, marked, plain], { x: 0, y: 0, w: 1000, h: 800 });
    const body = new FakeNode('body', {}, [main, ui], { x: 0, y: 0, w: 1000, h: 1000 });
    return { body, main, title, list, item1, item2, marked, plain, ui };
}

test('холст: ключи элементов устойчивы и находятся обратно', async () => {
    const { CanvasKeys } = await load('CanvasKeys.js');
    const tree = page();
    const env = createEnvironment(tree.body);
    const key = (node) => CanvasKeys.keyFor(node, tree.body, env.doc);
    assert.equal(key(tree.list), '#list');
    assert.equal(key(tree.marked), '@panel');
    assert.equal(key(tree.item2), '#list>li:2');
    assert.equal(key(tree.title), '#main>h1:1');
    assert.equal(key(tree.plain.children[0]), '#main>div:1>span:1');
    assert.equal(key(tree.body), '~');
    for (const node of [tree.list, tree.marked, tree.item2, tree.title, tree.plain.children[0], tree.body]) {
        assert.equal(CanvasKeys.resolve(key(node), tree.body, env.doc), node);
    }
    assert.equal(CanvasKeys.resolve('#list>li:9', tree.body, env.doc), null);
    assert.equal(CanvasKeys.resolve('#nope', tree.body, env.doc), null);
    const duplicate = new FakeNode('p', { id: 'list' });
    tree.main.children.push(duplicate);
    duplicate.parentElement = tree.main;
    assert.equal(key(duplicate), '#main>p:1');
});

test('холст: движок применяет раскладку к любым элементам, сбрасывает и подхватывает новые', async () => {
    const { CanvasEngine } = await load('CanvasEngine.js');
    const tree = page();
    tree.title.style.setProperty('width', '111px');
    const env = createEnvironment(tree.body);
    const changes = [];
    const engine = new CanvasEngine({ win: env.win, config, scope: 'module:demo', onChange: (scope, layout) => changes.push([scope, layout]) });
    engine.start();
    engine.applyLayout('module:demo', { version: 2, items: { '#list>li:2': { dx: 30, dy: -20, w: 340 }, '#main>h1:1': { dx: 5, dy: 5, z: 3 }, '@panel': { dx: 0, dy: 0, hidden: true }, '#main>p:1': { dx: 7, dy: 7 } } });
    assert.equal(tree.item2.style.getPropertyValue('translate'), '30px -20px');
    assert.equal(tree.item2.style.getPropertyValue('width'), '340px');
    assert.equal(tree.item2.style.getPropertyValue('min-width'), '0');
    assert.equal(tree.title.style.getPropertyValue('translate'), '5px 5px');
    assert.equal(tree.title.style.getPropertyValue('z-index'), '3');
    assert.equal(tree.title.style.getPropertyValue('position'), 'relative');
    assert.equal(tree.marked.style.map.get('display').value, 'none');
    assert.equal(tree.marked.style.map.get('display').priority, 'important');
    const late = new FakeNode('p', {}, [], { x: 0, y: 0, w: 50, h: 20 });
    tree.main.children.push(late);
    late.parentElement = tree.main;
    env.mutate();
    assert.equal(late.style.getPropertyValue('translate'), '7px 7px');
    engine.reset('module:demo');
    assert.equal(tree.item2.style.getPropertyValue('translate'), '');
    assert.equal(tree.item2.style.getPropertyValue('width'), '');
    assert.equal(tree.title.style.getPropertyValue('width'), '111px');
    assert.equal(tree.title.style.getPropertyValue('z-index'), '');
    assert.equal(tree.marked.style.getPropertyValue('display'), '');
    assert.deepEqual(changes, []);
});

test('холст: выбор, перемещение, размер, история, скрытие и иерархия', async () => {
    const { CanvasEngine } = await load('CanvasEngine.js');
    const tree = page();
    const env = createEnvironment(tree.body);
    const states = [];
    const changes = [];
    const engine = new CanvasEngine({ win: env.win, config, scope: 'module:demo', onChange: (scope, layout) => changes.push(layout), onState: (state) => states.push(state) });
    engine.start();
    engine.applyLayout('module:demo', null);

    assert.equal(engine.pick(30, 30), tree.title);
    assert.equal(engine.pick(30, 130), tree.item1);
    assert.equal(engine.pick(500, 500), tree.main);
    assert.equal(engine.excluded(tree.ui), true);
    assert.equal(engine.excluded(tree.body), true);
    assert.equal(engine.label(tree.title), 'Заголовок…');
    assert.equal(engine.label(tree.marked), '<section>');

    engine.select(tree.item1);
    assert.equal(engine.state().selected.key, '#list>li:1');
    assert.deepEqual(engine.state().breadcrumb.map((crumb) => crumb.key), ['#main', '#list', '#list>li:1']);
    const start = engine.documentRect(tree.item1);
    const moved = { ...start, x: start.x + 40, y: start.y + 16 };
    assert.equal(engine.setRect(tree.item1, moved), true);
    engine.commitScope('module:demo');
    assert.equal(tree.item1.style.getPropertyValue('translate'), '40px 16px');
    assert.deepEqual(changes.at(-1), { version: 2, items: { '#list>li:1': { dx: 40, dy: 16 } } });

    assert.equal(engine.setRect(tree.item1, { ...moved, w: 360 }), true);
    engine.commitScope('module:demo');
    assert.deepEqual(changes.at(-1).items['#list>li:1'], { dx: 40, dy: 16, w: 360 });
    assert.equal(engine.state().canUndo, true);
    engine.undo();
    assert.equal(tree.item1.style.getPropertyValue('width'), '');
    assert.equal(tree.item1.style.getPropertyValue('translate'), '40px 16px');
    engine.redo();
    assert.equal(tree.item1.style.getPropertyValue('width'), '360px');
    engine.undo();
    engine.undo();
    assert.equal(tree.item1.style.getPropertyValue('translate'), '');

    engine.select(tree.list);
    engine.nudgeSelected('ArrowRight', false);
    assert.equal(tree.list.style.getPropertyValue('translate'), '8px 0px');
    engine.select(tree.title);
    engine.hideSelected();
    assert.equal(tree.title.style.map.get('display').value, 'none');
    assert.equal(engine.state().hidden.length, 1);
    assert.equal(engine.state().hidden[0].key, '#main>h1:1');
    engine.show('module:demo', '#main>h1:1');
    assert.equal(tree.title.style.getPropertyValue('display'), '');
    assert.equal(engine.state().hidden.length, 0);

    engine.select(tree.list);
    engine.order(true);
    assert.equal(tree.list.style.getPropertyValue('z-index'), '1');
    engine.order(false);
    assert.equal(tree.list.style.getPropertyValue('z-index'), '');

    engine.select(tree.item1);
    engine.parent();
    assert.equal(engine.selected, tree.list);
    engine.parent();
    assert.equal(engine.selected, tree.main);
    engine.parent();
    assert.equal(engine.selected, tree.main);
    engine.child();
    assert.equal(engine.selected, tree.title);
    engine.command({ command: 'select', key: '#list>li:2' });
    assert.equal(engine.selected, tree.item2);
    engine.command({ command: 'select', key: null });
    assert.equal(engine.selected, null);
    assert.ok(states.length > 10);
});

test('раскладка: хранение по областям, нормализация и проверка значений', async () => {
    const { call, container } = createApp();
    assert.deepEqual(await call('layout:get', { scope: 'module:reaction' }), { layout: null });
    const saved = await call('layout:save', { scope: 'module:reaction', layout: { version: 2, items: { '#list>li:2': { dx: 30.4, dy: -20.6, w: 340, z: 2 }, '@panel': { dx: 0, dy: 0, hidden: true }, '#plain': { dx: 0, dy: 0 }, '#main>h1:1': { dx: 5, dy: 0, z: 0 } } } });
    assert.deepEqual(saved.layout, { version: 2, items: { '#list>li:2': { dx: 30, dy: -21, w: 340, z: 2 }, '@panel': { dx: 0, dy: 0, hidden: true }, '#main>h1:1': { dx: 5, dy: 0 } } });
    assert.deepEqual(await call('layout:get', { scope: 'module:reaction' }), saved);
    assert.deepEqual(await call('layout:get', { scope: 'module:kbju' }), { layout: null });
    await call('layout:save', { scope: 'shell', layout: { version: 2, items: { '#nav': { dx: 10, dy: 0 } } } });
    await call('layout:save', { scope: 'view:settings', layout: { version: 2, items: { '#x': { dx: 1, dy: 1 } } } });
    assert.equal((await call('layout:get', { scope: 'shell' })).layout.items['#nav'].dx, 10);
    assert.deepEqual(await call('layout:reset', { scope: 'module:reaction' }), { layout: null });
    assert.deepEqual(await call('layout:get', { scope: 'module:reaction' }), { layout: null });

    const bad = (layout) => rejects(call('layout:save', { scope: 'shell', layout }), 400);
    await bad(null);
    await bad({ version: 1, items: {} });
    await bad({ version: 2, items: [] });
    await bad({ version: 2 });
    await bad({ version: 2, items: { 'bad key!': { dx: 1, dy: 1 } } });
    await bad({ version: 2, items: { ['a'.repeat(401)]: { dx: 1, dy: 1 } } });
    await bad({ version: 2, items: { a: { dx: 'x', dy: 0 } } });
    await bad({ version: 2, items: { a: { dx: 99999, dy: 0 } } });
    await bad({ version: 2, items: { a: { dx: 1, dy: 1, w: 0 } } });
    await bad({ version: 2, items: { a: { dx: 1, dy: 1, h: 99999 } } });
    await bad({ version: 2, items: { a: { dx: 1, dy: 1, z: 5000 } } });
    await bad({ version: 2, items: { a: 5 } });
    const many = {};
    for (let index = 0; index < 2001; index += 1) many[`k${index}`] = { dx: 1, dy: 1 };
    await bad({ version: 2, items: many });
    await rejects(call('layout:get', { scope: 'nope' }), 400);
    await rejects(call('layout:get', {}), 400);
    await rejects(call('layout:get', { scope: 'module:nope' }), 404);
    await rejects(call('layout:get', { scope: 'module:builder-x!' }), 400);
    await call('auth:setup', { login: 'a', password: 'abcd' });
    await call('auth:lock');
    await rejects(call('layout:get', { scope: 'shell' }), 401);
    container.close();
});

test('холст: состояние сообщается только при изменении', async () => {
    const { CanvasEngine } = await load('CanvasEngine.js');
    const tree = page();
    const env = createEnvironment(tree.body);
    const calls = [];
    const engine = new CanvasEngine({ win: env.win, config, scope: 'module:demo', onState: (state) => calls.push(state) });
    engine.start();
    engine.emitState();
    engine.emitState();
    env.mutate();
    assert.equal(calls.length, 1);
    engine.select(tree.title);
    assert.equal(calls.length, 2);
    assert.equal(engine.inUi(tree.ui), true);
    assert.equal(engine.inUi(tree.title), false);
});

test('холст: правка текста применяется, сохраняется, возвращается и не трогает составные элементы', async () => {
    const { CanvasEngine } = await load('CanvasEngine.js');
    const tree = page();
    const env = createEnvironment(tree.body);
    const changes = [];
    const engine = new CanvasEngine({ win: env.win, config: { ...config, maxTextLength: 20 }, scope: 'module:demo', onChange: (scope, layout) => changes.push(layout) });
    engine.start();
    engine.applyLayout('module:demo', { version: 2, items: { '#list>li:1': { dx: 0, dy: 0, text: 'новый текст' }, '#list': { dx: 0, dy: 0, text: 'не должно примениться' } } });
    assert.equal(tree.item1.textContent, 'новый текст');
    assert.equal(tree.list.children.length, 2);
    engine.reset('module:demo');
    assert.equal(tree.item1.textContent, 'один');

    engine.setText(tree.item2, 'zzz');
    assert.equal(tree.item2.textContent, 'zzz');
    assert.deepEqual(changes.at(-1).items['#list>li:2'], { dx: 0, dy: 0, text: 'zzz' });
    engine.setText(tree.item2, 'два');
    assert.equal(tree.item2.textContent, 'два');
    assert.equal(changes.at(-1).items['#list>li:2'], undefined);
    engine.setText(tree.item2, 'x'.repeat(50));
    assert.equal(changes.at(-1).items['#list>li:2'].text.length, 20);
    engine.reset('module:demo');
    assert.equal(tree.item2.textContent, 'два');
});

test('раскладка: текст элемента хранится и проверяется', async () => {
    const { call, container } = createApp();
    const saved = await call('layout:save', { scope: 'shell', layout: { version: 2, items: { '#title': { dx: 0, dy: 0, text: 'Hello' }, '#plain': { dx: 0, dy: 0 } } } });
    assert.deepEqual(saved.layout.items, { '#title': { dx: 0, dy: 0, text: 'Hello' } });
    await rejects(call('layout:save', { scope: 'shell', layout: { version: 2, items: { '#a': { dx: 0, dy: 0, text: 5 } } } }), 400);
    await rejects(call('layout:save', { scope: 'shell', layout: { version: 2, items: { '#a': { dx: 0, dy: 0, text: 'x'.repeat(501) } } } }), 400);
    container.close();
});
