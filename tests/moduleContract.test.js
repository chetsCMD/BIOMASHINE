const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { createApp } = require('./helpers');
const { FakeDocument, FakeChart } = require('./support/FakeDom');
const { createFakeBm } = require('./support/FakeBm');
const { checkScope, readText } = require('./support/I18nScan');
const ConfigService = require('../src/main/core/ConfigService');
const ModuleRegistry = require('../src/main/services/ModuleRegistry');

const root = path.join(__dirname, '..');
const rendererRoot = path.join(root, 'src', 'renderer');
const config = new ConfigService(path.join(root, 'config'));
const registry = new ModuleRegistry([{ dir: path.join(rendererRoot, 'modules'), source: 'system' }], config).scan();
const pages = registry.all().filter((module) => module.kind === 'page');
const configNames = new Set(fs.readdirSync(path.join(root, 'config')).map((file) => path.basename(file, '.json')));
const privateConfigs = new Set(config.get('app.privateConfigs'));
const i18n = config.get('app.i18n');
const read = (...parts) => fs.readFileSync(path.join(...parts), 'utf8').replace(/\r\n/g, '\n');

function jsFiles(module) {
    const dir = path.join(module.dir, 'js');
    return fs.existsSync(dir) ? fs.readdirSync(dir).filter((file) => file.endsWith('.js')) : [];
}

function allows(module, channel) {
    const [domain] = channel.split(':');
    return module.channels.includes(channel) || module.channels.includes(`${domain}:*`);
}

function sharedDictionaries() {
    const dir = path.join(rendererRoot, 'shared', 'locales');
    const map = {};
    for (const entry of i18n.builtin) {
        const file = path.join(dir, `${entry.code}.json`);
        if (fs.existsSync(file)) {
            map[entry.code] = JSON.parse(readText(file));
        }
    }
    return map;
}

test('в системных модулях есть страницы', () => {
    assert.ok(pages.length >= 2);
});

for (const module of pages) {
    test(`контракт «${module.id}»: файлы, манифест и README`, () => {
        const html = read(module.dir, module.entry);
        assert.ok(html.includes('bm://app/vendor/fonts/fonts.css'));
        assert.ok(html.includes('bm://app/shared/base.css'));
        assert.match(html, /<script type="module" src="\.\/js\/main\.js"><\/script>/);
        assert.ok(!/<style[\s>]/.test(html), 'стили только в module.css');
        assert.ok(!/<script(?![^>]*\bsrc=)/.test(html), 'нет встроенных скриптов');
        assert.ok(!/\son[a-z]+\s*=\s*["']/i.test(html), 'нет inline-обработчиков (onclick=...), используй addEventListener');
        assert.ok(!/<!--/.test(html), 'нет HTML-комментариев');
        const readme = read(module.dir, 'README.md');
        for (const heading of ['Назначение', 'Каналы', 'Конфиги', 'Файлы', 'Поведение']) {
            assert.match(readme, new RegExp(`^## ${heading}\\s*$`, 'm'), `в README нет раздела «${heading}»`);
        }
    });

    test(`контракт «${module.id}»: main.js имеет стандартный вид, один класс на файл`, () => {
        const main = `${read(module.dir, 'js', 'main.js').trimEnd()}\n`;
        assert.match(main, /^import \{ bm \} from 'bm:\/\/app\/sdk\/bm\.js';\nimport \{ (\w+) \} from '\.\/\1\.js';\n\nbm\.ready\.then\(\(\) => new \1\(bm, document(?:, window\.Chart)?\)\.start\(\)\);\n$/);
        for (const file of jsFiles(module).filter((name) => name !== 'main.js')) {
            const name = path.basename(file, '.js');
            assert.match(read(module.dir, 'js', file), new RegExp(`^export class ${name}\\b`, 'm'), `${file}: нужен export class ${name}`);
        }
    });

    test(`контракт «${module.id}»: каналы существуют и разрешены манифестом, конфиги существуют`, async () => {
        const { container } = createApp();
        const known = new Set(container.router.handlers.keys());
        const domains = new Set([...known].map((channel) => channel.split(':')[0]));
        const readme = read(module.dir, 'README.md');
        const used = new Set();
        const configs = new Set();
        for (const file of jsFiles(module)) {
            const code = read(module.dir, 'js', file);
            for (const [, literal] of code.matchAll(/['"`]([a-z]+:[A-Za-z]+)['"`]/g)) {
                if (domains.has(literal.split(':')[0])) {
                    used.add(literal);
                }
            }
            for (const [, name] of code.matchAll(/\.config\(\s*['"]([^'"]+)['"]\s*\)/g)) {
                configs.add(name);
            }
        }
        for (const channel of used) {
            assert.ok(known.has(channel), `канала ${channel} не существует`);
            assert.ok(channel.startsWith('storage:') || allows(module, channel), `канал ${channel} не разрешён в manifest.json`);
            assert.ok(readme.includes(channel.split(':')[0]), `README не упоминает домен ${channel}`);
        }
        for (const name of configs) {
            assert.ok(configNames.has(name) && !privateConfigs.has(name), `конфига ${name} нет или он приватный`);
            assert.ok(readme.includes(name), `README не упоминает конфиг ${name}`);
        }
        for (const channel of module.channels) {
            const pattern = channel.endsWith(':*') ? channel.slice(0, -2) : channel;
            assert.ok(channel.endsWith(':*') ? domains.has(pattern) : known.has(channel), `в manifest.json лишний канал ${channel}`);
        }
        container.close();
    });

    test(`контракт «${module.id}»: нет запрещённых приёмов`, () => {
        for (const file of jsFiles(module)) {
            const code = read(module.dir, 'js', file);
            assert.ok(!/(?<!bm\.)\b(alert|confirm|prompt)\(/.test(code), `${file}: нативные диалоги, используй bm.confirm`);
            assert.ok(!/\beval\(|document\.write\(|new Function\(/.test(code), `${file}: eval/document.write`);
            assert.ok(!/innerHTML\s*\+?=\s*`[^`]*\$\{/.test(code) && !/innerHTML\s*\+?=\s*[^;]*\+\s*\w/.test(code), `${file}: innerHTML с подстановкой данных, собирай DOM через createElement и textContent`);
            assert.ok(!/\bnew Date\(\s*\)/.test(code) || /Clock\.js$/.test(file), `${file}: текущее время только через класс часов (js/ModuleClock.js)`);
            assert.ok(!/Date\.now\(\)/.test(code) || /Clock\.js$/.test(file), `${file}: Date.now только через класс часов (js/ModuleClock.js)`);
        }
    });

    test(`контракт «${module.id}»: многоязычность`, { skip: module.i18n ? false : 'модуль ещё не переведён на ключи (в manifest.json нет "i18n": true)' }, () => {
        const configKeys = [];
        const collect = (node) => {
            for (const [name, value] of Object.entries(node || {})) {
                if (typeof value === 'string' && name.endsWith('Key')) {
                    configKeys.push(value);
                } else if (value && typeof value === 'object') {
                    collect(value);
                }
            }
        };
        for (const file of jsFiles(module)) {
            for (const [, name] of read(module.dir, 'js', file).matchAll(/\.config\(\s*['"]([^'"]+)['"]\s*\)/g)) {
                if (configNames.has(name)) {
                    collect(JSON.parse(read(root, 'config', `${name}.json`)));
                }
            }
        }
        const result = checkScope({
            label: module.id,
            jsFiles: jsFiles(module).map((file) => path.join(module.dir, 'js', file)),
            htmlFiles: [path.join(module.dir, module.entry)],
            dictionaryDir: path.join(module.dir, 'locales'),
            extraKeys: ['module.title', 'module.description', ...configKeys],
            shared: sharedDictionaries(),
            i18n,
            enforceUnused: true
        });
        for (const file of jsFiles(module)) {
            assert.ok(!/['"`](?:ru|en)(?:-[A-Z]{2})?['"`]/.test(read(module.dir, 'js', file).replace(/lang\b/g, '')), `${file}: не зашивай язык или локаль, используй bm.locale`);
        }
        assert.deepEqual(result.problems, []);
    });

    test(`контракт «${module.id}»: класс часов использует bm.clock`, () => {
        for (const file of jsFiles(module).filter((name) => /Clock\.js$/.test(name))) {
            assert.match(read(module.dir, 'js', file), /\.clock\./, `${file}: класс часов должен брать время из bm.clock (раздел «Время» инструкции)`);
        }
    });

    test(`контракт «${module.id}»: все id из JS есть в HTML`, () => {
        const html = read(module.dir, module.entry);
        const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
        for (const file of jsFiles(module)) {
            for (const [, id] of read(module.dir, 'js', file).matchAll(/(?:getElementById|byId)\(\s*'([^']+)'\s*\)/g)) {
                assert.ok(ids.has(id), `${file}: в ${module.entry} нет элемента #${id}`);
            }
        }
    });

    test(`контракт «${module.id}»: запускается на пустой базе без ошибок`, async () => {
        const { call, container } = createApp();
        const main = read(module.dir, 'js', 'main.js');
        const [, className] = main.match(/new (\w+)\(bm, document(?:, window\.Chart)?\)/);
        const Module = (await import(pathToFileURL(path.join(module.dir, 'js', `${className}.js`)).href))[className];
        const doc = new FakeDocument();
        const bm = await createFakeBm({ call, scope: module.id, channels: module.channels });
        globalThis.window = { Chart: FakeChart, addEventListener() {}, removeEventListener() {} };
        globalThis.document = doc;
        globalThis.getComputedStyle = () => ({ getPropertyValue: () => '#fff' });
        try {
            await Promise.race([
                new Module(bm, doc, FakeChart).start(),
                new Promise((resolve, reject) => setTimeout(() => reject(new Error('start() не завершился за 5 секунд')), 5000))
            ]);
        } finally {
            delete globalThis.window;
            delete globalThis.document;
            delete globalThis.getComputedStyle;
        }
        assert.deepEqual(bm.denied, []);
        const html = read(module.dir, module.entry);
        const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
        for (const id of doc.requestedIds) {
            assert.ok(ids.has(id), `при запуске запрошен #${id}, которого нет в ${module.entry}`);
        }
        container.close();
    });
}