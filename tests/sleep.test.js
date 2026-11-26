const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { createApp } = require('./helpers');
const { FakeDocument } = require('./support/FakeDom');

const moduleDir = path.join(__dirname, '..', 'src', 'renderer', 'modules', 'sleep');
const configPath = path.join(__dirname, '..', 'config', 'sleep.json');
const load = (file) => import(pathToFileURL(path.join(moduleDir, 'js', file)).href);
const readConfig = () => JSON.parse(fs.readFileSync(configPath, 'utf8'));

test('sleep: расчёты совпадают со старой страницей', async () => {
    const { SleepStats } = await load('SleepStats.js');
    const stats = new SleepStats(readConfig());

    assert.equal(stats.calcDuration('2026-01-01T22:00:00', '2026-01-02T06:00:00'), 8);
    assert.equal(stats.formatDurationHours(8), '8 ч 0 мин');
    assert.equal(stats.formatDurationHours(8.5), '8 ч 30 мин');

    assert.equal(stats.colorClassForDuration(8), 'good');
    assert.equal(stats.colorClassForDuration(9), 'good');
    assert.equal(stats.colorClassForDuration(6), 'warning');
    assert.equal(stats.colorClassForDuration(7), 'warning');
    assert.equal(stats.colorClassForDuration(5), 'bad');

    const schedule = { bedtime: '22:00', waketime: '06:00' };
    assert.equal(stats.isIdealSleep(
        { start_time: '2026-01-01 21:30:00', end_time: '2026-01-02 06:30:00' },
        schedule
    ), true);
    assert.equal(stats.isIdealSleep(
        { start_time: '2026-01-01 19:30:00', end_time: '2026-01-02 05:00:00' },
        schedule
    ), false);
    assert.equal(stats.isIdealSleep(
        { start_time: '2026-01-01 21:30:00', end_time: '2026-01-02 06:30:00' },
        { bedtime: null, waketime: null }
    ), false);
});

test('sleep: агрегация и рекорды', async () => {
    const { SleepStats } = await load('SleepStats.js');
    const stats = new SleepStats(readConfig());

    const logs = [
        { id: 1, start_time: '2026-01-01 22:00:00', end_time: '2026-01-02 06:00:00' },
        { id: 2, start_time: '2026-01-02 22:00:00', end_time: '2026-01-03 04:00:00' }
    ];
    const map = stats.buildDayMap(logs, []);
    assert.equal(map.size, 2);
    assert.equal(map.get('2026-01-01').totalDuration, 8);
    assert.equal(map.get('2026-01-02').totalDuration, 6);
    assert.equal(stats.uniqueDayCount(logs, []), 2);

    const noSleep = ['2026-01-03'];
    const map2 = stats.buildDayMap(logs, noSleep);
    assert.equal(map2.size, 3);
    assert.equal(map2.get('2026-01-03').totalDuration, 0);
    assert.equal(map2.get('2026-01-03').sessions.length, 0);

    const schedule = { bedtime: '22:00', waketime: '06:00' };
    const records = stats.records(logs, [], map, new Map());
    assert.equal(records.isEmpty, false);
    assert.equal(records.longestSingleDuration, 8);
    assert.equal(records.longestSingleDate, '2026-01-01');
    assert.equal(records.longestInterruptedDuration, 8);
    assert.equal(records.longestInterruptedDate, '2026-01-01');
    assert.equal(records.maxWakeHours, 16);
    assert.equal(records.maxWakeDate, '2026-01-02');
    assert.match(records.totalHoursPercent, /% от всего времени/);

    const summary = stats.summary(map, schedule);
    assert.equal(summary.days, 2);
    assert.equal(summary.avgDuration, 7);
    assert.equal(summary.matchCount, 2);

    const empty = stats.records([], [], new Map(), new Map());
    assert.equal(empty.isEmpty, true);
});

test('sleep: сохранение и чтение через настоящий бэкенд', async () => {
    const { call, container } = createApp();
    const { SleepModule } = await load('SleepModule.js');
    const doc = new FakeDocument();
    const bm = {
        config: (name) => call('config:get', { name }),
        invoke: (channel, payload) => call(channel, payload),
        confirm: async () => true,
        setPills: () => {},
        onTheme: () => {},
        theme: { chart: { text: '#aaa', grid: '#333' } }
    };
    await new SleepModule(bm, doc).start();
    doc.getElementById('sleep-start').value = '2026-01-01T22:00';
    doc.getElementById('sleep-end').value = '2026-01-02T06:00';
    await doc.getElementById('add-sleep-btn').fire('click');
    const logs = await call('sleep:listLogs');
    assert.equal(logs.length, 1);
    assert.equal(logs[0].start_time.slice(0, 10), '2026-01-01');
    container.close();
});

test('sleep: сброс графика очищает поля и скрывает зависимые блоки', async () => {
    const { call, container } = createApp();
    const { SleepModule } = await load('SleepModule.js');
    const doc = new FakeDocument();
    const bm = {
        config: (name) => call('config:get', { name }),
        invoke: (channel, payload) => call(channel, payload),
        confirm: async () => true,
        setPills: () => {},
        onTheme: () => {},
        theme: { chart: { text: '#aaa', grid: '#333' } }
    };
    await call('sleep:saveSchedule', { ideal_bedtime: '22:00', ideal_waketime: '06:00' });
    await new SleepModule(bm, doc).start();
    assert.equal(doc.getElementById('ideal-bedtime').value, '22:00:00');
    await doc.getElementById('reset-schedule-btn').fire('click');
    assert.equal(doc.getElementById('ideal-bedtime').value, '');
    assert.equal(doc.getElementById('ideal-waketime').value, '');
    const after = await call('sleep:getSchedule');
    assert.equal(after.ideal_bedtime, null);
    assert.equal(after.ideal_waketime, null);
    container.close();
});
