const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp, rejects } = require('./helpers');
const AppError = require('../src/main/core/AppError');
const MessageTranslator = require('../src/main/core/MessageTranslator');
const MessageService = require('../src/main/services/MessageService');

const real = path.join(__dirname, '..', 'src', 'renderer');

function write(file, data) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data));
}

function workspace(extra = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-i18n-'));
    const renderer = path.join(root, 'renderer');
    const locales = path.join(root, 'locales');
    const userModules = path.join(root, 'user-modules');
    fs.mkdirSync(locales);
    fs.mkdirSync(userModules);
    write(path.join(renderer, 'modules', 'demo', 'manifest.json'), { id: 'demo', kind: 'page', title: 'Демо' });
    write(path.join(renderer, 'shell', 'locales', 'ru.json'), { 'nav.settings': 'Настройки', 'only.ru': 'Только по-русски' });
    write(path.join(renderer, 'shell', 'locales', 'en.json'), { 'nav.settings': 'Settings' });
    write(path.join(renderer, 'shared', 'locales', 'ru.json'), { 'common.save': 'Сохранить', 'common.cancel': 'Отмена' });
    write(path.join(renderer, 'shared', 'locales', 'en.json'), { 'common.save': 'Save', 'common.cancel': 'Cancel' });
    write(path.join(renderer, 'modules', 'demo', 'locales', 'ru.json'), {
        title: 'Демо',
        count: { one: '{count} запись', few: '{count} записи', many: '{count} записей', other: '{count} записи' },
        'common.save': 'Сохранить демо'
    });
    write(path.join(renderer, 'modules', 'demo', 'locales', 'en.json'), { title: 'Demo', count: { one: '{count} entry', other: '{count} entries' } });
    for (const [name, data] of Object.entries(extra)) {
        write(path.join(locales, name), data);
    }
    return { renderer, locales, userModules };
}

test('конфиг i18n: поле required перечисляет обязательные языки из builtin, reference присутствует', () => {
    const app = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'app.json'), 'utf8'));
    assert.ok(Array.isArray(app.i18n.required), 'i18n.required должен быть массивом');
    assert.ok(app.i18n.required.length >= 1);
    const codes = new Set(app.i18n.builtin.map((entry) => entry.code));
    for (const code of app.i18n.required) {
        assert.ok(codes.has(code), `i18n.required содержит ${code}, которого нет в i18n.builtin`);
    }
    assert.ok(typeof app.i18n.reference === 'string', 'i18n.reference должен быть строкой');
    assert.ok(codes.has(app.i18n.reference), 'i18n.reference должен быть из i18n.builtin');
    for (const entry of app.i18n.builtin) {
        assert.ok(typeof entry.locale === 'string' && entry.locale.length > 0, `i18n.builtin[${entry.code}].locale обязателен`);
    }
});

test('язык определяется по системе, сохраняется навсегда и при отсутствии совпадения берётся английский', async () => {
    const check = async (systemLocale, expected, userFiles = {}) => {
        const dir = workspace(userFiles);
        const { call, container } = createApp({ rendererRoot: dir.renderer, userLocalesDir: dir.locales, systemLocale });
        assert.equal((await call('settings:get')).language, expected, systemLocale);
        container.close();
    };
    await check('ru-RU', 'ru');
    await check('ru', 'ru');
    await check('en-GB', 'en');
    await check('de-DE', 'en');
    await check('', 'en');
    await check(null, 'en');
    await check('de-DE', 'de', { 'de.json': { meta: { code: 'de', name: 'Deutsch' }, scopes: {} } });
    await check('pt-BR', 'pt-BR', { 'pt-br.json': { meta: { code: 'pt-BR', name: 'Português (Brasil)' }, scopes: {} } });
});

test('язык сохраняется в настройках и больше не переопределяется системой', async () => {
    const dir = workspace();
    const { call, container } = createApp({ rendererRoot: dir.renderer, userLocalesDir: dir.locales, systemLocale: 'ru-RU' });
    assert.equal((await call('settings:get')).language, 'ru');
    await call('settings:set', { key: 'language', value: 'en' });
    assert.equal((await call('settings:get')).language, 'en');
    assert.equal(container.settingsService.ensureLanguage('ru-RU'), 'en');
    await rejects(call('settings:set', { key: 'language', value: 'xx' }), 400);
    await rejects(call('settings:set', { key: 'language', value: 5 }), 400);
    container.close();
});

test('список языков: встроенные, пользовательские, ошибки файлов', async () => {
    const dir = workspace({
        'de.json': { meta: { code: 'de', name: 'Deutsch', locale: 'de-DE' }, scopes: {} },
        'broken.json': '{oops',
        'nometa.json': { scopes: {} },
        'badcode.json': { meta: { code: 'Deutsch!', name: 'X' } },
        'dup.json': { meta: { code: 'de', name: 'Doppelt' } },
        'patch-en.json': { meta: { code: 'en', name: 'English' }, scopes: { shell: { 'nav.settings': 'Preferences' } } }
    });
    const { call, container } = createApp({ rendererRoot: dir.renderer, userLocalesDir: dir.locales });
    const languages = await call('i18n:languages');
    assert.deepEqual(languages.map((language) => [language.code, language.builtin]), [['ru', true], ['en', true], ['de', false]]);
    assert.equal(languages[2].locale, 'de-DE');
    const messages = (await call('i18n:errors')).map((error) => `${error.file}: ${error.message}`).join('\n');
    assert.match(messages, /broken\.json: некорректный JSON/);
    assert.match(messages, /nometa\.json: meta\.code/);
    assert.match(messages, /badcode\.json: meta\.code/);
    assert.match(messages, /dup\.json: язык «de» уже описан/);
    container.close();
});

test('пакет строк: общий словарь + словарь модуля, цепочка запасных языков, правки встроенного языка', async () => {
    const dir = workspace({
        'de.json': {
            meta: { code: 'de', name: 'Deutsch', fallback: 'en' },
            scopes: { shell: { 'nav.settings': 'Einstellungen' }, shared: { 'common.save': 'Speichern' }, demo: { title: 'Demo (de)' } }
        },
        'patch-en.json': { meta: { code: 'en', name: 'English' }, scopes: { shell: { 'nav.settings': 'Preferences' } } }
    });
    const { call, container } = createApp({ rendererRoot: dir.renderer, userLocalesDir: dir.locales, systemLocale: 'ru-RU' });
    const ru = await call('i18n:bundle', { scope: 'demo' });
    assert.equal(ru.language, 'ru');
    assert.equal(ru.locale, 'ru-RU');
    assert.equal(ru.strings.title, 'Демо');
    assert.equal(ru.strings['common.cancel'], 'Отмена');
    assert.equal(ru.strings['common.save'], 'Сохранить демо');
    assert.equal(ru.strings.count.few, '{count} записи');

    await call('settings:set', { key: 'language', value: 'en' });
    const en = await call('i18n:bundle', { scope: 'demo' });
    assert.equal(en.strings.title, 'Demo');
    assert.equal(en.strings.count.other, '{count} entries');
    assert.equal(en.strings['common.save'], 'Save demo'.replace('Save demo', 'Save'));
    const shellEn = await call('i18n:bundle', { scope: 'shell' });
    assert.equal(shellEn.strings['nav.settings'], 'Preferences');
    assert.equal(shellEn.strings['only.ru'], 'Только по-русски');

    await call('settings:set', { key: 'language', value: 'de' });
    const shellDe = await call('i18n:bundle', { scope: 'shell' });
    assert.equal(shellDe.strings['nav.settings'], 'Einstellungen');
    assert.equal(shellDe.strings['only.ru'], 'Только по-русски');
    const demoDe = await call('i18n:bundle', { scope: 'demo' });
    assert.equal(demoDe.strings.title, 'Demo (de)');
    assert.equal(demoDe.strings['common.save'], 'Speichern');
    assert.equal(demoDe.strings['common.cancel'], 'Cancel');

    await rejects(call('i18n:bundle', { scope: 'ghost' }), 400);
    await rejects(call('i18n:bundle', {}), 400);
    container.close();
});

test('некорректные значения словарей отбрасываются с понятной причиной', async () => {
    const dir = workspace({
        'de.json': {
            meta: { code: 'de', name: 'Deutsch' },
            scopes: {
                shell: {
                    'nav.settings': 'Einstellungen',
                    broken: 5,
                    list: ['a'],
                    nootherform: { one: 'x' },
                    wrongform: { other: 'x', many2: 'y' },
                    good: { one: 'ein', other: 'viele' }
                }
            }
        }
    });
    const { call, container } = createApp({ rendererRoot: dir.renderer, userLocalesDir: dir.locales });
    const messages = (await call('i18n:errors')).map((error) => error.message).join('\n');
    assert.match(messages, /ключ «broken»/);
    await call('settings:set', { key: 'language', value: 'de' });
    const strings = (await call('i18n:bundle', { scope: 'shell' })).strings;
    assert.equal(strings['nav.settings'], 'Einstellungen');
    assert.deepEqual(strings.good, { one: 'ein', other: 'viele' });
    for (const key of ['broken', 'list', 'nootherform', 'wrongform']) {
        assert.ok(!(key in strings), key);
    }
    container.close();
});

test('шаблон для перевода содержит все области и ключи, экспорт и папка языков', async () => {
    const dir = workspace();
    const { call, container, system } = createApp({ rendererRoot: dir.renderer, userLocalesDir: dir.locales, systemLocale: 'ru-RU' });
    const master = await call('i18n:master', { code: 'en' });
    assert.deepEqual(Object.keys(master.scopes).sort(), ['backend', 'demo', 'shared', 'shell']);
    assert.equal(master.meta.basedOn, 'en');
    assert.equal(master.meta.fallback, 'en');
    assert.equal(master.scopes.shell['nav.settings'], 'Settings');
    assert.equal(master.scopes.shell['only.ru'], 'Только по-русски');
    assert.equal(master.scopes.demo.count.one, '{count} entry');
    await call('i18n:export', { code: 'ru' });
    assert.equal(system.saved[0].name, 'biomashine-language-template-ru.json');
    assert.equal(JSON.parse(system.saved[0].content).meta.basedOn, 'ru');
    assert.equal((await call('i18n:openFolder')).opened, true);
    assert.equal(system.opened, dir.locales);
    container.close();
});

test('пользовательский модуль приносит свои словари, перевод доступен до входа', async () => {
    const dir = workspace();
    write(path.join(dir.userModules, 'mine', 'manifest.json'), { id: 'mine', kind: 'page', title: 'Мой' });
    write(path.join(dir.userModules, 'mine', 'locales', 'ru.json'), { hello: 'Привет' });
    write(path.join(dir.userModules, 'mine', 'locales', 'en.json'), { hello: 'Hello' });
    const { call, container } = createApp({ rendererRoot: dir.renderer, userLocalesDir: dir.locales, userModulesDir: dir.userModules });
    assert.equal((await call('i18n:bundle', { scope: 'mine' })).strings.hello, 'Привет');
    await call('auth:setup', { login: 'a', password: 'abcd' });
    await call('auth:lock');
    assert.equal((await call('i18n:bundle', { scope: 'shell' })).strings['nav.settings'], 'Настройки');
    assert.ok((await call('i18n:languages')).length >= 2);
    await rejects(call('i18n:master'), 401);
    await rejects(call('i18n:export'), 401);
    container.close();
});

test('окно и перезапуск: каналы доступны до входа и вызывают систему', async () => {
    const { call, container, system } = createApp();
    await call('auth:setup', { login: 'a', password: 'abcd' });
    await call('auth:lock');
    assert.deepEqual(await call('window:state'), { fullscreen: false });
    assert.deepEqual(await call('window:toggleFullscreen'), { fullscreen: true });
    assert.deepEqual(await call('window:state'), { fullscreen: true });
    await call('window:close');
    assert.equal(system.closed, true);
    await rejects(call('settings:relaunch'), 401);
    await call('auth:login', { login: 'a', password: 'abcd' });
    await call('settings:relaunch');
    assert.equal(system.relaunched, true);
    container.close();
});

test('блок авторства: адреса зашиты в коде, открываются только из белого списка', async () => {
    const { call, container, system } = createApp();
    const info = await call('about:info');
    assert.equal(info.author, 'ChetsCMD');
    assert.deepEqual(info.links, ['authorGithub', 'projectGithub', 'support']);
    await call('about:open', { link: 'authorGithub' });
    await call('about:open', { link: 'projectGithub' });
    await call('about:open', { link: 'support' });
    assert.deepEqual(system.externalOpened, ['https://github.com/chetsCMD', 'https://github.com/chetsCMD/BIOMASHINE', 'https://boosty.to/chetscmd']);
    await rejects(call('about:open', { link: 'https://evil.example' }), 400);
    await rejects(call('about:open', { link: '__proto__' }), 400);
    await rejects(call('about:open', {}), 400);
    assert.equal(system.externalOpened.length, 3);
    await call('auth:setup', { login: 'a', password: 'abcd' });
    await call('auth:lock');
    await rejects(call('about:info'), 401);
    const appConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'app.json'), 'utf8'));
    assert.ok(!JSON.stringify(appConfig).includes('boosty'));
    container.close();
});

test('часовой пояс: форматирование по зонам, переход через полночь и DST, проверка значений', async () => {
    const ClockService = require('../src/main/services/ClockService');
    const SettingsRepository = require('../src/main/repositories/SettingsRepository');
    const Database = require('../src/main/core/Database');
    const database = new Database(':memory:').open();
    database.connection.exec('CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    const settings = new SettingsRepository(database);
    let instant = new Date('2026-03-01T22:30:00Z');
    const clock = new ClockService(settings, () => instant, { 'Asia/Calcutta': 'Asia/Kolkata' });
    const at = (zone) => {
        settings.set('timezone', zone);
        clock.reload();
        return clock.timestamp();
    };
    assert.equal(at('UTC'), '2026-03-01 22:30:00');
    assert.equal(at('Asia/Tokyo'), '2026-03-02 07:30:00');
    assert.equal(at('America/Los_Angeles'), '2026-03-01 14:30:00');
    assert.equal(at('Asia/Kolkata'), '2026-03-02 04:00:00');
    assert.equal(clock.today(), '2026-03-02');
    settings.set('timezone', 'America/Los_Angeles');
    clock.reload();
    assert.equal(clock.today(), '2026-03-01');
    instant = new Date('2026-03-29T00:30:00Z');
    assert.equal(at('Europe/Berlin'), '2026-03-29 01:30:00');
    instant = new Date('2026-03-29T01:30:00Z');
    assert.equal(at('Europe/Berlin'), '2026-03-29 03:30:00');
    instant = new Date('2026-12-31T23:59:59Z');
    assert.equal(at('Pacific/Auckland'), '2027-01-01 12:59:59');
    assert.equal(at('Pacific/Kiritimati'), '2027-01-01 13:59:59');
    settings.set('timezone', 'Not/AZone');
    clock.reload();
    assert.equal(clock.selected(), 'system');
    settings.set('timezone', 123);
    clock.reload();
    assert.equal(clock.selected(), 'system');
    assert.ok(clock.zones().includes('Asia/Kolkata'));
    assert.ok(!clock.zones().includes('Asia/Calcutta'));
    assert.equal(clock.isValid('system'), true);
    assert.equal(clock.isValid('Europe/Moscow'), true);
    assert.equal(clock.isValid('Europe/Nowhere'), false);
    assert.equal(clock.offset('Asia/Kolkata', instant), 'UTC+5:30');
    assert.equal(clock.offset('UTC', instant), 'UTC+0');
    assert.equal(clock.offset('America/New_York', new Date('2026-07-01T12:00:00Z')), 'UTC-4');
    database.close();
});

test('часовой пояс: настройка, список зон, created_at и дата теста реакции пишутся в выбранной зоне', async () => {
    let instant = new Date('2026-03-01T22:30:00Z');
    const { call, container } = createApp({ now: () => instant });
    assert.equal((await call('settings:get')).timezone, 'system');
    await rejects(call('settings:set', { key: 'timezone', value: 'Mars/Olympus' }), 400);
    await rejects(call('settings:set', { key: 'timezone', value: 7 }), 400);
    const zones = await call('clock:zones');
    assert.ok(zones.length > 300);
    assert.deepEqual(zones.find((zone) => zone.id === 'Asia/Tokyo'), { id: 'Asia/Tokyo', offset: 'UTC+9' });
    assert.ok(zones.some((zone) => zone.id === 'UTC'));

    await call('settings:set', { key: 'timezone', value: 'Asia/Tokyo' });
    assert.equal((await call('settings:get')).timezone, 'Asia/Tokyo');
    assert.deepEqual(await call('clock:now'), { timezone: 'Asia/Tokyo', effective: 'Asia/Tokyo', offset: 'UTC+9', system: { zone: Intl.DateTimeFormat().resolvedOptions().timeZone, offset: container.clock.offset(Intl.DateTimeFormat().resolvedOptions().timeZone, instant) }, timestamp: '2026-03-02 07:30:00', today: '2026-03-02' });

    await call('reaction:add', { values: [250, 260], average: 255 });
    assert.equal((await call('reaction:list'))[0].date, '2026-03-02 07:30:00');
    await call('nutrition:add', { date: '2026-03-02', name: 'Каша', weight: 100 });
    const nutrition = container.database.connection.prepare('SELECT created_at FROM nutrition_logs').get();
    assert.equal(nutrition.created_at, '2026-03-02 07:30:00');

    await call('settings:set', { key: 'timezone', value: 'America/Los_Angeles' });
    instant = new Date('2026-03-01T22:45:00Z');
    await call('mood:save', { date: '2026-03-01', time: '14:45', mood: 5 });
    assert.equal(container.database.connection.prepare('SELECT created_at FROM mood_entries').get().created_at, '2026-03-01 14:45:00');
    await call('mood:save', { date: '2026-03-01', time: '15:00', mood: 6 });
    instant = new Date('2026-03-02T01:00:00Z');
    await call('mood:save', { date: '2026-03-01', time: '17:00', mood: 7 });
    assert.equal(container.database.connection.prepare('SELECT created_at FROM mood_entries').get().created_at, '2026-03-01 17:00:00');
    container.close();
});

test('часовой пояс: пользовательские документы получают время создания и изменения в выбранной зоне', async () => {
    let instant = new Date('2026-06-15T10:00:00Z');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-tz-'));
    write(path.join(dir, 'mine', 'manifest.json'), { id: 'mine', kind: 'page', title: 'Мой' });
    const { call, container } = createApp({ now: () => instant, userModulesDir: dir });
    await call('settings:set', { key: 'timezone', value: 'Asia/Kolkata' });
    const { id } = await call('storage:insert', { module: 'mine', collection: 'items', data: { a: 1 } });
    let doc = await call('storage:get', { module: 'mine', collection: 'items', id });
    assert.deepEqual([doc.createdAt, doc.updatedAt], ['2026-06-15 15:30:00', '2026-06-15 15:30:00']);
    instant = new Date('2026-06-15T20:00:00Z');
    await call('storage:update', { module: 'mine', collection: 'items', id, data: { a: 2 } });
    doc = await call('storage:get', { module: 'mine', collection: 'items', id });
    assert.deepEqual([doc.createdAt, doc.updatedAt], ['2026-06-15 15:30:00', '2026-06-16 01:30:00']);
    container.close();
});

test('MessageTranslator: подстановки, множественные формы, отсутствующий ключ, load', () => {
    const ru = new MessageTranslator({
        language: 'ru',
        locale: 'ru-RU',
        strings: {
            hello: 'Привет, {name}!',
            count: { one: '{count} запись', few: '{count} записи', many: '{count} записей', other: '{count} записи' },
            only: { other: 'всегда {count}' }
        }
    });
    assert.equal(ru.t('hello', { name: 'Олег' }), 'Привет, Олег!');
    assert.equal(ru.t('hello'), 'Привет, {name}!');
    assert.deepEqual([1, 2, 5, 11, 21, 22, 25].map((count) => ru.t('count', { count })), ['1 запись', '2 записи', '5 записей', '11 записей', '21 запись', '22 записи', '25 записей']);
    assert.equal(ru.t('count', { count: 1.5 }), '1.5 записи');
    assert.equal(ru.t('count'), '{count} записи');
    assert.equal(ru.t('only', { count: 3 }), 'всегда 3');
    assert.equal(ru.t('absent.key'), 'absent.key');
    assert.deepEqual([...ru.missing], ['absent.key']);
    assert.equal(ru.has('hello'), true);
    assert.equal(ru.has('toString'), false);

    const en = new MessageTranslator({ language: 'en', locale: 'en-US', strings: { count: { one: '{count} entry', other: '{count} entries' } } });
    assert.deepEqual([0, 1, 2].map((count) => en.t('count', { count })), ['0 entries', '1 entry', '2 entries']);

    ru.load({ language: 'en', locale: 'en-US', strings: { hello: 'Hi' } });
    assert.equal(ru.t('hello'), 'Hi');
    assert.equal(ru.language, 'en');

    const broken = new MessageTranslator({ language: 'xx', locale: 'not a locale!!', strings: { a: 'b' } });
    assert.equal(broken.t('a'), 'b');
});

test('MessageTranslator: плоский словарь с формами множественного числа и подстановками', () => {
    const t = new MessageTranslator({
        language: 'en',
        locale: 'en-US',
        strings: {
            'error.unknownChannel': 'Unknown channel: {channel}',
            'error.count': { one: '{count} item', other: '{count} items' }
        }
    });
    assert.equal(t.t('error.unknownChannel', { channel: 'sleep:list' }), 'Unknown channel: sleep:list');
    assert.equal(t.t('error.count', { count: 0 }), '0 items');
    assert.equal(t.t('error.count', { count: 1 }), '1 item');
    assert.equal(t.t('error.count', { count: 2 }), '2 items');
    assert.equal(t.t('error.unknownChannel'), 'Unknown channel: {channel}');
});

test('MessageService: берёт строки области backend, работает без перезапуска, разрешает {key, params}', async () => {
    const { container, messages, call } = createApp({ systemLocale: 'ru-RU' });
    assert.ok(messages instanceof MessageService);
    assert.equal(messages.t('error.internal'), 'Внутренняя ошибка. Подробности в журнале.');
    assert.equal(messages.t('error.locked'), 'Требуется вход');
    assert.equal(messages.t('error.unknownChannel', { channel: 'x:y' }), 'Неизвестный канал: x:y');
    assert.equal(messages.t('нет.такого.ключа'), 'нет.такого.ключа');

    const problem = { file: 'x.json', key: 'error.unknownChannel', params: { channel: 'a:b' } };
    assert.equal(messages.t(problem.key, problem.params), 'Неизвестный канал: a:b');

    await call('settings:set', { key: 'language', value: 'en' });
    assert.equal(messages.t('error.internal'), 'Internal error. See the log for details.');
    assert.equal(messages.t('error.unknownChannel', { channel: 'x:y' }), 'Unknown channel: x:y');

    await call('settings:set', { key: 'language', value: 'ru' });
    assert.equal(messages.t('error.internal'), 'Внутренняя ошибка. Подробности в журнале.');

    container.close();
});

test('AppError: конструктор, помощники, поля key и params', () => {
    const withParams = new AppError('error.someKey', { n: 1 }, 400);
    assert.equal(withParams.key, 'error.someKey');
    assert.deepEqual(withParams.params, { n: 1 });
    assert.equal(withParams.status, 400);
    assert.equal(withParams.message, 'error.someKey');
    assert.equal(withParams.name, 'AppError');

    const withStatus = new AppError('Русский текст', 400);
    assert.equal(withStatus.key, 'Русский текст');
    assert.equal(withStatus.status, 400);
    assert.equal(withStatus.params, null);

    const plain = new AppError('error.bar');
    assert.equal(plain.status, 500);
    assert.equal(plain.params, null);

    const bad = AppError.badRequest('error.x');
    assert.equal(bad.status, 400);
    assert.equal(bad.key, 'error.x');
    const forb = AppError.forbidden('error.x', { id: 5 });
    assert.equal(forb.status, 403);
    assert.deepEqual(forb.params, { id: 5 });
    const nf = AppError.notFound('error.x');
    assert.equal(nf.status, 404);
});

test('IpcRouter: ответ роутера для AppError и неожиданной ошибки', async () => {
    const { container } = createApp({ systemLocale: 'ru-RU' });
    container.router.handlers.set('auth:testApp', () => {
        throw AppError.badRequest('error.locked');
    });
    container.router.handlers.set('auth:testParams', () => {
        throw AppError.badRequest('error.unknownChannel', { channel: 'z:w' });
    });
    container.router.handlers.set('auth:testPlain', () => {
        throw new Error('boom');
    });
    const originalError = console.error;
    console.error = () => {};
    try {
        const appResponse = await container.router.dispatch('auth:testApp', {});
        assert.equal(appResponse.ok, false);
        assert.equal(appResponse.status, 400);
        assert.equal(appResponse.code, 'error.locked');
        assert.equal(appResponse.error, 'Требуется вход');

        const paramsResponse = await container.router.dispatch('auth:testParams', {});
        assert.equal(paramsResponse.ok, false);
        assert.equal(paramsResponse.status, 400);
        assert.equal(paramsResponse.code, 'error.unknownChannel');
        assert.equal(paramsResponse.error, 'Неизвестный канал: z:w');

        const plainResponse = await container.router.dispatch('auth:testPlain', {});
        assert.equal(plainResponse.ok, false);
        assert.equal(plainResponse.status, 500);
        assert.equal(plainResponse.code, undefined);
        assert.equal(plainResponse.error, 'Внутренняя ошибка. Подробности в журнале.');
    } finally {
        console.error = originalError;
        container.close();
    }
});

test('IpcRouter: неизвестный канал и заблокированное состояние отвечают переведёнными ключами', async () => {
    const { container, call } = createApp({ systemLocale: 'ru-RU' });

    const unknown = await container.router.dispatch('nope:nothing', {});
    assert.equal(unknown.ok, false);
    assert.equal(unknown.status, 404);
    assert.equal(unknown.code, 'error.unknownChannel');
    assert.equal(unknown.error, 'Неизвестный канал: nope:nothing');

    await call('auth:setup', { login: 'a', password: 'abcd' });
    await call('auth:lock');
    const locked = await container.router.dispatch('modules:list', {});
    assert.equal(locked.ok, false);
    assert.equal(locked.status, 401);
    assert.equal(locked.code, 'error.locked');
    assert.equal(locked.error, 'Требуется вход');

    await call('auth:login', { login: 'a', password: 'abcd' });
    await call('settings:set', { key: 'language', value: 'en' });
    await call('auth:lock');
    const lockedEn = await container.router.dispatch('modules:list', {});
    assert.equal(lockedEn.error, 'Sign-in required');

    const unknownEn = await container.router.dispatch('nope:nothing', {});
    assert.equal(unknownEn.error, 'Unknown channel: nope:nothing');

    container.close();
});

test('совместимость: AppError со строкой-ключом возвращает ту же строку как сообщение', async () => {
    const { container } = createApp({ systemLocale: 'ru-RU' });
    container.router.handlers.set('auth:legacy', () => {
        throw AppError.badRequest('Своя русская строка без ключа');
    });
    const response = await container.router.dispatch('auth:legacy', {});
    assert.equal(response.ok, false);
    assert.equal(response.status, 400);
    assert.equal(response.error, 'Своя русская строка без ключа');
    assert.equal(response.code, 'Своя русская строка без ключа');
    container.close();
});

test('ошибки конфигов, модулей и языков переводятся на английский', async () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-errors-'));
    const overridesDir = path.join(base, 'config');
    const userModulesDir = path.join(base, 'modules');
    const userLocalesDir = path.join(base, 'locales');
    fs.mkdirSync(overridesDir, { recursive: true });
    fs.mkdirSync(userModulesDir, { recursive: true });
    fs.mkdirSync(userLocalesDir, { recursive: true });
    fs.writeFileSync(path.join(overridesDir, 'broken.json'), '{oops');
    fs.mkdirSync(path.join(userModulesDir, 'badmod'));
    fs.writeFileSync(path.join(userLocalesDir, 'bad.json'), '{oops');

    const { call, container } = createApp({ overridesDir, userModulesDir, userLocalesDir, systemLocale: 'ru-RU' });

    let configErrors = await call('config:errors');
    assert.ok(configErrors.some((e) => e.file === 'broken.json' && /некорректный JSON/.test(e.message) && e.key === 'config.invalidJson'));

    let moduleErrors = await call('modules:errors');
    assert.ok(moduleErrors.some((e) => e.dir === 'badmod' && /manifest\.json/.test(e.message) && e.key === 'module.missingManifest'));

    let i18nErrors = await call('i18n:errors');
    assert.ok(i18nErrors.some((e) => e.file === 'bad.json' && /некорректный JSON/.test(e.message) && e.key === 'locale.invalidJson'));

    await call('settings:set', { key: 'language', value: 'en' });

    configErrors = await call('config:errors');
    assert.ok(configErrors.some((e) => e.file === 'broken.json' && /invalid JSON/.test(e.message)));

    moduleErrors = await call('modules:errors');
    assert.ok(moduleErrors.some((e) => e.dir === 'badmod' && /manifest\.json file is missing/.test(e.message)));

    i18nErrors = await call('i18n:errors');
    assert.ok(i18nErrors.some((e) => e.file === 'bad.json' && /invalid JSON/.test(e.message)));

    container.close();
});