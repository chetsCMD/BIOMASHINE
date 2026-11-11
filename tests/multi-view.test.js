const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

const renderer = path.join(__dirname, '..', 'src', 'renderer');
const splitConfig = require(path.join(__dirname, '..', 'config', 'split.json'));
const load = (...parts) => import(pathToFileURL(path.join(renderer, ...parts)).href);

test('SplitState: одиночный режим и переход в split', async () => {
    const { SplitState } = await load('shell', 'SplitState.js');
    const state = new SplitState();
    assert.equal(state.primaryId, null);
    assert.equal(state.secondaryId, null);
    assert.equal(state.isSplit, false);

    state.open('a');
    assert.equal(state.primaryId, 'a');
    assert.equal(state.secondaryId, null);
    assert.equal(state.isSplit, false);

    assert.equal(state.openSplit('b'), true);
    assert.equal(state.primaryId, 'a');
    assert.equal(state.secondaryId, 'b');
    assert.equal(state.isSplit, true);
});

test('SplitState: openSplit для того же модуля возвращает false', async () => {
    const { SplitState } = await load('shell', 'SplitState.js');
    const state = new SplitState();
    state.open('a');
    assert.equal(state.openSplit('a'), false);
    assert.equal(state.secondaryId, null);
    assert.equal(state.isSplit, false);
});

test('SplitState: openSplit без открытого primary возвращает false', async () => {
    const { SplitState } = await load('shell', 'SplitState.js');
    const state = new SplitState();
    assert.equal(state.openSplit('b'), false);
    assert.equal(state.primaryId, null);
    assert.equal(state.secondaryId, null);
});

test('SplitState: closeRight оставляет primary', async () => {
    const { SplitState } = await load('shell', 'SplitState.js');
    const state = new SplitState();
    state.open('a');
    state.openSplit('b');
    const removed = state.closeRight();
    assert.equal(removed, 'b');
    assert.equal(state.primaryId, 'a');
    assert.equal(state.secondaryId, null);
    assert.equal(state.isSplit, false);
});

test('SplitState: closeLeft повышает secondary до primary', async () => {
    const { SplitState } = await load('shell', 'SplitState.js');
    const state = new SplitState();
    state.open('a');
    state.openSplit('b');
    const next = state.closeLeft();
    assert.equal(next, 'b');
    assert.equal(state.primaryId, 'b');
    assert.equal(state.secondaryId, null);
    assert.equal(state.isSplit, false);
});

test('SplitState: closeLeft без split возвращает null и не мутирует', async () => {
    const { SplitState } = await load('shell', 'SplitState.js');
    const state = new SplitState();
    state.open('a');
    assert.equal(state.closeLeft(), null);
    assert.equal(state.primaryId, 'a');
    assert.equal(state.secondaryId, null);
});

test('SplitState: reset очищает всё', async () => {
    const { SplitState } = await load('shell', 'SplitState.js');
    const state = new SplitState();
    state.open('a');
    state.openSplit('b');
    state.reset();
    assert.equal(state.primaryId, null);
    assert.equal(state.secondaryId, null);
    assert.equal(state.isSplit, false);
});

test('SplitRatio: читает min/max/default из config/split.json', async () => {
    const { SplitRatio } = await load('shell', 'SplitRatio.js');
    const ratio = new SplitRatio(splitConfig);
    assert.equal(ratio.min, splitConfig.minRatio);
    assert.equal(ratio.max, splitConfig.maxRatio);
    assert.equal(ratio.default, splitConfig.defaultRatio);
});

test('SplitRatio: clamp удерживает в диапазоне из конфига', async () => {
    const { SplitRatio } = await load('shell', 'SplitRatio.js');
    const ratio = new SplitRatio(splitConfig);
    assert.equal(ratio.clamp(0), splitConfig.minRatio);
    assert.equal(ratio.clamp(1), splitConfig.maxRatio);
    assert.equal(ratio.clamp(0.5), 0.5);
    assert.equal(ratio.clamp(-1), splitConfig.minRatio);
    assert.equal(ratio.clamp(2), splitConfig.maxRatio);
    assert.equal(ratio.clamp(NaN), splitConfig.defaultRatio);
    assert.equal(ratio.clamp(Infinity), splitConfig.defaultRatio);
});

test('SplitRatio: fromDelta пересчитывает и клипает', async () => {
    const { SplitRatio } = await load('shell', 'SplitRatio.js');
    const ratio = new SplitRatio(splitConfig);
    assert.equal(ratio.fromDelta(0.5, 100, 1000), 0.6);
    assert.equal(ratio.fromDelta(0.5, -100, 1000), 0.4);
    assert.equal(ratio.fromDelta(0.5, 10000, 1000), splitConfig.maxRatio);
    assert.equal(ratio.fromDelta(0.5, -10000, 1000), splitConfig.minRatio);
    assert.equal(ratio.fromDelta(0.5, 100, 0), 0.5);
    assert.equal(ratio.fromDelta(0.5, 100, -1), 0.5);
});

test('SplitRatio: toPercent форматирует с четырьмя знаками', async () => {
    const { SplitRatio } = await load('shell', 'SplitRatio.js');
    const ratio = new SplitRatio(splitConfig);
    assert.equal(ratio.toPercent(0.5), '50.0000%');
    assert.equal(ratio.toPercent(0.3), '30.0000%');
    assert.equal(ratio.toPercent(0), `${(splitConfig.minRatio * 100).toFixed(4)}%`);
    assert.equal(ratio.toPercent(2), `${(splitConfig.maxRatio * 100).toFixed(4)}%`);
});

test('SplitRatio: переопределение конфига меняет поведение', async () => {
    const { SplitRatio } = await load('shell', 'SplitRatio.js');
    const ratio = new SplitRatio({ minRatio: 0.2, maxRatio: 0.8, defaultRatio: 0.4 });
    assert.equal(ratio.clamp(0), 0.2);
    assert.equal(ratio.clamp(1), 0.8);
    assert.equal(ratio.clamp(NaN), 0.4);
    assert.equal(ratio.toPercent(0.4), '40.0000%');
});

test('NavMultiClick: пропускает без Ctrl/Meta', async () => {
    const { NavMultiClick } = await load('shell', 'NavMultiClick.js');
    let opened = null;
    const nav = new NavMultiClick({
        root: { contains: () => true },
        isPage: () => true,
        onOpen: (id) => { opened = id; },
        document: { addEventListener: () => {}, removeEventListener: () => {} }
    });
    nav.handle({ ctrlKey: false, metaKey: false });
    assert.equal(opened, null);
});

test('NavMultiClick: срабатывает на Ctrl+Click по известному модулю', async () => {
    const { NavMultiClick } = await load('shell', 'NavMultiClick.js');
    let opened = null;
    const prevented = [];
    const anchor = { dataset: {}, getAttribute: (name) => (name === 'href' ? '#module/sleep' : null) };
    const target = { closest: () => anchor };
    const nav = new NavMultiClick({
        root: { contains: () => true },
        isPage: (id) => id === 'sleep',
        onOpen: (id) => { opened = id; },
        document: { addEventListener: () => {}, removeEventListener: () => {} }
    });
    nav.handle({
        ctrlKey: true,
        metaKey: false,
        target,
        preventDefault: () => prevented.push('prevent'),
        stopImmediatePropagation: () => prevented.push('stop')
    });
    assert.equal(opened, 'sleep');
    assert.deepEqual(prevented, ['prevent', 'stop']);
});

test('NavMultiClick: Cmd+Click работает на macOS', async () => {
    const { NavMultiClick } = await load('shell', 'NavMultiClick.js');
    let opened = null;
    const anchor = { dataset: { id: 'food' }, getAttribute: () => null };
    const target = { closest: () => anchor };
    const nav = new NavMultiClick({
        root: { contains: () => true },
        isPage: (id) => id === 'food',
        onOpen: (id) => { opened = id; },
        document: { addEventListener: () => {}, removeEventListener: () => {} }
    });
    nav.handle({ ctrlKey: false, metaKey: true, target, preventDefault: () => {}, stopImmediatePropagation: () => {} });
    assert.equal(opened, 'food');
});

test('NavMultiClick: игнорирует неизвестный модуль', async () => {
    const { NavMultiClick } = await load('shell', 'NavMultiClick.js');
    let opened = null;
    const anchor = { dataset: {}, getAttribute: (name) => (name === 'href' ? '#module/unknown' : null) };
    const target = { closest: () => anchor };
    const nav = new NavMultiClick({
        root: { contains: () => true },
        isPage: () => false,
        onOpen: (id) => { opened = id; },
        document: { addEventListener: () => {}, removeEventListener: () => {} }
    });
    nav.handle({ ctrlKey: true, metaKey: false, target, preventDefault: () => {}, stopImmediatePropagation: () => {} });
    assert.equal(opened, null);
});

test('NavMultiClick: игнорирует клики вне навигации', async () => {
    const { NavMultiClick } = await load('shell', 'NavMultiClick.js');
    let opened = null;
    const anchor = { dataset: { id: 'sleep' }, getAttribute: () => null };
    const target = { closest: () => anchor };
    const nav = new NavMultiClick({
        root: { contains: () => false },
        isPage: () => true,
        onOpen: (id) => { opened = id; },
        document: { addEventListener: () => {}, removeEventListener: () => {} }
    });
    nav.handle({ ctrlKey: true, metaKey: false, target, preventDefault: () => {}, stopImmediatePropagation: () => {} });
    assert.equal(opened, null);
});

test('NavMultiClick: attach/detach не падают на мок-document', async () => {
    const { NavMultiClick } = await load('shell', 'NavMultiClick.js');
    const registered = [];
    const removed = [];
    const documentMock = {
        addEventListener: (type, fn, capture) => registered.push({ type, fn, capture }),
        removeEventListener: (type, fn, capture) => removed.push({ type, fn, capture })
    };
    const nav = new NavMultiClick({
        root: { contains: () => false },
        isPage: () => false,
        onOpen: () => {},
        document: documentMock
    });
    nav.attach();
    assert.equal(registered.length, 1);
    assert.equal(registered[0].type, 'click');
    assert.equal(registered[0].capture, true);
    nav.detach();
    assert.equal(removed.length, 1);
    assert.equal(removed[0].type, 'click');
});
