const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..', 'src');

function walk(dir, found = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!['vendor', 'node_modules'].includes(entry.name)) walk(full, found);
        } else if (entry.name.endsWith('.js')) {
            found.push(full);
        }
    }
    return found;
}

test('синтаксис: каждый файл интерфейса и SDK разбирается как модуль, а файлы главного процесса как CommonJS', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-syntax-'));
    const broken = [];
    for (const file of walk(root)) {
        const renderer = file.includes(`${path.sep}renderer${path.sep}`) || file.includes(`${path.sep}docs${path.sep}`);
        const target = path.join(temp, renderer ? 'check.mjs' : 'check.cjs');
        fs.copyFileSync(file, target);
        const result = spawnSync(process.execPath, ['--check', target], { encoding: 'utf8' });
        if (result.status !== 0) {
            broken.push(`${path.relative(root, file)}: ${String(result.stderr).split('\n').find((line) => /Error/.test(line)) || 'syntax error'}`);
        }
    }
    assert.deepEqual(broken, []);
});

test('синтаксис: блоки из документации', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-syntax-doc-'));
    const file = path.join(__dirname, '..', 'docs', 'en', 'ai', 'examples', 'blocks', 'counter', 'render.js');
    const target = path.join(temp, 'check.mjs');
    fs.copyFileSync(file, target);
    assert.equal(spawnSync(process.execPath, ['--check', target]).status, 0);
});
