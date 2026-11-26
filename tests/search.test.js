const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp, rejects } = require('./helpers');

test('поиск: находит записи по всему приложению без учёта регистра и диакритики', async () => {
    const { call, container } = createApp();
    await call('nutrition:add', { date: '2026-11-01', name: 'Гречка', weight: 100 });
    await call('nutrition:add', { date: '2026-11-01', name: 'Café au lait', weight: 200 });
    await call('measurements:save', { date: '2026-11-02', weight: 82.5 });
    const find = async (text) => (await call('search:query', { text })).results;

    const buckwheat = await find('ГРЕЧКА');
    assert.deepEqual(buckwheat.map((item) => [item.kind, item.module, item.table, item.title]), [['record', 'nutrition', 'nutrition_logs', 'Гречка']]);
    assert.ok(buckwheat[0].fields.includes('name'));
    assert.equal((await find('cafe'))[0].title, 'Café au lait');
    assert.equal((await find('au LAIT')).length, 1);
    assert.deepEqual(await find('гречка cafe'), []);
    const weight = await find('82.5');
    assert.deepEqual(weight.map((item) => [item.module, item.table]), [['weight', 'measurements']]);
    assert.equal(weight[0].rowId > 0, true);
    assert.deepEqual(await find('zzzнет'), []);
    assert.deepEqual(await find('a'), []);
    assert.deepEqual(await find('   '), []);
    container.close();
});

test('поиск: модули, ограничения, служебные таблицы и проверка запроса', async () => {
    const { call, container } = createApp();
    const modules = await call('modules:list');
    const sleep = modules.find((module) => module.id === 'sleep');
    const byModule = (await call('search:query', { text: sleep.title.slice(0, 3) })).results.filter((item) => item.kind === 'module');
    assert.ok(byModule.some((item) => item.module === 'sleep' && item.title === sleep.title));

    for (let index = 0; index < 12; index += 1) {
        await call('nutrition:add', { date: '2026-11-01', name: `apple ${index}`, weight: 50 });
    }
    const apples = await call('search:query', { text: 'apple' });
    assert.equal(apples.results.filter((item) => item.table === 'nutrition_logs').length, 8);
    assert.equal(apples.truncated, false);

    await call('auth:setup', { login: 'topsecretlogin', password: 'abcd' });
    assert.deepEqual((await call('search:query', { text: 'topsecretlogin' })).results, []);
    await rejects(call('search:query', { text: 5 }), 400);
    await rejects(call('search:query', { text: 'x'.repeat(201) }), 400);
    await call('auth:lock');
    await rejects(call('search:query', { text: 'apple' }), 401);
    container.close();
});

test('поиск: снимки страниц находят вычисляемые значения, которых нет в базе', async () => {
    const { call, container } = createApp();
    const find = async (text) => (await call('search:query', { text })).results;
    assert.deepEqual(await find('1874'), []);
    await call('search:snapshot', { module: 'kbju', lines: ['1874 ккал/день', 'Основной обмен', '1874'] });
    const found = await find('1874');
    assert.deepEqual(found.map((item) => [item.kind, item.module, item.title]), [['page', 'kbju', '1874 ккал/день'], ['page', 'kbju', '1874']]);
    assert.equal((await find('ОСНОВНОЙ обмен'))[0].title, 'Основной обмен');
    await call('search:snapshot', { module: 'kbju', lines: ['другое значение'] });
    assert.deepEqual(await find('1874'), []);
    await rejects(call('search:snapshot', { module: 'nope', lines: ['x'] }), 400);
    await rejects(call('search:snapshot', { module: 'kbju', lines: 'x' }), 400);
    await rejects(call('search:snapshot', { module: 'kbju', lines: [5] }), 400);
    await rejects(call('search:snapshot', { module: 'kbju', lines: ['x'.repeat(201)] }), 400);
    container.close();
});
