const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { createApp } = require('./helpers');
const { createFakeBm } = require('./support/FakeBm');
const { FakeDocument, FakeChart } = require('./support/FakeDom');

const root = path.join(__dirname, '..');
const docs = path.join(root, 'docs', 'en', 'ai');
const examples = path.join(docs, 'examples');
const read = (...parts) => fs.readFileSync(path.join(...parts), 'utf8');
const guide = (name) => read(docs, name);
const load = (file) => import(pathToFileURL(file).href);

function listFiles(dir, base = dir, found = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            listFiles(full, base, found);
        } else {
            found.push(path.relative(base, full).split(path.sep).join('/'));
        }
    }
    return found;
}

function installExample(name) {
    const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-example-'));
    fs.cpSync(path.join(examples, name), path.join(userDir, name), { recursive: true });
    return userDir;
}

test('классы UI-кита в гайдах совпадают с components.css', () => {
    const css = read(root, 'src', 'renderer', 'shared', 'components.css');
    const cssClasses = new Set([...css.matchAll(/\.(bm-[a-z-]+)/g)].map((match) => match[1]));
    const moduleGuide = guide('MODULE_GUIDE.md');
    const documented = new Set([...moduleGuide.matchAll(/^\| `(bm-[a-z-]+)` \|/gm)].map((match) => match[1]));
    assert.deepEqual([...documented].sort(), [...cssClasses].sort());
    const pluginGuide = guide('PLUGIN_GUIDE.md');
    for (const name of cssClasses) {
        assert.ok(pluginGuide.includes(`.${name}`), `в PLUGIN_GUIDE.md нет .${name}`);
    }
});

test('переменные темы в гайдах совпадают с config/themes.json', () => {
    const themes = JSON.parse(read(root, 'config', 'themes.json')).themes;
    const moduleGuide = guide('MODULE_GUIDE.md');
    const pluginGuide = guide('PLUGIN_GUIDE.md');
    for (const theme of Object.values(themes)) {
        for (const variable of Object.keys(theme.variables)) {
            assert.ok(moduleGuide.includes(`| \`${variable}\` |`), `в MODULE_GUIDE.md нет ${variable}`);
            assert.ok(pluginGuide.includes(`| \`${variable}\` |`), `в PLUGIN_GUIDE.md нет ${variable}`);
        }
    }
});

test('примеры целиком присутствуют в гайдах без расхождений', () => {
    const moduleGuide = guide('MODULE_GUIDE.md');
    for (const file of listFiles(path.join(examples, 'cigarettes'))) {
        assert.ok(moduleGuide.includes(read(examples, 'cigarettes', file).trimEnd()), `в MODULE_GUIDE.md устарел ${file}`);
    }
    const pluginGuide = guide('PLUGIN_GUIDE.md');
    for (const file of listFiles(path.join(examples, 'rounded'))) {
        assert.ok(pluginGuide.includes(read(examples, 'rounded', file).trimEnd()), `в PLUGIN_GUIDE.md устарел ${file}`);
    }
});

test('гайды не попадают в сборку', () => {
    const pkg = JSON.parse(read(root, 'package.json'));
    assert.ok(!pkg.build.files.some((pattern) => /docs/.test(pattern)));
    assert.ok(fs.existsSync(path.join(docs, 'MODULE_GUIDE.md')));
});

test('пример модуля устанавливается как пользовательский и ссылки в нём рабочие', async () => {
    const userDir = installExample('cigarettes');
    const { call, container } = createApp({ userModulesDir: userDir });
    assert.deepEqual(await call('modules:errors'), []);
    const entry = (await call('modules:list')).find((module) => module.id === 'cigarettes');
    assert.equal(entry.source, 'user');
    assert.deepEqual(entry.channels, []);
    const moduleDir = path.join(userDir, 'cigarettes');
    const html = read(moduleDir, 'index.html');
    const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
    for (const file of listFiles(path.join(moduleDir, 'js'))) {
        const code = read(moduleDir, 'js', file);
        for (const match of code.matchAll(/getElementById\('([^']+)'\)/g)) {
            assert.ok(ids.has(match[1]), `${file}: нет элемента #${match[1]} в index.html`);
        }
        for (const match of code.matchAll(/from '([^']+)'/g)) {
            const target = match[1].startsWith('bm://')
                ? container.assets.resolve(match[1])
                : path.resolve(moduleDir, 'js', match[1]);
            assert.ok(target && fs.existsSync(target), `${file}: нет файла для ${match[1]}`);
        }
        assert.ok(!/\bfetch\(|localStorage|sessionStorage|XMLHttpRequest|https?:\/\//.test(code), `${file}: запрещённые API`);
        assert.ok(!/(?<!bm\.)\b(alert|confirm|prompt)\(/.test(code), `${file}: нативные диалоги`);
    }
    for (const [, href] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
        if (href.startsWith('bm://app/vendor/')) {
            continue;
        }
        const target = href.startsWith('bm://') ? container.assets.resolve(href) : path.resolve(moduleDir, href);
        assert.ok(target && fs.existsSync(target), `index.html: нет файла для ${href}`);
    }
    container.close();
});

test('пример плагина проходит проверку реестра', async () => {
    const userDir = installExample('rounded');
    const { call, container } = createApp({ userModulesDir: userDir });
    assert.deepEqual(await call('modules:errors'), []);
    const plugin = (await call('modules:list')).find((module) => module.id === 'rounded');
    assert.equal(plugin.kind, 'plugin');
    assert.deepEqual(plugin.cssUrls, ['bm://rounded/style.css']);
    assert.ok(fs.existsSync(container.assets.resolve(plugin.cssUrls[0])));
    container.close();
});

test('пример «Сигареты» работает целиком против настоящего хранилища', async () => {
    const userDir = installExample('cigarettes');
    const { call, container } = createApp({ userModulesDir: userDir });
    const { ModuleStorage } = await load(path.join(root, 'src', 'renderer', 'sdk', 'ModuleStorage.js'));
    const { DayCounter } = await load(path.join(examples, 'cigarettes', 'js', 'DayCounter.js'));
    const { CigaretteApp } = await load(path.join(examples, 'cigarettes', 'js', 'CigaretteApp.js'));

    const today = new Date(2026, 10, 2, 15, 0, 0);
    const entries = [
        { data: { at: '2026-11-02 09:00:00' } },
        { data: { at: '2026-11-02 14:00:00' } },
        { data: { at: '2026-11-01 23:59:00' } },
        { data: { at: '2026-10-20 12:00:00' } }
    ];
    const week = DayCounter.lastDays(entries, 7, today);
    assert.equal(week.length, 7);
    assert.deepEqual(week.slice(-2), [{ key: '2026-11-01', count: 1 }, { key: '2026-11-02', count: 2 }]);
    assert.equal(week[0].key, '2026-10-27');
    assert.equal(week.reduce((sum, day) => sum + day.count, 0), 3);

    const storage = new ModuleStorage({ invoke: (channel, payload) => call(channel, { ...payload, module: 'cigarettes' }) });
    const doc = new FakeDocument();
    globalThis.getComputedStyle = () => ({ getPropertyValue: () => ' #fff ' });
    FakeChart.instances.length = 0;
    const pills = [];
    const confirms = [];
    const bm = await createFakeBm({
        call,
        scope: 'cigarettes',
        channels: [],
        extra: { storage, setPills: (items) => pills.push(items), confirm: async (text) => (confirms.push(text), true) }
    });
    const app = new CigaretteApp(bm, doc, FakeChart);
    await app.start();
    assert.equal(doc.getElementById('goal-input').value, 10);
    assert.match(doc.getElementById('journal').text(), /Записей нет/);
    assert.deepEqual(pills.at(-1), ['0 записей']);

    await doc.getElementById('add-btn').fire('click');
    await doc.getElementById('add-btn').fire('click');
    assert.match(doc.getElementById('stats').text(), /Сегодня\s+2 \/ 10/);
    assert.match(doc.getElementById('stats').text(), /За 7 дней\s+2/);
    assert.deepEqual(pills.at(-1), ['2 записи']);
    assert.equal(doc.getElementById('journal').children.length, 2);

    await doc.getElementById('goal-input').fire('change', { target: { value: '4.6' } });
    assert.equal(doc.getElementById('goal-input').value, 5);
    await doc.getElementById('goal-input').fire('change', { target: { value: 'abc' } });
    assert.equal(doc.getElementById('goal-input').value, 0);
    assert.equal((await call('storage:list', { module: 'cigarettes', collection: 'settings' })).length, 1);

    const removeButtons = doc.getElementById('journal').find((node) => node.className === 'bm-btn secondary');
    await removeButtons[0].fire('click');
    assert.deepEqual(confirms, ['Удалить запись?']);
    assert.equal((await call('storage:list', { module: 'cigarettes', collection: 'entries' })).length, 1);

    const live = FakeChart.instances.filter((chart) => !chart.destroyed);
    assert.equal(live.length, 1);
    assert.equal(live[0].config.data.datasets[0].backgroundColor, '#fff');
    assert.equal(live[0].config.data.labels.length, 7);
    assert.equal(live[0].config.data.datasets[0].data.at(-1), 1);
    delete globalThis.getComputedStyle;
    container.close();
});
