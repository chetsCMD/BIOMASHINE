const BaseRepository = require('../core/BaseRepository');
const Values = require('../core/Values');

class MeasurementRepository extends BaseRepository {
    list() {
        return this.queryAll('SELECT date, weight, fat, water FROM measurements ORDER BY date');
    }

    upsert({ date, weight, fat, water }) {
        this.exec(
            `INSERT INTO measurements (date, weight, fat, water) VALUES (?, ?, ?, ?)
             ON CONFLICT(date) DO UPDATE SET weight = excluded.weight, fat = excluded.fat, water = excluded.water`,
            date,
            weight,
            Values.orNull(fat),
            Values.orNull(water)
        );
    }

    remove(date) {
        return this.exec('DELETE FROM measurements WHERE date = ?', date).changes;
    }

    getGoals() {
        const row = this.queryOne('SELECT weight_goal, fat_goal, deadline FROM weight_goals WHERE id = 1');
        return row || { weight_goal: null, fat_goal: null, deadline: null };
    }

    saveGoals({ weight_goal, fat_goal, deadline }) {
        this.exec(
            `INSERT INTO weight_goals (id, weight_goal, fat_goal, deadline) VALUES (1, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET weight_goal = excluded.weight_goal, fat_goal = excluded.fat_goal, deadline = excluded.deadline`,
            Values.orNull(weight_goal),
            Values.orNull(fat_goal),
            Values.orNull(deadline)
        );
    }
}

module.exports = MeasurementRepository;
