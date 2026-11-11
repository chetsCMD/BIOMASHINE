const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

const renderer = path.join(__dirname, '..', 'src', 'renderer');
const load = (...parts) => import(pathToFileURL(path.join(renderer, ...parts)).href);
const reaction = (file) => load('modules', 'reaction', 'js', file);

class FakeClock {
    constructor() {
        this.time = 0;
        this.timers = [];
        this.counter = 0;
    }

    now = () => this.time;

    setTimer = (work, delay) => {
        const timer = { id: ++this.counter, at: this.time + delay, work };
        this.timers.push(timer);
        return timer.id;
    };

    clearTimer = (id) => {
        this.timers = this.timers.filter((timer) => timer.id !== id);
    };

    advance(ms) {
        const target = this.time + ms;
        for (;;) {
            const due = this.timers.filter((timer) => timer.at <= target).sort((a, b) => a.at - b.at)[0];
            if (!due) {
                break;
            }
            this.timers = this.timers.filter((timer) => timer !== due);
            this.time = due.at;
            due.work();
        }
        this.time = target;
    }
}

const settings = { stages: 5, waitMinMs: 1000, waitMaxMs: 5000, failDelayMs: 1000, successDelayMs: 800 };

async function createTest(random = () => 0) {
    const { ReactionTest } = await reaction('ReactionTest.js');
    const clock = new FakeClock();
    const states = [];
    const finished = [];
    let resets = 0;
    const instance = new ReactionTest({
        config: settings,
        random,
        now: clock.now,
        setTimer: clock.setTimer,
        clearTimer: clock.clearTimer,
        listener: { onState: (state) => states.push(state), onReset: () => (resets += 1), onFinish: (outcome) => finished.push(outcome) }
    });
    return { instance, clock, states, finished, resets: () => resets };
}

async function playStage(context, reactionMs) {
    context.instance.press();
    context.clock.advance(1000);
    assert.equal(context.states.at(-1).state, 'go');
    context.clock.advance(reactionMs);
    context.instance.press();
    context.clock.advance(800);
}

test('ReactionStats: сводка, медиана, гистограмма', async () => {
    const { ReactionStats } = await reaction('ReactionStats.js');
    assert.equal(ReactionStats.summarize([]), null);
    assert.equal(ReactionStats.summarize([Number.NaN]), null);
    const summary = ReactionStats.summarize([200, 300, 400, 500]);
    assert.equal(summary.best, 200);
    assert.equal(summary.worst, 500);
    assert.equal(summary.mean, 350);
    assert.equal(summary.median, 350);
    assert.ok(Math.abs(summary.deviation - Math.sqrt(12500)) < 1e-9);
    assert.equal(ReactionStats.summarize([1, 2, 9]).median, 2);
    assert.equal(ReactionStats.histogram([250, 250], 10), null);
    const bins = ReactionStats.histogram([200, 210, 220, 300], 2);
    assert.deepEqual(bins.counts, [3, 1]);
    assert.deepEqual(bins.labels, ['200-250', '250-300']);
    assert.equal(ReactionStats.average([250, 251]), 251);
});

test('ReactionTest: полный тест из пяти этапов сохраняется как полный', async () => {
    const context = await createTest();
    context.instance.start();
    assert.deepEqual(context.states.at(-1).text, { key: 'test.stagePrompt', params: { stage: 1 } });
    for (const value of [250, 260, 270, 280, 290]) {
        await playStage(context, value);
    }
    assert.equal(context.finished.length, 1);
    assert.deepEqual(context.finished[0], { values: [250, 260, 270, 280, 290], average: 270, complete: true });
    assert.deepEqual(context.states.at(-1).text, { key: 'test.done' });
    assert.deepEqual(context.states.at(-1).sub, { key: 'test.doneAverage', params: { average: 270 } });
});

test('ReactionTest: фальстарт пропускает этап, тест не полный, повторные нажатия игнорируются', async () => {
    const context = await createTest();
    context.instance.start();
    context.instance.press();
    context.clock.advance(300);
    context.instance.press();
    assert.equal(context.states.at(-1).state, 'fail');
    context.instance.press();
    assert.equal(context.states.at(-1).state, 'fail');
    context.clock.advance(1000);
    assert.deepEqual(context.states.at(-1).text, { key: 'test.stagePrompt', params: { stage: 2 } });
    for (const value of [250, 250, 250, 250]) {
        await playStage(context, value);
    }
    assert.equal(context.finished[0].complete, false);
    assert.equal(context.finished[0].values.length, 4);
});

test('ReactionTest: сброс останавливает таймеры, случайная пауза в границах', async () => {
    const context = await createTest(() => 0.999);
    context.instance.start();
    context.instance.press();
    context.clock.advance(4995);
    assert.equal(context.states.at(-1).state, 'waiting');
    context.clock.advance(1);
    assert.equal(context.states.at(-1).state, 'go');
    context.instance.abort();
    assert.equal(context.clock.timers.length, 0);
    assert.deepEqual(context.states.at(-1).text, { key: 'test.startPrompt' });
    assert.equal(context.finished.length, 0);
});

test('ReactionTest: таймеры по умолчанию вызываются без привязки к объекту (как в браузере)', async () => {
    const { ReactionTest } = await reaction('ReactionTest.js');
    const original = { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
    const strict = (real) =>
        function (...args) {
            if (this !== undefined && this !== globalThis) {
                throw new TypeError('Illegal invocation');
            }
            return real.apply(globalThis, args);
        };
    globalThis.setTimeout = strict(original.setTimeout);
    globalThis.clearTimeout = strict(original.clearTimeout);
    try {
        const instance = new ReactionTest({
            config: { ...settings, waitMinMs: 1, waitMaxMs: 2 },
            listener: { onState: () => {}, onReset: () => {}, onFinish: () => {} }
        });
        instance.start();
        instance.press();
        instance.press();
        instance.abort();
        assert.equal(instance.timers.size, 0);
    } finally {
        globalThis.setTimeout = original.setTimeout;
        globalThis.clearTimeout = original.clearTimeout;
    }
});

test('ChannelPolicy: точные каналы и домены', async () => {
    const { ChannelPolicy } = await load('shell', 'ChannelPolicy.js');
    const policy = new ChannelPolicy(['sleep:*', 'profile:get']);
    assert.equal(policy.allows('sleep:listLogs'), true);
    assert.equal(policy.allows('profile:get'), true);
    assert.equal(policy.allows('profile:updateParams'), false);
    assert.equal(policy.allows('auth:remove'), false);
    assert.equal(policy.allows('sleep'), false);
    assert.equal(policy.allows(null), false);
    assert.equal(new ChannelPolicy().allows('sleep:listLogs'), false);
});

test('мост оболочки и клиент модуля: рукопожатие, вызовы, запреты, чужие источники', async () => {
    const { ModuleBridge } = await load('shell', 'ModuleBridge.js');
    const { ModuleClient } = await load('sdk', 'ModuleClient.js');
    const { Translator } = await load('sdk', 'Translator.js');
    const deliver = (target, event) => setImmediate(() => target.handlers.message.forEach((handler) => handler(event)));

    const shellWin = { handlers: { message: [] }, addEventListener: (type, fn) => shellWin.handlers[type].push(fn), removeEventListener: () => {} };
    const makeWin = () => {
        const win = {
            handlers: { message: [], error: [], unhandledrejection: [] },
            location: { ancestorOrigins: ['bm://app'] },
            parent: shellWin,
            addEventListener: (type, fn) => win.handlers[type].push(fn),
            postMessage: (message) => deliver(win, { data: message, source: shellWin }),
            document: {
                nodes: [],
                documentElement: { dataset: {} },
                head: { append: (node) => win.document.nodes.push(node) },
                getElementById: (id) => win.document.nodes.find((node) => node.id === id) || null,
                createElement: () => ({})
            }
        };
        return win;
    };
    const clientWin = makeWin();
    shellWin.postMessage = (message, targetOrigin) => {
        assert.equal(targetOrigin, 'bm://app');
        deliver(shellWin, { data: message, source: clientWin, origin: 'bm://reaction' });
    };

    globalThis.window = shellWin;
    const calls = [];
    const pills = [];
    const crashes = [];
    const themeListeners = new Set();
    const theme = {
        listeners: themeListeners,
        onChange: (listener) => themeListeners.add(listener),
        current: () => ({ name: 'dark', colorScheme: 'dark', variables: { '--bg': '#000' }, chart: { text: '#aaa', grid: '#333' } })
    };
    const api = {
        invoke: async (channel, payload) => {
            if (channel === 'settings:get') {
                return { timezone: 'Asia/Tokyo' };
            }
            calls.push([channel, payload]);
            if (channel === 'i18n:bundle') {
                return { language: 'ru', locale: 'ru-RU', strings: { hello: 'Привет, {name}!', n: { one: '{count} штука', few: '{count} штуки', many: '{count} штук', other: '{count} штуки' } } };
            }
            if (channel === 'storage:insert') {
                return { id: channel };
            }
            if (channel === 'boom:fail') {
                const error = new Error('сломалось');
                error.status = 500;
                throw error;
            }
            return { channel };
        }
    };
    const dialogs = { confirm: async (message) => message === 'ok?' };
    const bridge = new ModuleBridge({
        api,
        theme,
        dialogs,
        i18n: new Translator({ language: 'ru', locale: 'ru-RU', strings: { 'bridge.denied': 'Модулю запрещён канал: {channel}' } }),
        pluginCss: ['bm://plug/a.css'],
        onPills: (items) => pills.push(...items),
        onCrash: (message) => crashes.push(message)
    });
    bridge.attach({ contentWindow: clientWin }, { id: 'reaction', url: 'bm://reaction/index.html', channels: ['reaction:*', 'boom:fail'] });

    const client = new ModuleClient(clientWin);
    await client.ready;
    const themeStyle = clientWin.document.nodes.find((node) => node.id === 'bm-theme');
    assert.ok(themeStyle.textContent.includes('--bg: #000;'));
    assert.ok(themeStyle.textContent.includes('--color-scheme: dark;'));
    assert.equal(clientWin.document.documentElement.dataset.theme, 'dark');
    assert.deepEqual(clientWin.document.nodes.filter((node) => node.href).map((node) => node.href), ['bm://plug/a.css']);
    assert.ok(clientWin.document.nodes.indexOf(themeStyle) < clientWin.document.nodes.findIndex((node) => node.href), 'стиль темы должен идти раньше плагинов');
    assert.equal(client.theme.chart.grid, '#333');
    assert.equal(client.t('hello', { name: 'Мир' }), 'Привет, Мир!');
    assert.equal(client.t('n', { count: 3 }), '3 штуки');
    assert.equal(client.language, 'ru');
    assert.equal(client.locale, 'ru-RU');
    assert.equal(clientWin.document.documentElement.lang, 'ru');
    assert.deepEqual(calls[0], ['i18n:bundle', { scope: 'reaction' }]);
    assert.equal(client.clock.timezone, 'Asia/Tokyo');
    calls.length = 0;

    assert.deepEqual(await client.invoke('reaction:list', { a: 1 }), { channel: 'reaction:list' });
    await assert.rejects(client.invoke('sleep:listLogs'), (error) => error.status === 403 && /запрещён/.test(error.message));
    await assert.rejects(client.invoke('boom:fail'), (error) => error.message === 'сломалось');
    assert.deepEqual(calls.map((call) => call[0]), ['reaction:list', 'boom:fail']);
    assert.deepEqual(await client.config('themes'), { channel: 'config:get' });
    assert.deepEqual(calls.at(-1), ['config:get', { name: 'themes' }]);
    const id = await client.storage.insert('items', { a: 1 });
    assert.equal(id, 'storage:insert');
    assert.deepEqual(calls.at(-1), ['storage:insert', { collection: 'items', data: { a: 1 }, module: 'reaction' }]);
    await client.invoke('storage:list', { collection: 'items', module: 'evil' });
    assert.deepEqual(calls.at(-1), ['storage:list', { collection: 'items', module: 'reaction' }]);
    assert.equal(await client.confirm('ok?'), true);
    assert.equal(await client.confirm('no?'), false);

    client.setPills(['a', 'b']);
    client.reportCrash(new Error('упал'));
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(pills, ['a', 'b']);
    assert.deepEqual(crashes, ['упал']);

    let themeEvents = 0;
    client.onTheme(() => (themeEvents += 1));
    themeListeners.forEach((listener) => listener(theme.current()));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(themeEvents, 1);

    const foreign = { contentWindow: {} };
    const before = calls.length;
    bridge.handle({ data: { bm: 'biomashine-bridge', type: 'invoke', id: 99, channel: 'reaction:list' }, source: foreign.contentWindow, origin: 'bm://reaction' });
    bridge.handle({ data: { bm: 'biomashine-bridge', type: 'invoke', id: 100, channel: 'reaction:list' }, source: clientWin, origin: 'bm://evil' });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls.length, before);

    bridge.detach();
    delete globalThis.window;
});

test('уведомления: SDK и мост — инъекция module, права, 403', async () => {
    const { ModuleBridge } = await load('shell', 'ModuleBridge.js');
    const { ModuleClient } = await load('sdk', 'ModuleClient.js');
    const { Translator } = await load('sdk', 'Translator.js');
    const deliver = (target, event) => setImmediate(() => target.handlers.message.forEach((handler) => handler(event)));

    const shellWin = { handlers: { message: [] }, addEventListener: (type, fn) => shellWin.handlers[type].push(fn), removeEventListener: () => {} };
    const makeWin = () => {
        const win = {
            handlers: { message: [], error: [], unhandledrejection: [] },
            location: { ancestorOrigins: ['bm://app'] },
            parent: shellWin,
            addEventListener: (type, fn) => win.handlers[type].push(fn),
            postMessage: (message) => deliver(win, { data: message, source: shellWin }),
            document: {
                nodes: [],
                documentElement: { dataset: {} },
                head: { append: (node) => win.document.nodes.push(node) },
                getElementById: (id) => win.document.nodes.find((node) => node.id === id) || null,
                createElement: () => ({})
            }
        };
        return win;
    };
    const makeTheme = () => ({
        listeners: new Set(),
        onChange() {},
        current: () => ({ name: 'dark', colorScheme: 'dark', variables: { '--bg': '#000' }, chart: { text: '#aaa', grid: '#333' } })
    });
    const makeI18n = () => new Translator({ language: 'ru', locale: 'ru-RU', strings: { 'bridge.denied': 'Модулю запрещён канал: {channel}' } });

    globalThis.window = shellWin;

    const calls = [];
    const api = {
        invoke: async (channel, payload) => {
            if (channel === 'settings:get') {
                return { timezone: 'UTC' };
            }
            if (channel === 'i18n:bundle') {
                return { language: 'ru', locale: 'ru-RU', strings: { 'bridge.denied': 'Модулю запрещён канал: {channel}' } };
            }
            calls.push([channel, payload]);
            if (channel === 'notifications:schedule') {
                return { id: 42 };
            }
            if (channel === 'notifications:list') {
                return [{ id: 1 }];
            }
            return null;
        }
    };

    const clientWin = makeWin();
    shellWin.postMessage = (message) => deliver(shellWin, { data: message, source: clientWin, origin: 'bm://notifier' });
    const bridge = new ModuleBridge({ api, theme: makeTheme(), dialogs: { confirm: async () => true }, i18n: makeI18n(), pluginCss: [], onPills: () => {}, onCrash: () => {} });
    bridge.attach({ contentWindow: clientWin }, { id: 'notifier', url: 'bm://notifier/index.html', channels: [], permissions: ['notifications'] });
    const client = new ModuleClient(clientWin);
    await client.ready;
    calls.length = 0;

    const scheduled = await client.notify.schedule({ title: 'x', at: '2026-01-01 10:00:00' });
    assert.deepEqual(scheduled, { id: 42 });
    assert.deepEqual(calls.at(-1), ['notifications:schedule', { title: 'x', at: '2026-01-01 10:00:00', module: 'notifier' }]);

    await client.notify.list();
    assert.deepEqual(calls.at(-1), ['notifications:list', { module: 'notifier' }]);

    await client.notify.cancel(7);
    assert.deepEqual(calls.at(-1), ['notifications:cancel', { id: 7, module: 'notifier' }]);

    await client.invoke('notifications:setEnabled', { module: 'evil', enabled: true });
    assert.deepEqual(calls.at(-1), ['notifications:setEnabled', { module: 'notifier', enabled: true }]);

    bridge.detach();

    const clientWin2 = makeWin();
    shellWin.postMessage = (message) => deliver(shellWin, { data: message, source: clientWin2, origin: 'bm://plain' });
    const bridge2 = new ModuleBridge({ api, theme: makeTheme(), dialogs: { confirm: async () => true }, i18n: makeI18n(), pluginCss: [], onPills: () => {}, onCrash: () => {} });
    bridge2.attach({ contentWindow: clientWin2 }, { id: 'plain', url: 'bm://plain/index.html', channels: [], permissions: [] });
    const client2 = new ModuleClient(clientWin2);
    await client2.ready;
    calls.length = 0;

    await assert.rejects(client2.notify.schedule({ title: 'x', at: '2026-01-01 10:00:00' }), (error) => error.status === 403 && /запрещён/.test(error.message));
    await assert.rejects(client2.invoke('notifications:list'), (error) => error.status === 403);
    assert.equal(calls.length, 0);

    bridge2.detach();
    delete globalThis.window;
});
