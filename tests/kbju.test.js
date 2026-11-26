const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { createApp } = require('./helpers');
const { FakeDocument } = require('./support/FakeDom');
const { createFakeBm } = require('./support/FakeBm');

const root = path.join(__dirname, '..');
const moduleDir = path.join(root, 'src', 'renderer', 'modules', 'kbju');
const load = (file) => import(pathToFileURL(path.join(moduleDir, 'js', file)).href);
const config = JSON.parse(fs.readFileSync(path.join(root, 'config', 'kbju.json'), 'utf8'));

test('КБЖУ: формулы совпадают со старой страницей', async () => {
    const { KbjuCalculator } = await load('KbjuCalculator.js');
    const calculator = new KbjuCalculator(config);
    assert.equal(calculator.bmr(80, 180, 30), 1780);
    const levels = [[0, 'activity.sedentary'], [2, 'activity.light'], [3, 'activity.medium'], [4, 'activity.medium'], [5, 'activity.high'], [6, 'activity.high'], [7, 'activity.veryHigh'], [14, 'activity.veryHigh']];
    for (const [trainings, title] of levels) {
        assert.equal(calculator.activityFor(trainings).titleKey, title, `тренировок: ${trainings}`);
    }
    const result = calculator.calculate({ weight: 80, height: 180, age: 30, trainings: 3, thermicEffect: false });
    assert.deepEqual(result.calories, { loss: 2345, maintain: 2759, gain: 3172 });
    assert.deepEqual(result.activity, { trainings: 3, titleKey: 'activity.medium' });
    const plain = Object.fromEntries(result.nutrients.map((item) => [item.key, [item.min, item.max, item.average]]));
    assert.deepEqual(plain, { protein: [128, 176, 152], fat: [64, 80, 72], carbs: [400, 800, 600] });
    const thermic = Object.fromEntries(calculator.nutrients(80, true).map((item) => [item.key, [item.min, item.max, item.average]]));
    assert.deepEqual(thermic, { protein: [160, 220, 190], fat: [65, 81, 73], carbs: [428, 856, 642] });
    assert.deepEqual(calculator.nutrients(80, false)[0].norm, { min: 1.6, max: 2.2 });
    assert.deepEqual(calculator.missing({ weight: null, height: 0, age: 25, trainings: null }), ['missing.weight', 'missing.height', 'missing.trainings']);
    assert.equal(calculator.calculate({ weight: null, height: 180, age: 30, trainings: 3 }), null);
    assert.equal(calculator.calculate({ weight: 80, height: 180, age: 30, trainings: null }), null);
    assert.notEqual(calculator.calculate({ weight: 80, height: 180, age: 30, trainings: 0 }), null);
});

test('КБЖУ: страница без предупреждения и без внешних ресурсов', () => {
    const html = fs.readFileSync(path.join(moduleDir, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(moduleDir, 'module.css'), 'utf8');
    assert.ok(!/warning|ПРЕДУПРЕЖДЕНИЕ|долбо/i.test(html + css));
    assert.ok(!/https?:\/\//.test(html + css + fs.readFileSync(path.join(moduleDir, 'js', 'KbjuView.js'), 'utf8').replace(/http:\/\/www\.w3\.org\/2000\/svg/, '')));
    assert.ok(!/flagcdn/.test(html));
});

test('КБЖУ: сквозной сценарий с настоящим бэкендом', async () => {
    const { call, container } = createApp();
    const { KbjuModule } = await load('KbjuModule.js');
    await call('measurements:save', { date: '2026-10-01', weight: 82 });
    await call('measurements:save', { date: '2026-11-01', weight: 80 });
    await call('profile:updateParams', { height: 180, age: 30, trainings_count: 3 });
    const doc = new FakeDocument();
    const pills = [];
    const bm = await createFakeBm({ call, scope: 'kbju', channels: ['profile:*'], extra: { setPills: (items) => pills.push(items) } });
    await new KbjuModule(bm, doc).start();
    assert.equal(doc.getElementById('user-height').value, 180);
    assert.equal(doc.getElementById('user-trainings').value, 3);
    assert.equal(doc.getElementById('bmr-value').textContent, 1780);
    assert.equal(doc.getElementById('calories-maintain').textContent, 2759);
    assert.equal(doc.getElementById('activity-text').textContent, '3 тренировки — Средняя активность');
    assert.deepEqual(pills.at(-1), ['01.11.2026', '2 замера']);
    const grid = doc.getElementById('nutrient-grid');
    assert.equal(grid.children.length, 3);
    assert.match(grid.children[0].text(), /Белки\s+128-176 г\s+1\.6-2\.2 г\/кг\s+~152 г\/день/);
    const carbsIcon = grid.children[2].children[0].children[0];
    assert.equal(carbsIcon.attributes['aria-label'], 'Флаг Польши');
    assert.equal(grid.children[0].children[0].textContent, '🥩');

    const toggle = doc.getElementById('tep-toggle');
    toggle.checked = true;
    await toggle.fire('change');
    assert.match(grid.children[0].text(), /160-220 г/);

    doc.getElementById('user-trainings').value = '0';
    doc.getElementById('user-age').value = '';
    await doc.getElementById('save-params-btn').fire('click');
    assert.equal(doc.getElementById('param-status').className, 'param-status error');
    assert.equal(doc.getElementById('param-status').textContent, 'Заполните все поля');
    assert.equal((await call('profile:get')).trainings_count, 3);

    doc.getElementById('user-age').value = '31';
    doc.getElementById('user-height').value = '181';
    await doc.getElementById('save-params-btn').fire('click');
    assert.equal(doc.getElementById('param-status').className, 'param-status success');
    const saved = await call('profile:get');
    assert.deepEqual([saved.height, saved.age, saved.trainings_count], [181, 31, 0]);
    assert.equal(doc.getElementById('activity-text').textContent, '0 тренировок — Сидячий и малоподвижный');
    assert.equal(doc.getElementById('bmr-value').textContent, 1782);

    doc.getElementById('user-height').value = '-5';
    await doc.getElementById('save-params-btn').fire('click');
    assert.equal(doc.getElementById('param-status').textContent, 'Ошибка при сохранении');
    clearTimeout(0);
    container.close();
});

test('КБЖУ: без замеров показываются прочерки и нет падений', async () => {
    const { call, container } = createApp();
    const { KbjuModule } = await load('KbjuModule.js');
    const doc = new FakeDocument();
    const pills = [];
    const bm = await createFakeBm({ call, scope: 'kbju', channels: ['profile:*'], extra: { setPills: (items) => pills.push(items) } });
    await new KbjuModule(bm, doc).start();
    assert.deepEqual(pills.at(-1), ['—', '0 замеров']);
    assert.equal(doc.getElementById('nutrient-grid').children.length, 0);
    container.close();
});

test('КБЖУ: без замера веса страница объясняет, чего не хватает, и пропадает подсказка после появления веса', async () => {
    const { call, container } = createApp();
    const { KbjuModule } = await load('KbjuModule.js');
    const doc = new FakeDocument();
    const bm = await createFakeBm({ call, scope: 'kbju', channels: ['profile:*'] });
    await new KbjuModule(bm, doc).start();
    const missing = doc.getElementById('kbju-missing');
    assert.match(missing.textContent, /не хватает замера веса \(добавьте его на странице «Вес»\)/);
    assert.equal(missing.className, 'kbju-missing visible');
    doc.getElementById('user-height').value = '175';
    doc.getElementById('user-age').value = '25';
    doc.getElementById('user-trainings').value = '3';
    await doc.getElementById('save-params-btn').fire('click');
    assert.equal(doc.getElementById('param-status').className, 'param-status success');
    assert.match(missing.textContent, /замера веса/);
    assert.ok(!/роста|возраста|числа тренировок/.test(missing.textContent));
    assert.equal(doc.getElementById('bmr-value').textContent, '');
    await call('measurements:save', { date: '2026-11-02', weight: 70 });
    await new KbjuModule(bm, doc).start();
    assert.equal(missing.className, 'kbju-missing');
    assert.equal(doc.getElementById('bmr-value').textContent, 1674);
    container.close();
});
