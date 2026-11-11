const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const PortablePaths = require('../src/main/PortablePaths');
const ShortcutService = require('../src/main/ShortcutService');

const root = path.join(__dirname, '..');
const appConfig = JSON.parse(fs.readFileSync(path.join(root, 'config', 'app.json'), 'utf8'));
const load = (...parts) => import(pathToFileURL(path.join(root, 'src', 'renderer', 'shell', ...parts)).href);

test('портативные пути: данные рядом с программой, иначе стандартная папка', () => {
    const paths = new PortablePaths(appConfig);
    assert.equal(paths.resolve({ PORTABLE_EXECUTABLE_DIR: path.join('D', 'tools') }), path.join('D', 'tools', 'BIOMASHINE-data'));
    assert.equal(paths.resolve({ APPIMAGE: path.join('home', 'me', 'Apps', 'BIOMASHINE.AppImage') }), path.join('home', 'me', 'Apps', 'BIOMASHINE-data'));
    assert.equal(
        paths.resolve({ PORTABLE_EXECUTABLE_DIR: path.join('D', 'a'), APPIMAGE: path.join('x', 'y.AppImage') }),
        path.join('D', 'a', 'BIOMASHINE-data')
    );
    assert.equal(paths.resolve({}), null);
    assert.equal(paths.resolve({ PORTABLE_EXECUTABLE_DIR: '' }), null);
});

test('сборка портативная и не содержит установщика', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    assert.deepEqual(pkg.build.win.target, ['portable', 'zip']);
    assert.ok(fs.existsSync(path.join(root, pkg.build.portable.splashImage)), 'нет картинки заставки при распаковке');
    assert.equal(pkg.build.compression, 'store');
    assert.ok(fs.existsSync(path.join(root, pkg.build.win.icon)), 'нет иконки приложения');
    assert.equal(pkg.build.win.icon, appConfig.window.icon);
    assert.ok(!JSON.stringify(pkg.build).includes('nsis'));
});

test('горячие клавиши: F11, Ctrl+P и Ctrl+H по физической клавише, без перехвата обычного ввода', () => {
    const calls = [];
    const settings = { get: () => undefined, set: () => {} };
    const service = new ShortcutService({
        defaults: appConfig.shortcuts,
        settings,
        actions: {
            fullscreen: () => calls.push('fullscreen'),
            quickSwitch: () => calls.push('quickSwitch'),
            moduleHub: () => calls.push('moduleHub')
        }
    });
    const press = (code, extra = {}) => ({ type: 'keyDown', code, key: 'x', control: false, meta: false, alt: false, shift: false, ...extra });
    assert.equal(service.match(press('F11')), 'fullscreen');
    assert.equal(service.match(press('KeyP', { control: true })), 'quickSwitch');
    assert.equal(service.match(press('KeyP', { control: true, key: 'з' })), 'quickSwitch');
    assert.equal(service.match(press('KeyP', { control: true, key: 'p' })), 'quickSwitch');
    assert.equal(service.match(press('KeyP', { meta: true })), 'quickSwitch');
    assert.equal(service.match(press('KeyH', { control: true })), 'moduleHub');
    assert.equal(service.match(press('KeyH', { meta: true })), 'moduleHub');
    assert.equal(service.match(press('KeyP')), null);
    assert.equal(service.match(press('KeyP', { control: true, shift: true })), null);
    assert.equal(service.match(press('KeyP', { control: true, alt: true })), null);
    assert.equal(service.match(press('F11', { control: true })), null);
    assert.equal(service.match({ ...press('F11'), type: 'keyUp' }), null);
    assert.equal(service.match(press('KeyA', { control: true })), null);
    assert.equal(service.match(press('KeyZ', { control: true, key: 'p' })), null);

    let handler;
    service.attach({ on: (name, fn) => (handler = fn) });
    let prevented = 0;
    handler({ preventDefault: () => (prevented += 1) }, press('F11'));
    handler({ preventDefault: () => (prevented += 1) }, press('KeyP', { control: true, key: 'з' }));
    handler({ preventDefault: () => (prevented += 1) }, press('KeyX'));
    assert.deepEqual(calls, ['fullscreen', 'quickSwitch']);
    assert.equal(prevented, 2);
});

test('TextSearch: ранжирование, ё, нечёткий поиск, пустой запрос', async () => {
    const { TextSearch } = await load('TextSearch.js');
    const items = [
        { title: 'Тренировки', description: 'зал и дом' },
        { title: 'Настройки', description: 'тема' },
        { title: 'Сон', description: 'график сна' },
        { title: 'Ёлка', description: '' }
    ];
    const fields = (item) => [item.title, item.description];
    assert.deepEqual(TextSearch.filter(items, '', fields).map((item) => item.title), ['Тренировки', 'Настройки', 'Сон', 'Ёлка']);
    assert.deepEqual(TextSearch.filter(items, 'сон', fields).map((item) => item.title), ['Сон']);
    assert.deepEqual(TextSearch.filter(items, 'сна', fields).map((item) => item.title), ['Сон']);
    assert.deepEqual(TextSearch.filter(items, 'елка', fields).map((item) => item.title), ['Ёлка']);
    assert.deepEqual(TextSearch.filter(items, 'трн', fields).map((item) => item.title), ['Тренировки']);
    assert.deepEqual(TextSearch.filter(items, 'тема', fields).map((item) => item.title), ['Настройки']);
    assert.deepEqual(TextSearch.filter(items, 'xyz', fields), []);
    const ranked = TextSearch.filter([{ title: 'Мало сонливости' }, { title: 'Сон' }, { title: 'Сонник' }], 'сон', (item) => [item.title]);
    assert.deepEqual(ranked.map((item) => item.title), ['Сон', 'Сонник', 'Мало сонливости']);
});

test('поиск часового пояса: по названию, части названия и смещению', async () => {
    const { TextSearch } = await load('TextSearch.js');
    const zones = [
        { id: 'Asia/Kolkata', offset: 'UTC+5:30' },
        { id: 'Europe/Kyiv', offset: 'UTC+2' },
        { id: 'America/New_York', offset: 'UTC-5' },
        { id: 'America/Los_Angeles', offset: 'UTC-8' },
        { id: 'Asia/Kathmandu', offset: 'UTC+5:45' }
    ];
    const fields = (zone) => [zone.id, zone.id.replace(/[_/]/g, ' '), zone.offset];
    const ids = (query) => TextSearch.filter(zones, query, fields).map((zone) => zone.id);
    assert.deepEqual(ids('kolk'), ['Asia/Kolkata']);
    assert.deepEqual(ids('new york'), ['America/New_York']);
    assert.deepEqual(ids('los'), ['America/Los_Angeles']);
    assert.ok(ids('+5:30').includes('Asia/Kolkata'));
    assert.ok(ids('asia').includes('Asia/Kathmandu'));
    assert.equal(ids('').length, 5);
    assert.deepEqual(ids('zzzz'), []);
});

test('палитра: команды модулей, настройки, поиск и переход', async () => {
    const { ModuleCommands } = await load('ModuleCommands.js');
    const { CommandPalette } = await load('CommandPalette.js');
    const { Translator } = await import(pathToFileURL(path.join(root, 'src', 'renderer', 'sdk', 'Translator.js')).href);
    const i18n = new Translator({ language: 'ru', locale: 'ru-RU', strings: JSON.parse(fs.readFileSync(path.join(root, 'src', 'renderer', 'shell', 'locales', 'ru.json'), 'utf8')) });
    const visited = [];
    const pages = [
        { id: 'sleep', title: 'Сон', description: 'график сна', source: 'system' },
        { id: 'cigarettes', title: 'Сигареты', description: 'счётчик', source: 'user' }
    ];
    const commands = new ModuleCommands(() => pages, (route) => visited.push(route), i18n);
    const palette = new CommandPalette({ root: null, i18n, providers: [() => commands.provide()] });
    assert.deepEqual(palette.search('').map((command) => command.title), ['Сон', 'Сигареты', 'Все модули', 'Настройки']);
    assert.equal(palette.search('сиг')[0].hint, 'пользовательский модуль');
    assert.deepEqual(palette.search('настр').map((command) => command.title), ['Настройки']);
    assert.deepEqual(palette.search('cigarettes').map((command) => command.title), ['Сигареты']);
    assert.deepEqual(palette.search('каталог').map((command) => command.title), ['Все модули']);
    palette.search('сон')[0].run();
    palette.search('настр')[0].run();
    palette.search('каталог')[0].run();
    assert.deepEqual(visited, ['module/sleep', 'settings', 'hub']);
    const extra = new CommandPalette({ root: null, i18n, providers: [() => commands.provide(), () => [{ id: 'x', title: 'Новая команда', hint: '', keywords: [], run() {} }]] });
    assert.equal(extra.search('новая').length, 1);
});

test('ModuleHub: фильтрация по поиску и категории', async () => {
    const { ModuleHub } = await load('ModuleHub.js');
    const modules = [
        { id: 'sleep', title: 'Сон', description: 'график сна', category: 'body', kind: 'page', source: 'system', pinned: true },
        { id: 'run', title: 'Бег', description: 'тренировки', category: 'body', kind: 'page', source: 'system', pinned: true },
        { id: 'reaction', title: 'Реакция', description: 'тест', category: 'mind', kind: 'page', source: 'system', pinned: true },
        { id: 'budget', title: 'Бюджет', description: 'деньги', category: 'finance', kind: 'page', source: 'user', pinned: false }
    ];
    const categories = [
        { id: 'body', titleKey: 'category.body', builtin: true },
        { id: 'mind', titleKey: 'category.mind', builtin: true },
        { id: 'finance', titleKey: 'category.finance', builtin: true }
    ];
    assert.deepEqual(
        ModuleHub.filterModules(modules, categories, {}).map((m) => m.id),
        ['sleep', 'run', 'reaction', 'budget']
    );
    assert.deepEqual(
        ModuleHub.filterModules(modules, categories, { query: 'сон' }).map((m) => m.id),
        ['sleep']
    );
    assert.deepEqual(
        ModuleHub.filterModules(modules, categories, { category: 'body' }).map((m) => m.id),
        ['sleep', 'run']
    );
    assert.deepEqual(
        ModuleHub.filterModules(modules, categories, { category: 'finance' }).map((m) => m.id),
        ['budget']
    );
    assert.deepEqual(
        ModuleHub.filterModules(modules, categories, { query: 'сон', category: 'mind' }),
        []
    );
    assert.deepEqual(
        ModuleHub.filterModules(modules, categories, { query: 'деньги' }).map((m) => m.id),
        ['budget']
    );
    assert.deepEqual(ModuleHub.filterModules([], categories, {}), []);
});

test('ModuleHub: группировка по категориям', async () => {
    const { ModuleHub } = await load('ModuleHub.js');
    const modules = [
        { id: 'sleep', title: 'Сон', category: 'body', kind: 'page' },
        { id: 'run', title: 'Бег', category: 'body', kind: 'page' },
        { id: 'reaction', title: 'Реакция', category: 'mind', kind: 'page' },
        { id: 'budget', title: 'Бюджет', category: 'finance', kind: 'page' }
    ];
    const categories = [
        { id: 'body', titleKey: 'category.body', builtin: true },
        { id: 'mind', titleKey: 'category.mind', builtin: true },
        { id: 'finance', titleKey: 'category.finance', builtin: true },
        { id: 'environment', titleKey: 'category.environment', builtin: true }
    ];
    const groups = ModuleHub.group(modules, categories);
    assert.deepEqual(groups.map((g) => g.category.id), ['body', 'mind', 'finance']);
    assert.deepEqual(groups[0].modules.map((m) => m.id), ['sleep', 'run']);
    assert.deepEqual(groups[1].modules.map((m) => m.id), ['reaction']);
    assert.deepEqual(groups[2].modules.map((m) => m.id), ['budget']);
    const empty = ModuleHub.group([], categories);
    assert.deepEqual(empty, []);
    const onlyUnknown = ModuleHub.group([{ id: 'x', title: 'X', category: 'missing' }], categories);
    assert.equal(onlyUnknown.length, 1);
    assert.equal(onlyUnknown[0].category.id, 'other');
});

test('логотип BIOMASHINE', () => {
    const html = fs.readFileSync(path.join(root, 'src', 'renderer', 'shell', 'index.html'), 'utf8');
    assert.match(html, /<div class="logo">BIOMASHINE<\/div>/);
    assert.ok(!/Tepher|биомусор/i.test(html));
});

function collectCommonJs(entries) {
    const visited = new Set();
    const queue = [...entries];
    while (queue.length > 0) {
        const file = queue.shift();
        if (visited.has(file) || !fs.existsSync(file)) {
            continue;
        }
        visited.add(file);
        const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
        for (const match of text.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)) {
            const spec = match[1];
            if (!spec.startsWith('.')) {
                continue;
            }
            const base = path.resolve(path.dirname(file), spec);
            const candidates = [base, `${base}.js`, `${base}.json`, path.join(base, 'index.js')];
            for (const candidate of candidates) {
                if (fs.existsSync(candidate) && candidate.endsWith('.js')) {
                    queue.push(candidate);
                    break;
                }
            }
        }
    }
    return visited;
}

test('в главном процессе нет русских строк вне словарей', () => {
    const entries = [
        path.join(root, 'src', 'main', 'main.js'),
        path.join(root, 'src', 'main', 'Application.js'),
        path.join(root, 'src', 'main', 'Container.js')
    ].filter((file) => fs.existsSync(file));
    const reachable = collectCommonJs(entries);
    const localesDir = path.join(root, 'src', 'main', 'locales');
    const offenders = [];
    for (const file of reachable) {
        if (file === localesDir || file.startsWith(localesDir + path.sep)) {
            continue;
        }
        if (/[А-Яа-яЁё]/.test(fs.readFileSync(file, 'utf8'))) {
            offenders.push(path.relative(root, file));
        }
    }
    assert.deepEqual(offenders, [], `Найдены русские строки в файлах: ${offenders.join(', ')}`);
});