const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { createApp, rejects } = require('./helpers');

const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'bm-builder-'));
const sample = (extra = {}) => ({
    version: 1,
    collections: { weight: { title: 'Weight', fields: [{ id: 'date', type: 'date' }, { id: 'kg', type: 'number' }] } },
    blocks: [
        { id: 'b1', type: 'heading', props: { text: 'Hello', level: '1' }, layout: { x: 0, y: 0, w: 1, h: 56 } },
        { id: 'b2', type: 'input-number', props: { label: 'Kg', collection: 'weight', field: 'kg', form: 'main' }, layout: { x: 0, y: 72, w: 0.5, h: 72 } },
        { id: 'b3', type: 'submit', props: { collection: 'weight', form: 'main' }, layout: { x: 0.5, y: 72, w: 0.25, h: 56 } }
    ],
    ...extra
});

function app(options = {}) {
    const root = temp();
    const modules = path.join(root, 'modules');
    fs.mkdirSync(modules);
    return { root, modules, blocks: path.join(root, 'blocks'), ...createApp({ userModulesDir: modules, ...options }) };
}

test('блоки: системные блоки находятся, у каждого корректный манифест', async () => {
    const { call, container } = app();
    const list = await call('blocks:list');
    const types = list.map((block) => block.type).sort();
    assert.deepEqual(types, ['chart', 'checkbox', 'divider', 'heading', 'input-date', 'input-number', 'input-text', 'list', 'progress', 'select', 'stat', 'submit', 'text']);
    assert.ok(list.every((block) => block.source === 'system' && block.title.en && block.title.ru && block.title.es && block.title.de));
    assert.deepEqual(await call('blocks:errors'), []);
    container.close();
});

test('блоки: пользовательские блоки, ошибки манифестов и раздача файлов', async () => {
    const { call, container, blocks } = app();
    const write = (name, files) => {
        fs.mkdirSync(path.join(blocks, name), { recursive: true });
        for (const [file, text] of Object.entries(files)) fs.writeFileSync(path.join(blocks, name, file), text);
    };
    const manifest = (type) => JSON.stringify({ type, title: { en: 'Counter' }, group: 'data', size: { w: 0.25, h: 80 }, props: [{ name: 'label', type: 'string' }] });
    write('counter', { 'block.json': manifest('counter'), 'render.js': 'export default class {}', 'style.css': '.a{}' });
    write('heading', { 'block.json': manifest('heading'), 'render.js': 'x' });
    write('wrongname', { 'block.json': manifest('other'), 'render.js': 'x' });
    write('norender', { 'block.json': manifest('norender') });
    write('broken', { 'block.json': '{oops', 'render.js': 'x' });
    const list = await call('blocks:list');
    assert.ok(list.some((block) => block.type === 'counter' && block.source === 'user'));
    assert.equal(list.filter((block) => block.type === 'heading').length, 1);
    const keys = (await call('blocks:errors')).map((problem) => problem.key).sort();
    assert.deepEqual(keys, ['block.duplicate', 'block.invalidJson', 'block.missingRender', 'block.typeMismatch']);
    const registry = container.blocks;
    assert.equal(registry.resolveUrl('bm://blocks/counter/render.js'), path.join(blocks, 'counter', 'render.js'));
    assert.equal(registry.resolveUrl('bm://blocks/counter/secret.txt'), null);
    assert.equal(registry.resolveUrl('bm://blocks/../x/render.js'), null);
    assert.equal(registry.resolveUrl('bm://blocks/nope/render.js'), null);
    assert.equal(registry.resolveUrl('bm://app/shell/index.html'), undefined);
    assert.equal((await call('blocks:openFolder')).opened, true);
    container.close();
});

test('конструктор: сохранение создаёт обычный модуль, загрузка, обновление и удаление', async () => {
    const { call, container, modules } = app();
    const saved = await call('builder:save', { title: 'My Weight!', description: 'd', category: 'body', spec: sample() });
    assert.equal(saved.id, 'my-my-weight');
    const dir = path.join(modules, saved.id);
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
    assert.deepEqual([manifest.kind, manifest.category, manifest.i18n, manifest.builder, manifest.channels], ['page', 'body', false, { version: 1 }, ['blocks:list']]);
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    assert.ok(html.includes('id="bmb-spec"') && html.includes('bm://app/blocks/runtime/main.js'));
    assert.ok(!html.includes('</script><script'));
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'spec.json'), 'utf8')).blocks.length, 3);
    assert.ok((await call('modules:list')).some((module) => module.id === saved.id && module.source === 'user'));
    assert.deepEqual((await call('builder:list')).map((item) => item.id), [saved.id]);
    const loaded = await call('builder:load', { id: saved.id });
    assert.equal(loaded.title, 'My Weight!');
    assert.equal(loaded.spec.collections.weight.fields.length, 2);

    const again = await call('builder:save', { id: saved.id, title: 'Renamed', category: 'mind', spec: sample({ blocks: [] }) });
    assert.equal(again.id, saved.id);
    assert.equal((await call('builder:load', { id: saved.id })).title, 'Renamed');
    const second = await call('builder:save', { title: 'My Weight!', spec: sample() });
    assert.equal(second.id, 'my-my-weight-2');

    await call('builder:remove', { id: saved.id });
    assert.ok(!fs.existsSync(dir));
    await rejects(call('builder:load', { id: saved.id }), 404);
    await rejects(call('builder:remove', { id: 'kbju' }), 404);
    container.close();
});

test('конструктор: проверка спецификации и параметров', async () => {
    const { call, container } = app();
    const bad = (payload, status = 400) => rejects(call('builder:save', { title: 'T', spec: sample(), ...payload }), status);
    await bad({ title: '' });
    await bad({ title: 'x'.repeat(81) });
    await bad({ category: 'nope' });
    await bad({ spec: null });
    await bad({ spec: sample({ version: 2 }) });
    await bad({ spec: sample({ blocks: [{ id: 'b1', type: 'nope', props: {}, layout: { x: 0, y: 0, w: 1, h: 10 } }] }) });
    await bad({ spec: sample({ blocks: [{ id: 'B 1', type: 'heading', props: {}, layout: { x: 0, y: 0, w: 1, h: 10 } }] }) });
    await bad({ spec: sample({ blocks: [{ id: 'b1', type: 'heading', props: {}, layout: { x: 0.8, y: 0, w: 0.5, h: 10 } }] }) });
    await bad({ spec: sample({ blocks: [{ id: 'b1', type: 'heading', props: {}, layout: { x: 0, y: 0, w: 1, h: 10 } }, { id: 'b1', type: 'heading', props: {}, layout: { x: 0, y: 0, w: 1, h: 10 } }] }) });
    await bad({ spec: sample({ collections: { Bad: { fields: [] } } }) });
    await bad({ spec: sample({ collections: { c: { fields: [{ id: 'a', type: 'magic' }] } } }) });
    await bad({ spec: sample({ collections: { c: { fields: [{ id: 'a', type: 'text' }, { id: 'a', type: 'text' }] } } }) });
    await bad({ id: 'ghost' }, 404);
    await bad({ id: 'kbju' }, 404);
    container.close();
});

test('конструктор: пакет .bmmodule с пользовательским блоком переносится между установками', async () => {
    const first = app();
    const block = { type: 'counter', title: { en: 'Counter' }, group: 'data', size: { w: 0.25, h: 80 }, props: [{ name: 'label', type: 'string' }] };
    fs.mkdirSync(path.join(first.blocks, 'counter'), { recursive: true });
    fs.writeFileSync(path.join(first.blocks, 'counter', 'block.json'), JSON.stringify(block));
    fs.writeFileSync(path.join(first.blocks, 'counter', 'render.js'), 'export default class Counter {}');
    const spec = sample({ blocks: [{ id: 'b1', type: 'counter', props: { label: 'x' }, layout: { x: 0, y: 0, w: 0.25, h: 80 } }] });
    const saved = await first.call('builder:save', { title: 'Counting', spec });
    assert.ok(fs.existsSync(path.join(first.modules, saved.id, 'blocks', 'counter', 'render.js')));
    await first.call('builder:export', { id: saved.id });
    const bundle = JSON.parse(first.system.saved[0].content);
    assert.equal(bundle.format, 'biomashine-module');
    assert.deepEqual(bundle.requires, ['counter']);
    assert.equal(bundle.blocks[0].files['render.js'], 'export default class Counter {}');
    first.container.close();

    const second = app();
    const info = await second.call('builder:inspect', { data: bundle });
    assert.deepEqual(info.blocks.map((item) => [item.type, item.installed]), [['counter', false]]);
    const result = await second.call('builder:import', { data: bundle });
    assert.deepEqual(result.installedBlocks, ['counter']);
    assert.ok(fs.existsSync(path.join(second.blocks, 'counter', 'render.js')));
    assert.ok((await second.call('blocks:list')).some((item) => item.type === 'counter' && item.source === 'user'));
    assert.equal((await second.call('builder:load', { id: result.id })).spec.blocks[0].type, 'counter');
    await rejects(second.call('builder:import', { data: { format: 'x' } }), 400);
    await rejects(second.call('builder:inspect', { data: { ...bundle, blocks: [{ type: 'Bad Type', files: {} }] } }), 400);
    await rejects(second.call('builder:import', { data: { ...bundle, blocks: [{ type: 'evil', files: { 'block.json': '{}', 'render.js': 'x', 'steal.js': 'y' } }] } }), 400);
    second.container.close();
});

const load = (...parts) => import(pathToFileURL(path.join(__dirname, '..', 'src', 'renderer', ...parts)).href);

test('рантайм блоков: вычисления, шина, хранилища, загрузчик', async () => {
    const { BlockMath } = await load('blocks', 'runtime', 'BlockMath.js');
    const { BlockBus } = await load('blocks', 'runtime', 'BlockBus.js');
    const { BlockStore } = await load('blocks', 'runtime', 'BlockStore.js');
    const { MemoryStore } = await load('blocks', 'runtime', 'MemoryStore.js');
    const { BlockLoader } = await load('blocks', 'runtime', 'BlockLoader.js');
    const records = [{ kg: 80, createdAt: '2026-11-01 10:00:00' }, { kg: 82, createdAt: '2026-11-03 10:00:00' }, { kg: 'x', createdAt: '2026-11-04 10:00:00' }];
    assert.equal(BlockMath.aggregate(records, 'kg', 'count'), 3);
    assert.equal(BlockMath.aggregate(records, 'kg', 'sum'), 162);
    assert.equal(BlockMath.aggregate(records, 'kg', 'avg'), 81);
    assert.equal(BlockMath.aggregate(records, 'kg', 'min'), 80);
    assert.equal(BlockMath.aggregate(records, 'kg', 'max'), 82);
    assert.equal(BlockMath.aggregate(records, 'kg', 'last'), 82);
    assert.equal(BlockMath.aggregate([], 'kg', 'avg'), 0);
    assert.equal(BlockMath.aggregate(records, 'kg', 'nope'), 0);
    assert.equal(BlockMath.round(1.23456), 1.23);
    const clock = { today: () => '2026-11-04', now: () => new Date(2026, 10, 4) };
    assert.equal(BlockMath.periodStart(clock, 'today'), '2026-11-04');
    assert.equal(BlockMath.periodStart(clock, '7d'), '2026-10-29');
    assert.equal(BlockMath.periodStart(clock, '30d'), '2026-10-06');
    assert.equal(BlockMath.periodStart(clock, 'all'), null);
    assert.equal(BlockMath.filter(records, '2026-11-03').length, 2);

    const bus = new BlockBus();
    const seen = [];
    const stop = bus.subscribe((id, value) => seen.push([id, value]));
    bus.registerField('a', { form: 'f', field: 'x' });
    bus.registerField('b', { form: 'g', field: 'y' });
    bus.publish('a', 5);
    assert.equal(bus.value('a'), 5);
    assert.deepEqual(bus.fields('f').map((field) => field.field), ['x']);
    stop();
    bus.publish('a', 6);
    assert.deepEqual(seen, [['a', 5]]);
    bus.unregister('a');
    assert.deepEqual(bus.fields('f'), []);
    assert.equal(bus.value('a'), undefined);

    const store = new MemoryStore({ clock: { timestamp: () => '2026-11-04 10:00:00' } });
    let changes = 0;
    store.onChange('w', () => (changes += 1));
    const id = await store.insert('w', { kg: 70 });
    await store.insert('w', { kg: 71 });
    assert.equal((await store.list('w')).length, 2);
    await store.remove('w', id);
    assert.deepEqual((await store.list('w')).map((record) => record.kg), [71]);
    assert.equal(changes, 3);

    const calls = [];
    const bm = { storage: { list: async (name) => (calls.push(name), [{ id: 1, data: { kg: 70 }, createdAt: '2026-11-04 09:00:00' }]), insert: async () => 7, remove: async () => {} } };
    const real = new BlockStore(bm);
    assert.deepEqual(await real.list('weight'), [{ kg: 70, id: 1, createdAt: '2026-11-04 09:00:00' }]);
    assert.deepEqual(calls, ['c-weight']);
    assert.equal(await real.insert('weight', {}), 7);

    const imports = [];
    const loader = new BlockLoader({
        doc: { createElement: () => ({}), head: { append: () => {} } },
        manifests: [{ type: 'heading', source: 'system' }, { type: 'counter', source: 'user' }],
        systemBase: 'bm://app/blocks/', userBase: 'bm://m/blocks/', allowUser: () => false,
        importer: async (url) => (imports.push(url), { default: class {} })
    });
    assert.ok(await loader.load('heading'));
    await assert.rejects(loader.load('counter'), /not available/);
    await assert.rejects(loader.load('missing'), /not available/);
    loader.allowUser = () => true;
    assert.ok(await loader.load('counter'));
    assert.deepEqual(imports, ['bm://app/blocks/heading/render.js', 'bm://m/blocks/counter/render.js']);
});

test('конструктор (интерфейс): состояние спецификации', async () => {
    const { BuilderState } = await load('modules', 'builder', 'js', 'BuilderState.js');
    const state = new BuilderState(16);
    const heading = { type: 'heading', size: { w: 1, h: 56 }, props: [{ name: 'text', default: 'Title' }, { name: 'list', default: ['a'] }] };
    const first = state.addBlock(heading);
    const second = state.addBlock(heading);
    assert.deepEqual([first, second, state.selected], ['b1', 'b2', 'b2']);
    assert.equal(state.block('b1').layout.y, 16);
    assert.equal(state.block('b2').layout.y, 88);
    state.block('b1').props.list.push('z');
    assert.deepEqual(state.block('b2').props.list, ['a']);
    state.setProps('b1', { text: 'Hi' });
    state.setLayout('b2', { x: 0.1, y: 100, w: 0.5, h: 60 });
    assert.equal(state.block('b1').props.text, 'Hi');
    assert.deepEqual(state.block('b2').layout, { x: 0.1, y: 100, w: 0.5, h: 60 });
    assert.equal(state.bottom(), 160);
    assert.equal(state.addCollection('weight', 'Weight'), true);
    assert.equal(state.addCollection('weight', 'Again'), false);
    assert.equal(state.addCollection('Bad Id', 'x'), false);
    assert.equal(state.addField('weight', { id: 'kg', type: 'number' }), true);
    assert.equal(state.addField('weight', { id: 'kg', type: 'text' }), false);
    assert.equal(state.addField('weight', { id: 'mood', type: 'select', options: ['ok'] }), true);
    assert.deepEqual(state.fieldsOf('weight').map((field) => field.id), ['kg', 'mood']);
    state.removeField('weight', 'kg');
    assert.deepEqual(state.fieldsOf('weight').map((field) => field.id), ['mood']);
    const spec = state.toSpec();
    state.removeBlock('b2');
    assert.equal(state.selected, null);
    assert.equal(spec.blocks.length, 2);
    const loaded = new BuilderState(16);
    loaded.load(spec);
    assert.equal(loaded.addBlock(heading), 'b3');
    loaded.removeCollection('weight');
    assert.deepEqual(loaded.fieldsOf('weight'), []);
});

test('руководство по блокам: пример блока проходит проверку реестра', () => {
    const ConfigService = require('../src/main/core/ConfigService');
    const BlockRegistry = require('../src/main/services/BlockRegistry');
    const registry = new BlockRegistry({ config: new ConfigService(path.join(__dirname, '..', 'config')), systemDir: null, userDir: path.join(__dirname, '..', 'docs', 'en', 'ai', 'examples', 'blocks') });
    const list = registry.list();
    assert.deepEqual(list.map((block) => [block.type, block.source]), [['counter', 'user']]);
    assert.deepEqual(registry.problems, []);
    const guide = fs.readFileSync(path.join(__dirname, '..', 'docs', 'en', 'ai', 'BLOCK_GUIDE.md'), 'utf8');
    assert.ok(guide.includes('export default class CounterBlock') && !guide.includes('__EXAMPLE__'));
});
