const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

const moduleDir = path.join(__dirname, '..', 'src', 'renderer', 'modules', 'running');
const load = (file) => import(pathToFileURL(path.join(moduleDir, 'js', file)).href);

test('running: форматирование и разбор времени', async () => {
    const { RunningCalculator } = await load('RunningCalculator.js');
    const calc = new RunningCalculator();
    assert.equal(calc.formatTimeToString(0), '0 мин 0 сек');
    assert.equal(calc.formatTimeToString(60), '1 мин 0 сек');
    assert.equal(calc.formatTimeToString(3661), '1 ч 1 мин');
    assert.equal(calc.parseTimeToSeconds('35:20'), 2120);
    assert.equal(calc.parseTimeToSeconds('1:00:00'), 3600);
    assert.equal(calc.parseTimeToSeconds('3600'), 0);
});

test('running: подсчёт итогов совпадает со старой страницей', async () => {
    const { RunningCalculator } = await load('RunningCalculator.js');
    const calc = new RunningCalculator();
    const runs = [
        { time_seconds: 1800, distance: 5, calories: 300, start_speed: 8, max_speed: 12, incline: 2 },
        { time_seconds: 2400, distance: 7, calories: 400, start_speed: 9, max_speed: 13, incline: 3 }
    ];
    const totals = calc.totals(runs);
    assert.equal(totals.totalTime, 4200);
    assert.equal(totals.totalDistance, 12);
    assert.equal(totals.totalCalories, 700);
    assert.equal(totals.maxTime, 2400);
    assert.equal(totals.maxDistance, 7);
    assert.equal(totals.avgCalories, 350);
    assert.equal(totals.count, 2);
});

test('running: прогресс цели по дистанции', async () => {
    const { RunningCalculator } = await load('RunningCalculator.js');
    const calc = new RunningCalculator();
    const runs = [
        { date: '2026-01-10', distance: 5 },
        { date: '2026-01-20', distance: 7 },
        { date: '2026-02-15', distance: 10 }
    ];
    const goal = { target: 20, deadline: '2026-01-31' };
    const result = calc.goalProgress(goal, runs, '2026-01-01', 'distance');
    assert.equal(result.current, 12);
    assert.equal(result.progress, 60);
});

test('running: достижения по суммарной дистанции', async () => {
    const { RunningCalculator } = await load('RunningCalculator.js');
    const calc = new RunningCalculator();
    const list = [
        { id: 'a', name: 'A', description: 'a', required: 10 },
        { id: 'b', name: 'B', description: 'b', required: 100 }
    ];
    const result = calc.achievements(list, 12);
    assert.equal(result[0].unlocked, true);
    assert.equal(result[1].unlocked, false);
    assert.equal(result[0].progress, 12);
});
