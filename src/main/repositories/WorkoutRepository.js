const BaseRepository = require('../core/BaseRepository');
const Values = require('../core/Values');

class WorkoutRepository extends BaseRepository {
    list() {
        const workouts = this.queryAll(
            `SELECT id, date, start_time, end_time, type, note FROM workouts
             ORDER BY date DESC, (start_time IS NULL) DESC, start_time DESC, id DESC`
        );
        const exercises = this.queryAll(
            'SELECT id, workout_id, exercise_name, sets, reps, weight, note FROM workout_exercises ORDER BY id'
        );
        const grouped = new Map();
        for (const { workout_id, ...exercise } of exercises) {
            if (!grouped.has(workout_id)) {
                grouped.set(workout_id, []);
            }
            grouped.get(workout_id).push(exercise);
        }
        return workouts.map((workout) => ({ ...workout, exercises: grouped.get(workout.id) || [] }));
    }

    insertExercises(workoutId, exercises) {
        for (const exercise of exercises) {
            this.exec(
                'INSERT INTO workout_exercises (workout_id, exercise_name, sets, reps, weight, note) VALUES (?, ?, ?, ?, ?, ?)',
                workoutId,
                exercise.exercise_name,
                exercise.sets,
                exercise.reps,
                Values.orNull(exercise.weight),
                Values.orNull(exercise.note)
            );
        }
    }

    create({ date, start_time, end_time, type, note, exercises }) {
        return this.transaction(() => {
            const id = this.exec(
                'INSERT INTO workouts (date, start_time, end_time, type, note) VALUES (?, ?, ?, ?, ?)',
                date,
                start_time,
                end_time,
                type,
                Values.orNull(note)
            ).lastInsertRowid;
            this.insertExercises(id, exercises);
            return id;
        });
    }

    update(id, { date, start_time, end_time, type, note, exercises }) {
        this.transaction(() => {
            this.exec(
                'UPDATE workouts SET date = ?, start_time = ?, end_time = ?, type = ?, note = ? WHERE id = ?',
                date,
                start_time,
                end_time,
                type,
                Values.orNull(note),
                id
            );
            this.exec('DELETE FROM workout_exercises WHERE workout_id = ?', id);
            this.insertExercises(id, exercises);
        });
    }

    remove(id) {
        return this.exec('DELETE FROM workouts WHERE id = ?', id).changes;
    }

    listTemplates() {
        const templates = this.queryAll('SELECT id, name FROM workout_templates');
        const exercises = this.queryAll('SELECT id, template_id, exercise_name, sets, reps FROM template_exercises ORDER BY id');
        const grouped = new Map();
        for (const { template_id, ...exercise } of exercises) {
            if (!grouped.has(template_id)) {
                grouped.set(template_id, []);
            }
            grouped.get(template_id).push(exercise);
        }
        return Values.byName(templates.map((template) => ({ ...template, exercises: grouped.get(template.id) || [] })));
    }

    createTemplate(name, exercises) {
        return this.transaction(() => {
            const id = this.exec('INSERT INTO workout_templates (name) VALUES (?)', name).lastInsertRowid;
            for (const exercise of exercises) {
                this.exec(
                    'INSERT INTO template_exercises (template_id, exercise_name, sets, reps) VALUES (?, ?, ?, ?)',
                    id,
                    exercise.exercise_name,
                    exercise.sets,
                    exercise.reps
                );
            }
            return id;
        });
    }

    removeTemplate(id) {
        return this.exec('DELETE FROM workout_templates WHERE id = ?', id).changes;
    }

    getGoals() {
        const weekly = this.queryOne('SELECT weekly_target FROM training_goals WHERE id = 1');
        const exerciseGoals = this.queryAll('SELECT exercise_name, target_reps, target_weight FROM exercise_goals ORDER BY id');
        return { weekly_target: weekly ? weekly.weekly_target : null, exercise_goals: exerciseGoals };
    }

    saveGoals(weeklyTarget, exerciseGoals) {
        this.transaction(() => {
            if (weeklyTarget !== undefined && weeklyTarget !== null) {
                this.exec(
                    `INSERT INTO training_goals (id, weekly_target) VALUES (1, ?)
                     ON CONFLICT(id) DO UPDATE SET weekly_target = excluded.weekly_target`,
                    weeklyTarget
                );
            } else {
                this.exec('DELETE FROM training_goals WHERE id = 1');
            }
            this.exec('DELETE FROM exercise_goals');
            for (const goal of exerciseGoals || []) {
                this.exec(
                    'INSERT OR REPLACE INTO exercise_goals (exercise_name, target_reps, target_weight) VALUES (?, ?, ?)',
                    goal.exercise_name,
                    Values.orNull(goal.target_reps),
                    Values.orNull(goal.target_weight)
                );
            }
        });
    }
}

module.exports = WorkoutRepository;
