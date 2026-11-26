const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp, rejects } = require('./helpers');

const exercises = [
    { exercise_name: 'Жим лёжа', sets: 3, reps: 8, weight: 60 },
    { exercise_name: 'Подтягивания', sets: 4, reps: 10 }
];

test('тренировки: создание, чтение, обновление, удаление', async () => {
    const { call, container } = createApp();
    await rejects(call('workouts:create', { date: '2026-03-01', type: 'gym', exercises: [] }), 400);
    const { id } = await call('workouts:create', { date: '2026-03-01', start_time: '18:00:00', type: 'gym', exercises });
    await call('workouts:create', { date: '2026-03-01', type: 'home', exercises: [exercises[1]] });
    const list = await call('workouts:list');
    assert.equal(list.length, 2);
    const gym = list.find((w) => w.id === id);
    assert.equal(gym.start_time, '18:00');
    assert.equal(gym.exercises.length, 2);
    assert.equal(gym.exercises[1].weight, null);
    await call('workouts:update', { id, date: '2026-03-02', type: 'gym', exercises: [exercises[0]] });
    const updated = (await call('workouts:list')).find((w) => w.id === id);
    assert.equal(updated.date, '2026-03-02');
    assert.equal(updated.exercises.length, 1);
    await call('workouts:remove', { id });
    await rejects(call('workouts:remove', { id }), 404);
    container.close();
});

test('шаблоны и цели тренировок', async () => {
    const { call, container } = createApp();
    await rejects(call('workouts:createTemplate', { name: 'Грудь', exercises: [] }), 400);
    const { id } = await call('workouts:createTemplate', { name: 'Грудь', exercises: [{ exercise_name: 'Жим', sets: 3, reps: 8 }] });
    await call('workouts:createTemplate', { name: 'Альфа', exercises: [{ exercise_name: 'Присед', sets: 5, reps: 5 }] });
    const templates = await call('workouts:listTemplates');
    assert.deepEqual(templates.map((t) => t.name), ['Альфа', 'Грудь']);
    assert.equal(templates[1].exercises[0].exercise_name, 'Жим');
    await call('workouts:removeTemplate', { id });
    await rejects(call('workouts:removeTemplate', { id }), 404);
    assert.deepEqual(await call('workouts:getGoals'), { weekly_target: null, exercise_goals: [] });
    await call('workouts:saveGoals', {
        weekly_target: 4,
        exercise_goals: [{ exercise_name: 'Жим', target_reps: 10, target_weight: 80 }, { exercise_name: 'Жим', target_reps: 12 }]
    });
    const goals = await call('workouts:getGoals');
    assert.equal(goals.weekly_target, 4);
    assert.equal(goals.exercise_goals.length, 1);
    await call('workouts:saveGoals', { weekly_target: null, exercise_goals: [] });
    assert.deepEqual(await call('workouts:getGoals'), { weekly_target: null, exercise_goals: [] });
    container.close();
});
