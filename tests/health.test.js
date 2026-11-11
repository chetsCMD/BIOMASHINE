const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp, rejects } = require('./helpers');

test('замеры: upsert по дате, цели, обзор', async () => {
    const { call, container } = createApp();
    await call('measurements:save', { date: '2026-03-01T10:00:00', weight: 80.5, fat: 20, water: '' });
    await call('measurements:save', { date: '2026-03-01', weight: 79.9 });
    await call('measurements:save', { date: '2026-03-05', weight: 79 });
    const list = await call('measurements:list');
    assert.equal(list.length, 2);
    assert.deepEqual(list[0], { date: '2026-03-01', weight: 79.9, fat: null, water: null });
    assert.deepEqual(await call('measurements:getGoals'), { weight_goal: null, fat_goal: null, deadline: null });
    await call('measurements:saveGoals', { weight_goal: 75, fat_goal: 15, deadline: '2026-12-31T00:00:00.000Z' });
    const overview = await call('profile:overview');
    assert.equal(overview.goals.deadline, '2026-12-31');
    assert.equal(overview.measurements.length, 2);
    await call('measurements:remove', { date: '2026-03-05' });
    await rejects(call('measurements:remove', { date: '2026-03-05' }), 404);
    container.close();
});

test('профиль: параметры', async () => {
    const { call, container } = createApp();
    await call('profile:updateParams', { height: 180, age: 30, trainings_count: 4 });
    assert.deepEqual(await call('profile:get'), { height: 180, age: 30, trainings_count: 4 });
    await rejects(call('profile:updateParams', { height: 'x', age: 1, trainings_count: 1 }), 400);
    await rejects(call('profile:updateParams', { height: 180, age: 30, trainings_count: -1 }), 400);
    await rejects(call('profile:updateParams', { height: 180, age: 30.5, trainings_count: 1 }), 400);
    await call('profile:updateParams', { height: 180, age: 30, trainings_count: 0 });
    assert.equal((await call('profile:get')).trainings_count, 0);
    container.close();
});

test('сон: логи, график, дни без сна', async () => {
    const { call, container } = createApp();
    const { id } = await call('sleep:addLog', { start_time: '2026-03-01T23:30', end_time: '2026-03-02T07:15' });
    const logs = await call('sleep:listLogs');
    assert.deepEqual(logs, [{ id, start_time: '2026-03-01 23:30:00', end_time: '2026-03-02 07:15:00' }]);
    await rejects(call('sleep:addLog', { start_time: '2026-03-02T08:00', end_time: '2026-03-02T07:00' }), 400);
    await rejects(call('sleep:addNoSleep', { date: '2026-03-01' }), 400, 'уже есть записи сна');
    await call('sleep:addNoSleep', { date: '2026-03-05' });
    await call('sleep:addNoSleep', { date: '2026-03-05' });
    assert.deepEqual(await call('sleep:listNoSleep'), ['2026-03-05']);
    await call('sleep:removeNoSleep', { date: '2026-03-05' });
    await rejects(call('sleep:removeNoSleep', { date: '2026-03-05' }), 404);
    assert.deepEqual(await call('sleep:getSchedule'), { ideal_bedtime: null, ideal_waketime: null });
    await call('sleep:saveSchedule', { ideal_bedtime: '23:00', ideal_waketime: '07:00:00' });
    await call('sleep:saveSchedule', { ideal_bedtime: '22:30', ideal_waketime: '06:30' });
    assert.deepEqual(await call('sleep:getSchedule'), { ideal_bedtime: '22:30:00', ideal_waketime: '06:30:00' });
    await call('sleep:resetSchedule');
    assert.deepEqual(await call('sleep:getSchedule'), { ideal_bedtime: null, ideal_waketime: null });
    await call('sleep:resetSchedule');
    await call('sleep:removeLog', { id });
    assert.equal((await call('sleep:listLogs')).length, 0);
    container.close();
});

test('питание и бег', async () => {
    const { call, container } = createApp();
    await rejects(call('nutrition:add', { date: '2026-03-01', name: '', weight: 100 }), 400);
    const { id } = await call('nutrition:add', { date: '2026-03-01', name: 'Овсянка', weight: 250, calories: 150, protein: 5 });
    const meals = await call('nutrition:list');
    assert.equal(meals[0].fat, 0);
    assert.equal(meals[0].name, 'Овсянка');
    await call('nutrition:remove', { id });
    await rejects(call('nutrition:remove', { id }), 404);

    await rejects(call('running:add', { date: '2026-03-01', distance: 5 }), 400);
    const run = await call('running:add', { date: '2026-03-01', time_seconds: 1800, distance: 5, calories: 400 });
    assert.equal((await call('running:list'))[0].start_speed, null);
    await call('running:saveGoal', { goal_type: 'distance', target: 100, deadline: '2026-06-01' });
    await call('running:saveGoal', { goal_type: 'time', target: 3600, deadline: null });
    const goals = await call('running:getGoals');
    assert.equal(goals.distance_target, 100);
    assert.equal(goals.distance_deadline, '2026-06-01');
    assert.equal(goals.time_target, 3600);
    assert.equal(goals.calories_target, null);
    await rejects(call('running:saveGoal', { goal_type: 'bad', target: 1 }), 400);
    await call('running:remove', { id: run.id });
    container.close();
});

test('настроение: одна запись на дату, реакция: значения как массив', async () => {
    const { call, container } = createApp();
    await call('mood:save', { date: '2026-03-01', time: '10:00', mood: 5, anxiety: 3 });
    await call('mood:save', { date: '2026-03-01', time: '21:00', mood: 8, comment: 'ок' });
    const entries = await call('mood:list');
    assert.equal(entries.length, 1);
    assert.equal(entries[0].mood, 8);
    assert.equal(entries[0].anxiety, null);
    await rejects(call('mood:save', { date: '2026-03-01', time: '10:00' }), 400);
    await call('reaction:add', { values: [250, 300, 280, 260, 270], average: 272 });
    const tests = await call('reaction:list');
    assert.deepEqual(tests[0].values, [250, 300, 280, 260, 270]);
    await call('reaction:remove', { id: tests[0].id });
    assert.equal((await call('reaction:list')).length, 0);
    container.close();
});

test('шаблоны тренировок сортируются по языку интерфейса', async () => {
    const { call, container } = createApp({ systemLocale: 'ru-RU' });
    await call('workouts:createTemplate', { name: 'Яблоко', exercises: [{ exercise_name: 'a', sets: 1, reps: 1 }] });
    await call('workouts:createTemplate', { name: 'Абрикос', exercises: [{ exercise_name: 'b', sets: 1, reps: 1 }] });
    await call('workouts:createTemplate', { name: 'Ёлка', exercises: [{ exercise_name: 'c', sets: 1, reps: 1 }] });
    const ru = (await call('workouts:listTemplates')).map((template) => template.name);
    assert.deepEqual(ru, ['Абрикос', 'Ёлка', 'Яблоко']);
    await call('settings:set', { key: 'language', value: 'en' });
    const en = (await call('workouts:listTemplates')).map((template) => template.name);
    const collator = new Intl.Collator('en-US');
    const expected = [...ru].sort((a, b) => collator.compare(a, b));
    assert.deepEqual(en, expected);
    container.close();
});

test('сообщения об ошибках на английском', async () => {
    const { call, container } = createApp({ systemLocale: 'ru-RU' });
    await call('settings:set', { key: 'language', value: 'en' });
    await rejects(call('measurements:save', {}), 400, 'Date and weight are required');
    await rejects(call('sleep:addLog', { start_time: '2026-03-02T08:00', end_time: '2026-03-02T07:00' }), 400, 'End time must be later than start time');
    await rejects(call('workouts:create', {}), 400, 'Date, type and at least one exercise are required');
    await rejects(call('profile:updateParams', { height: 'x', age: 1, trainings_count: 1 }), 400, 'Height and age must be positive integers');
    await rejects(call('nutrition:add', { date: '2026-03-01', name: '', weight: 100 }), 400, 'Name and weight are required');
    await rejects(call('mood:save', { date: '2026-03-01' }), 400, 'Date, time and mood are required');
    await rejects(call('reaction:add', {}), 400, 'Values and average are required');
    await rejects(call('running:add', { date: '2026-03-01' }), 400, 'Date, time and distance are required');
    await rejects(call('running:saveGoal', { goal_type: 'bad', target: 1 }), 400, 'Unknown goal type');
    await rejects(call('nutrition:remove', { id: 9999 }), 404, 'Record not found');
    await rejects(call('workouts:remove', { id: 9999 }), 404, 'Workout not found');
    container.close();
});