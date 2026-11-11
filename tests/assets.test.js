const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const ConfigService = require('../src/main/core/ConfigService');
const ModuleRegistry = require('../src/main/services/ModuleRegistry');
const AssetResolver = require('../src/main/core/AssetResolver');
const VendorBuilder = require('../scripts/prepare');

const root = path.join(__dirname, '..');
const rendererRoot = path.join(root, 'src', 'renderer');
const config = new ConfigService(path.join(root, 'config'));
const registry = new ModuleRegistry([{ dir: path.join(rendererRoot, 'modules'), source: 'system' }], config).scan();
const resolver = new AssetResolver({ appRoot: rendererRoot, appHost: 'app', registry });

function files(dir, found = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name !== 'vendor') {
                files(full, found);
            }
        } else if (/\.(html|js|css)$/.test(entry.name)) {
            found.push(full);
        }
    }
    return found;
}

function urlOf(file) {
    const relative = path.relative(rendererRoot, file).split(path.sep);
    if (relative[0] === 'modules') {
        return `bm://${relative[1]}/${relative.slice(2).join('/')}`;
    }
    return `bm://app/${relative.join('/')}`;
}

function references(file) {
    const text = fs.readFileSync(file, 'utf8');
    const found = [];
    const patterns = [
        /\bfrom\s+['"]([^'"]+)['"]/g,
        /\bimport\s+['"]([^'"]+)['"]/g,
        /<script[^>]+src="([^"]+)"/g,
        /<link[^>]+href="([^"]+)"/g,
        /@import\s+url\(['"]?([^'")]+)['"]?\)/g,
        /url\(['"]?([^'")]+)['"]?\)/g
    ];
    for (const pattern of patterns) {
        for (const match of text.matchAll(pattern)) {
            found.push(match[1]);
        }
    }
    return found.filter((value) => !value.startsWith('data:') && !value.startsWith('#'));
}

test('все ссылки и импорты в рендерере указывают на существующие файлы', () => {
    const broken = [];
    let checked = 0;
    for (const file of files(rendererRoot)) {
        for (const reference of references(file)) {
            const absolute = new URL(reference, urlOf(file)).href;
            if (absolute.startsWith('bm://app/vendor/')) {
                continue;
            }
            checked += 1;
            const target = resolver.resolve(absolute);
            if (!target || !fs.existsSync(target)) {
                broken.push(`${path.relative(rendererRoot, file)} -> ${reference}`);
            }
        }
    }
    assert.ok(checked > 20, `проверено слишком мало ссылок: ${checked}`);
    assert.deepEqual(broken, []);
});

test('config/app.json: fonts.subsets задан и не пуст', () => {
    const app = JSON.parse(fs.readFileSync(path.join(root, 'config', 'app.json'), 'utf8'));
    assert.ok(app.fonts, 'в config/app.json нет секции fonts');
    assert.ok(Array.isArray(app.fonts.subsets), 'fonts.subsets должен быть массивом');
    assert.ok(app.fonts.subsets.length > 0, 'fonts.subsets не должен быть пустым');
    for (const subset of app.fonts.subsets) {
        assert.equal(typeof subset, 'string', 'каждый subset — строка');
        assert.ok(subset.length > 0, 'subset не может быть пустой строкой');
    }
    assert.ok(app.fonts.subsets.includes('latin'), 'latin должен быть в fonts.subsets');
});

test('prepare.js: subsets берутся из config/app.json', () => {
    const app = JSON.parse(fs.readFileSync(path.join(root, 'config', 'app.json'), 'utf8'));
    const builder = new VendorBuilder(root);
    assert.deepEqual(builder.subsets(), app.fonts.subsets);
});

test('prepare.js: keepBlock пропускает только подмножества из конфига', () => {
    const builder = new VendorBuilder(root);
    const subsets = builder.subsets();
    for (const subset of subsets) {
        const block = `/* jetbrains-mono-${subset}-400-normal */\n@font-face { src: url(./files/x.woff2) format('woff2'); }`;
        assert.equal(builder.keepBlock(block), true, `${subset} должен включаться`);
        const italic = `/* playfair-display-${subset}-400-italic */\n@font-face { ... }`;
        assert.equal(builder.keepBlock(italic), true, `${subset} italic должен включаться`);
    }
    for (const subset of ['greek', 'vietnamese', 'hebrew']) {
        if (subsets.includes(subset)) {
            continue;
        }
        const block = `/* jetbrains-mono-${subset}-400-normal */\n@font-face { ... }`;
        assert.equal(builder.keepBlock(block), false, `${subset} не должен включаться`);
    }
});

test('prepare.js: subsets по умолчанию, если config пуст или отсутствует', () => {
    const base = fs.mkdtempSync(path.join(__dirname, 'tmp-vendor-'));
    const configDir = path.join(base, 'config');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'app.json'), '{ "fonts": { "subsets": [] } }');
    const builder = new VendorBuilder(base);
    assert.deepEqual(builder.subsets(), ['latin', 'latin-ext', 'cyrillic']);
    fs.writeFileSync(path.join(configDir, 'app.json'), '{}');
    assert.deepEqual(builder.subsets(), ['latin', 'latin-ext', 'cyrillic']);
    fs.rmSync(base, { recursive: true, force: true });
});

test('подготовленный вендор содержит Chart.js и шрифты', { skip: !fs.existsSync(path.join(rendererRoot, 'vendor')) }, () => {
    assert.ok(fs.existsSync(path.join(rendererRoot, 'vendor', 'chart.min.js')));
    const css = fs.readFileSync(path.join(rendererRoot, 'vendor', 'fonts', 'fonts.css'), 'utf8');
    for (const [, name] of css.matchAll(/url\(\.\/([^)]+)\)/g)) {
        assert.ok(fs.existsSync(path.join(rendererRoot, 'vendor', 'fonts', name)), name);
    }
});

test('подготовленный вендор: только подмножества из конфига', { skip: !fs.existsSync(path.join(rendererRoot, 'vendor')) }, () => {
    const app = JSON.parse(fs.readFileSync(path.join(root, 'config', 'app.json'), 'utf8'));
    const subsets = app.fonts.subsets;
    const css = fs.readFileSync(path.join(rendererRoot, 'vendor', 'fonts', 'fonts.css'), 'utf8');
    for (const [, name] of css.matchAll(/url\(\.\/([^)]+)\)/g)) {
        const matched = subsets.some((subset) => new RegExp(`-${subset}-\\d+-(normal|italic)\\.woff2$`).test(name));
        assert.ok(matched, `${name} не соответствует ни одному подмножеству из конфига`);
    }
});

test('font-family в base.css и shell.css заканчиваются системными fallback', () => {
    const generic = /(?:^|,)\s*(monospace|serif|sans-serif)\s*(?:!important)?\s*;?\s*$/;
    const variables = new Map();
    const base = fs.readFileSync(path.join(rendererRoot, 'shared', 'base.css'), 'utf8');
    for (const match of base.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
        variables.set(match[1], match[2].trim());
    }
    for (const relative of ['shared/base.css', 'shell/shell.css']) {
        const css = fs.readFileSync(path.join(rendererRoot, relative), 'utf8');
        for (const match of css.matchAll(/font-family\s*:\s*([^;]+);/g)) {
            let value = match[1].trim();
            const ref = value.match(/^var\((--[\w-]+)\)$/);
            if (ref) {
                value = variables.get(ref[1]) || '';
            }
            assert.match(value, generic, `${relative}: "${match[1].trim()}" не заканчивается системным шрифтом`);
        }
    }
});

test('в рендерере нет обращений к сети и к устаревшему API', () => {
    const forbidden = [/https?:\/\//, /\bfetch\(/, /localStorage/, /\/api\//];
    const offenders = [];
    for (const file of files(rendererRoot)) {
        const text = fs.readFileSync(file, 'utf8').replace(/http:\/\/www\.w3\.org\/2000\/svg/g, '');
        for (const pattern of forbidden) {
            if (pattern.test(text)) {
                offenders.push(`${path.relative(rendererRoot, file)}: ${pattern}`);
            }
        }
    }
    assert.deepEqual(offenders, []);
});

test('в коде нет комментариев', () => {
    const offenders = [];
    const self = path.join(__dirname, 'assets.test.js');
    const roots = [path.join(root, 'src'), path.join(root, 'tests'), path.join(root, 'scripts')];
    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (full === self) {
                continue;
            }
            if (entry.isDirectory()) {
                if (entry.name !== 'vendor') {
                    walk(full);
                }
            } else if (/\.(js|css)$/.test(entry.name)) {
                const text = fs.readFileSync(full, 'utf8');
                const cleaned = text
                    .replace(/https?:\/\/\S+/g, '')
                    .replace(/bm:\/\/\S+/g, '')
                    .replace(/\\\//g, '');
                if (cleaned.includes('/*')) {
                    offenders.push(path.relative(root, full));
                    continue;
                }
                if (cleaned.split('\n').some((line) => line.trimStart().startsWith('//'))) {
                    offenders.push(path.relative(root, full));
                    continue;
                }
                if (cleaned.includes(' // ')) {
                    offenders.push(path.relative(root, full));
                }
            }
        }
    };
    roots.forEach(walk);
    assert.deepEqual(offenders, []);
});