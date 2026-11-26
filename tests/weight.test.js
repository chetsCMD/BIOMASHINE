const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { createApp } = require('./helpers');
const { FakeDocument } = require('./support/FakeDom');

const moduleDir = path.join(__dirname, '..', 'src', 'renderer', 'modules', 'weight');
const load = (file) => import(pathToFileURL(path.join(moduleDir, 'js', file)).href);

test('weight: расчет классификаций и идеального веса', async () => {
    const { WeightCalculator } = await load('WeightCalculator.js');
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'weight.json'), 'utf8'));
    const calc = new WeightCalculator(config);

    assert.deepEqual(calc.bmiLabel(22), { l: 'Норма', q: 'good' });
    assert.deepEqual(calc.bmiLabel(31), { l: 'Ожирение I ст.', q: 'bad' });
    assert.deepEqual(calc.fatLabel(10, 25), { l: 'Спортивная норма', q: 'good' });
    assert.deepEqual(calc.fatLabel(18, 16), { l: 'Предел нормы', q: 'warn' });
    assert.deepEqual(calc.waterLabel(60), { l: 'Идеал', q: 'good' });
    
    const iw = calc.idealWeights(180);
    assert.equal(iw.length, 4);
    assert.equal(iw[0].val, 80);
});

test('weight: сохранение и чтение через настоящий бэкенд', async () => {
    const { call, container } = createApp();
    const { WeightModule } = await load('WeightModule.js');
    const doc = new FakeDocument();
    const bm = {
        config: (name) => call('config:get', { name }),
        invoke: (channel, payload) => call(channel, payload),
        confirm: async () => true,
        setPills: () => {},
        onTheme: () => {},
        theme: { chart: { text: '#aaa', grid: '#333' } }
    };
    
    global.window = { Chart: class { destroy() {} } };

    await new WeightModule(bm, doc).start();
    
    doc.getElementById('new-date').value = '01.01.2026';
    doc.getElementById('new-weight').value = '80.5';
    await doc.getElementById('add-measurement-btn').fire('click');
    
    const list = await call('measurements:list');
    assert.equal(list.length, 1);
    assert.equal(list[0].weight, 80.5);
    
    assert.match(doc.getElementById('hero').text(), /80.5/);
    container.close();
});
