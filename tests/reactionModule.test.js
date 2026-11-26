const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');
const { createApp } = require('./helpers');
const { createFakeBm } = require('./support/FakeBm');
const { FakeDocument, FakeChart } = require('./support/FakeDom');

const load = (...parts) => import(pathToFileURL(path.join(__dirname, '..', 'src', 'renderer', ...parts)).href);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('модуль «Реакция» целиком: тест, автосохранение, статистика, удаление', async () => {
    const { call, container } = createApp();
    const { ReactionModule } = await load('modules', 'reaction', 'js', 'ReactionModule.js');
    const doc = new FakeDocument();
    FakeChart.instances.length = 0;
    globalThis.window = { Chart: FakeChart };
    const fast = { stages: 2, waitMinMs: 1, waitMaxMs: 3, failDelayMs: 1, successDelayMs: 1, maxHistogramBins: 10, chartMaxTicks: 10 };
    const pills = [];
    const confirms = [];
    const bm = await createFakeBm({
        call,
        scope: 'reaction',
        channels: ['reaction:*'],
        configs: { reaction: fast },
        extra: { confirm: async (text) => (confirms.push(text), true), setPills: (items) => pills.push(items) }
    });
    await new ReactionModule(bm, doc).start();
    assert.equal(doc.getElementById('main-text').textContent, 'Нажмите, чтобы начать');
    assert.equal(doc.getElementById('sub-text').textContent, 'этап 0 / 2');
    assert.match(doc.getElementById('history-list').text(), /Нет сохранённых тестов/);

    const box = doc.getElementById('reaction-box');
    await box.fire('click');
    for (let stage = 0; stage < 2; stage += 1) {
        await box.fire('click');
        for (let attempt = 0; attempt < 100 && !box.className.includes('go'); attempt += 1) {
            await wait(2);
        }
        assert.ok(box.className.includes('go'), 'экран не стал зелёным');
        await box.fire('click');
        await wait(10);
    }
    for (let attempt = 0; attempt < 100 && (await call('reaction:list')).length === 0; attempt += 1) {
        await wait(5);
    }
    const saved = await call('reaction:list');
    assert.equal(saved.length, 1);
    assert.equal(saved[0].values.length, 2);
    await wait(10);
    assert.equal(doc.getElementById('save-status').className, 'save-status success');
    assert.match(doc.getElementById('stats-grid').text(), /Тестов\s+1/);
    assert.equal(doc.getElementById('history-list').children.length, 1);
    assert.equal(pills.at(-1)[1], '1 тест');
    assert.ok(FakeChart.instances.some((chart) => !chart.destroyed && chart.config.type === 'line'));

    const remove = doc.getElementById('history-list').find((node) => node.className === 'delete-btn')[0];
    await remove.fire('click');
    assert.deepEqual(confirms, ['Удалить результат?']);
    assert.equal((await call('reaction:list')).length, 0);
    assert.match(doc.getElementById('history-list').text(), /Нет сохранённых тестов/);

    await doc.getElementById('start-test-btn').fire('click');
    await doc.getElementById('reset-test-btn').fire('click');
    assert.equal(doc.getElementById('main-text').textContent, 'Нажмите, чтобы начать');
    delete globalThis.window;
    container.close();
});
