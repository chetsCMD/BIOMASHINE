const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { createApp } = require('./helpers');
const { FakeDocument } = require('./support/FakeDom');

const moduleDir = path.join(__dirname, '..', 'src', 'renderer', 'modules', 'nutrition');
const load = (file) => import(pathToFileURL(path.join(moduleDir, 'js', file)).href);
const config = () => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'nutrition.json'), 'utf8'));

test('nutrition: расчёт КБЖУ по весу порции', async () => {
    const { NutritionCalculator } = await load('NutritionCalculator.js');
    const calculator = new NutritionCalculator(config());
    const result = calculator.calculateNutrition(50, 100, 200, 10, 5, 20);
    assert.equal(result.calories, 100);
    assert.equal(result.protein, 5);
    assert.equal(result.fat, 2.5);
    assert.equal(result.carbs, 10);
});

test('nutrition: расчёт при perPortion = 0', async () => {
    const { NutritionCalculator } = await load('NutritionCalculator.js');
    const calculator = new NutritionCalculator(config());
    const result = calculator.calculateNutrition(100, 0, 200, 10, 5, 20);
    assert.equal(result.calories, 200);
});

test('nutrition: суммирование приёмов пищи', async () => {
    const { NutritionCalculator } = await load('NutritionCalculator.js');
    const calculator = new NutritionCalculator(config());
    const stats = calculator.getTotalStats([
        { calories: 100, protein: 10, fat: 5, carbs: 20, weight: 50 },
        { calories: 200, protein: 20, fat: 10, carbs: 40, weight: 100 }
    ]);
    assert.equal(stats.calories, 300);
    assert.equal(stats.count, 2);
    assert.equal(stats.weight, 150);
});

test('nutrition: форматирование веса', async () => {
    const { NutritionCalculator } = await load('NutritionCalculator.js');
    const calculator = new NutritionCalculator(config());
    assert.equal(calculator.formatWeight(500), '500.0 г');
    assert.equal(calculator.formatWeight(1500), '1.50 кг');
    assert.equal(calculator.formatWeight(2000000), '2.00 т');
});

test('nutrition: сохранение и чтение через настоящий бэкенд', async () => {
    const { call, container } = createApp();
    const { NutritionModule } = await load('NutritionModule.js');
    const doc = new FakeDocument();
    const bm = {
        config: (name) => call('config:get', { name }),
        invoke: (channel, payload) => call(channel, payload),
        confirm: async () => true,
        setPills: () => {},
        onTheme: () => {},
        theme: { chart: { text: '#aaa', grid: '#333' } }
    };
    await new NutritionModule(bm, doc).start();
    doc.getElementById('food-name').value = 'Яблоко';
    doc.getElementById('food-weight').value = '100';
    doc.getElementById('food-calories').value = '50';
    doc.getElementById('food-protein').value = '0.5';
    doc.getElementById('food-fat').value = '0.2';
    doc.getElementById('food-carbs').value = '12';
    doc.getElementById('food-per-portion').value = '100';
    await doc.getElementById('add-food-btn').fire('click');
    const list = await call('nutrition:list');
    assert.equal(list.length, 1);
    assert.equal(list[0].name, 'Яблоко');
    assert.equal(list[0].calories, 50);
    assert.match(doc.getElementById('today-meals-list').text(), /Яблоко/);
    container.close();
});

test('nutrition: пустая база', async () => {
    const { call, container } = createApp();
    const { NutritionModule } = await load('NutritionModule.js');
    const doc = new FakeDocument();
    const bm = {
        config: (name) => call('config:get', { name }),
        invoke: (channel, payload) => call(channel, payload),
        confirm: async () => true,
        setPills: () => {},
        onTheme: () => {},
        theme: { chart: { text: '#aaa', grid: '#333' } }
    };
    await new NutritionModule(bm, doc).start();
    assert.match(doc.getElementById('today-meals-list').text(), /Нет приёмов пищи за сегодня/);
    container.close();
});
