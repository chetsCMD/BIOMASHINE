const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const DesignTool = require('../scripts/lib/DesignTool');
const ConfigService = require('../src/main/core/ConfigService');
const ThemeCatalog = require('../src/main/services/ThemeCatalog');
const DesignService = require('../src/main/services/DesignService');
const { pathToFileURL } = require('url');
const { createApp, rejects } = require('./helpers');

const root = path.join(__dirname, '..');
const rendererRoot = path.join(root, 'src', 'renderer');
const config = new ConfigService(path.join(root, 'config'));
const tokens = config.get('design.tokens');
const themes = config.get('themes');
const themeVariables = themes.themes[themes.default].variables;
const read = (file) => fs.readFileSync(file, 'utf8');
const relative = (file) => path.relative(root, file).split(path.sep).join('/');

function optionsFor(file) {
    const unix = relative(file);
    const module = unix.match(/\/modules\/([a-z0-9-]+)\//);
    return { file: unix, prefix: module ? module[1] : '', themeVariables: unix.endsWith('shared/base.css') ? themeVariables : null };
}

function scripts(dir, found = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!['vendor', 'locales', 'node_modules'].includes(entry.name)) scripts(full, found);
        } else if (entry.name.endsWith('.js')) {
            found.push(full);
        }
    }
    return found;
}

test('дизайн: инструмент переносит литералы в токены и доказывает отсутствие изменений', () => {
    const css = '.a { padding: 12px 16px; border: 1px solid var(--br); color: #8BC34A; background: rgba(0, 0, 0, 0.6); transition: all 0.2s ease; z-index: 10; font-weight: 700; margin: -4px; width: calc(100% - 20px); } @media (max-width: 900px) { .a { gap: 10px; } }';
    const tool = new DesignTool();
    const result = tool.process(css, { write: true });
    assert.ok(result.violations.length >= 12);
    for (const expected of ['var(--space-12px)', 'var(--space-16px)', 'var(--border-1px)', 'var(--color-8bc34a)', 'var(--duration-200ms)', 'var(--z-10)', 'var(--font-weight-700)', 'var(--space-n4px)', 'var(--size-20px)', '$breakpoint-900px']) {
        assert.ok(result.css.includes(expected), expected);
    }
    assert.equal(tool.tokens['space-12px'], '12px');
    assert.equal(tool.tokens['color-8bc34a'], '#8bc34a');
    assert.equal(tool.tokens['duration-200ms'], '200ms');
    assert.deepEqual(DesignTool.verify(css, result.css, tool.tokens), []);
    assert.deepEqual(new DesignTool(tool.tokens).process(result.css).violations, []);
});

test('дизайн: структурные значения не считаются хардкодом', () => {
    const css = '.a { margin: 0; width: 100%; flex: 1; grid-template-columns: repeat(2, 1fr) 1fr; opacity: 1; top: 50%; display: none; height: auto; border: none; color: currentColor; background: transparent; }';
    assert.deepEqual(new DesignTool().process(css).violations, []);
});

test('дизайн: определения переменных переезжают в токены с префиксом модуля, ссылки переименовываются', () => {
    const css = ':root { --danger: #ff4444; --soft: var(--danger); } .a { color: var(--danger); }';
    const tool = new DesignTool();
    const result = tool.process(css, { write: true, prefix: 'demo', file: 'x' });
    assert.equal(tool.tokens['demo-danger'], '#ff4444');
    assert.ok(!result.css.includes('--danger:'));
    assert.ok(result.css.includes('var(--demo-danger)'));
    assert.deepEqual(DesignTool.verify(css, result.css, tool.tokens), []);
    const duplicate = new DesignTool().process(':root { --bg: #121212; }', { themeVariables: { '--bg': '#121212' } });
    assert.equal(duplicate.violations[0].note, 'duplicates a theme variable');
});

test('дизайн: в стилях проекта нет зашитых визуальных значений (включая модули)', () => {
    const tool = new DesignTool(tokens);
    const found = [];
    for (const file of DesignTool.files(rendererRoot)) {
        for (const item of tool.process(read(file), optionsFor(file)).violations) found.push(`${item.file}:${item.line} ${item.prop}: ${item.literal}`);
    }
    assert.deepEqual(found, []);
});

test('дизайн: стили не объявляют переменные, base.css подключает сгенерированные токены', () => {
    assert.ok(read(path.join(rendererRoot, 'shared', 'base.css')).startsWith('@import url("design.css");'));
    for (const file of DesignTool.files(rendererRoot)) {
        const definitions = [...read(file).matchAll(/^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/gm)].filter((match) => !DesignTool.isReference(match[2].trim()));
        assert.deepEqual(definitions.map((match) => match[1]), [], relative(file));
    }
});

test('дизайн: каждая использованная переменная определена токеном или темой', () => {
    const defined = new Set([...Object.keys(tokens), ...Object.keys(themeVariables).map((name) => name.slice(2)), 'color-scheme']);
    const missing = new Set();
    for (const file of DesignTool.files(rendererRoot)) {
        for (const [, name] of read(file).matchAll(/var\(\s*--([a-z0-9-]+)\s*\)/g)) {
            if (!defined.has(name)) missing.add(`${relative(file)}: --${name}`);
        }
    }
    assert.deepEqual([...missing], []);
});

test('дизайн: шрифтовые токены заканчиваются системным запасным шрифтом', () => {
    for (const [name, value] of Object.entries(tokens)) {
        if (/^font-(mono|display|serif|family-\d+)/.test(name) && /,/.test(value)) assert.match(value.trim(), /(monospace|serif|sans-serif|system-ui)$/i, name);
    }
});

test('DesignService: токены, переменные темы, пользовательские переопределения и подстановка точек адаптивности', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-design-'));
    fs.writeFileSync(path.join(dir, 'design.json'), JSON.stringify({ tokens: { 'space-8px': '10px' } }));
    const overridden = new ConfigService(path.join(root, 'config'), dir);
    const service = new DesignService({ config: overridden, catalog: new ThemeCatalog(overridden), settings: { getAll: () => ({ theme: 'light' }) } });
    const css = service.css();
    assert.match(css, /--space-8px: 10px;/);
    assert.ok(css.includes(`--bg: ${themes.themes.light.variables['--bg']};`));
    assert.match(css, new RegExp(`color-scheme: ${themes.themes.light.colorScheme};`));
    assert.equal(service.expand('@media (max-width: $breakpoint-900px) {}'), '@media (max-width: 900px) {}');
    assert.equal(service.expand('$unknown-token'), '$unknown-token');
});

test('дизайн: в JS нет присваиваний визуальных значений литералами в style.*', () => {
    const units = /(\d(\.\d+)?(px|rem|em|ms|s|vh|vw|%)(?![\w]))|#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/;
    const found = [];
    for (const file of scripts(rendererRoot)) {
        const code = read(file);
        for (const match of code.matchAll(/\.style\.(?!display\b|visibility\b)([a-zA-Z]+)\s*=\s*(['"`])((?:(?!\2)[^\\]|\\.)*)\2/g)) {
            if (!match[3].includes('${') && units.test(match[3])) found.push(`${relative(file)}: style.${match[1]} = ${match[2]}${match[3]}${match[2]}`);
        }
        if (/\.style\.cssText\s*=/.test(code)) found.push(`${relative(file)}: style.cssText`);
    }
    assert.deepEqual(found, []);
});

test('дизайн (бэкенд): переопределения токенов, области и порядок слияния', async () => {
    const { call, container } = createApp();
    const base = (await call('design:get', {})).base;
    const name = Object.keys(base).find((item) => item.startsWith('space-'));
    await call('design:set', { tokens: { [name]: '99px', 'my-accent': '#ff00ff' } });
    const global = await call('design:get', {});
    assert.equal(global.overrides[name], '99px');
    assert.equal(global.tokens['my-accent'], '#ff00ff');
    assert.match(container.design.css(), new RegExp(`--${name}: 99px;`));
    await call('design:set', { module: 'reaction', tokens: { [name]: '7px' } });
    const scoped = await call('design:get', { module: 'reaction' });
    assert.equal(scoped.effective[name], '7px');
    assert.equal(scoped.tokens[name], '7px');
    assert.equal((await call('design:get', {})).effective[name], '99px');
    await call('design:reset', { module: 'reaction', names: [name] });
    assert.equal((await call('design:get', { module: 'reaction' })).effective[name], '99px');
    await call('design:reset', {});
    assert.deepEqual((await call('design:get', {})).overrides, {});
    container.close();
});

test('дизайн (бэкенд): проверка значений, групп, экспорта и импорта', async () => {
    const { call, container } = createApp();
    await rejects(call('design:set', { tokens: { 'Bad Name': '1px' } }), 400);
    await rejects(call('design:set', { tokens: { good: 'red; } body { x' } }), 400);
    await rejects(call('design:set', { tokens: { good: '' } }), 400);
    await rejects(call('design:set', { tokens: { good: 'x'.repeat(301) } }), 400);
    await rejects(call('design:set', { tokens: ['x'] }), 400);
    await rejects(call('design:set', { module: 'nope', tokens: { good: '1px' } }), 404);
    const groups = await call('design:groups');
    assert.ok(groups.length > 3);
    assert.ok(groups.every((group) => group.group && group.tokens.length > 0 && group.tokens[0].name));
    await call('design:set', { tokens: { 'my-accent': '#ff00ff' } });
    await call('design:setCss', { css: '.a { color: red; }' });
    await call('design:set', { module: 'kbju', tokens: { 'kbju-accent': '#00ff00' } });
    await call('design:setCss', { module: 'kbju', css: '.b { color: blue; }' });
    const data = await call('design:export');
    assert.equal(data.version, 1);
    await call('design:reset', {});
    await call('design:reset', { module: 'kbju' });
    await call('design:resetCss', {});
    await call('design:resetCss', { module: 'kbju' });
    assert.deepEqual((await call('design:get', {})).overrides, {});
    await call('design:import', { data });
    assert.equal((await call('design:get', {})).overrides['my-accent'], '#ff00ff');
    assert.equal((await call('design:getCss', { module: 'kbju' })).effective, '.a { color: red; }\n.b { color: blue; }');
    await rejects(call('design:import', { data: { version: 2 } }), 400);
    await rejects(call('design:import', { data: { version: 1, overrides: { 'Bad Name': '1px' } } }), 400);
    container.close();
});

test('дизайн (бэкенд): пользовательский CSS по областям и его ограничения', async () => {
    const { call, container } = createApp();
    await call('design:setCss', { css: 'body { color: red; }' });
    assert.equal((await call('design:getCss', {})).css, 'body { color: red; }');
    await call('design:setCss', { module: 'reaction', css: '.x { color: blue; }' });
    const scoped = await call('design:getCss', { module: 'reaction' });
    assert.equal(scoped.css, '.x { color: blue; }');
    assert.equal(scoped.effective, 'body { color: red; }\n.x { color: blue; }');
    assert.equal((await call('design:getCss', { module: 'kbju' })).effective, 'body { color: red; }');
    await rejects(call('design:setCss', { css: '@import url(https://evil.example/x.css);' }), 400);
    await rejects(call('design:setCss', { css: '@import "//evil.example/x.css";' }), 400);
    await rejects(call('design:setCss', { css: 'a{}</style><script>' }), 400);
    await rejects(call('design:setCss', { css: 'x'.repeat(50001) }), 400);
    await rejects(call('design:setCss', { css: 5 }), 400);
    await call('design:resetCss', { module: 'reaction' });
    assert.equal((await call('design:getCss', { module: 'reaction' })).css, '');
    await call('design:resetCss', {});
    assert.equal((await call('design:getCss', {})).effective, '');
    container.close();
});

test('плагины: порядок применения хранится и попадает в список модулей', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-plugins-'));
    for (const id of ['alpha', 'beta', 'gamma']) {
        fs.mkdirSync(path.join(dir, id));
        fs.writeFileSync(path.join(dir, id, 'manifest.json'), JSON.stringify({ id, kind: 'plugin', title: id, css: ['s.css'] }));
    }
    const { call, container } = createApp({ userModulesDir: dir });
    const order = (list) => list.filter((item) => item.kind === 'plugin').sort((a, b) => a.pluginOrder - b.pluginOrder).map((item) => item.id);
    assert.deepEqual(order(await call('modules:list')), ['alpha', 'beta', 'gamma']);
    const updated = await call('modules:reorderPlugins', { ids: ['gamma', 'alpha', 'beta'] });
    assert.deepEqual(order(updated), ['gamma', 'alpha', 'beta']);
    assert.deepEqual(order(await call('modules:list')), ['gamma', 'alpha', 'beta']);
    await call('modules:setHidden', { id: 'alpha', hidden: true });
    assert.deepEqual(order(await call('modules:list')), ['gamma', 'alpha', 'beta']);
    await rejects(call('modules:reorderPlugins', { ids: ['gamma', 'nope'] }), 400);
    await rejects(call('modules:reorderPlugins', { ids: 'gamma' }), 400);
    container.close();
});

test('дизайн (интерфейс): CSS переопределений и определение типа значения', async () => {
    const { DesignStyle } = await import(pathToFileURL(path.join(rendererRoot, 'sdk', 'DesignStyle.js')).href);
    const { TokenKinds } = await import(pathToFileURL(path.join(rendererRoot, 'shell', 'DesignEditor.js')).href);
    assert.equal(DesignStyle.css({}), '');
    assert.equal(DesignStyle.css({ 'space-8px': '10px' }), ':root {\n  --space-8px: 10px;\n}\n');
    assert.equal(TokenKinds.kind('#ff00aa'), 'color');
    assert.equal(TokenKinds.kind('rgba(0, 0, 0, 0.5)'), 'color-text');
    assert.equal(TokenKinds.kind('12px'), 'length');
    assert.equal(TokenKinds.kind('200ms'), 'time');
    assert.equal(TokenKinds.kind('700'), 'number');
    assert.equal(TokenKinds.kind("'JetBrains Mono', monospace"), 'text');
});
