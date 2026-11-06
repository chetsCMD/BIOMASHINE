const BaseRepository = require('../core/BaseRepository');
const Values = require('../core/Values');

class RunningRepository extends BaseRepository {
    static GOAL_COLUMNS = {
        distance: ['distance_target', 'distance_deadline'],
        time: ['time_target', 'time_deadline'],
        calories: ['calories_target', 'calories_deadline']
    };

    list() {
        return this.queryAll(
            'SELECT id, date, time_seconds, distance, calories, start_speed, max_speed, incline FROM running_logs ORDER BY date DESC, id DESC'
        );
    }

    add({ date, time_seconds, distance, calories, start_speed, max_speed, incline }) {
        return this.exec(
            `INSERT INTO running_logs (date, time_seconds, distance, calories, start_speed, max_speed, incline)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            date,
            time_seconds,
            distance,
            Values.orNull(calories),
            Values.orNull(start_speed),
            Values.orNull(max_speed),
            Values.orNull(incline)
        ).lastInsertRowid;
    }

    remove(id) {
        return this.exec('DELETE FROM running_logs WHERE id = ?', id).changes;
    }

    getGoals() {
        const row = this.queryOne(
            `SELECT distance_target, distance_deadline, time_target, time_deadline, calories_target, calories_deadline
             FROM running_goals WHERE id = 1`
        );
        return row || {
            distance_target: null,
            distance_deadline: null,
            time_target: null,
            time_deadline: null,
            calories_target: null,
            calories_deadline: null
        };
    }

    saveGoal(goalType, target, deadline) {
        const columns = RunningRepository.GOAL_COLUMNS[goalType];
        if (!columns) {
            return false;
        }
        this.exec('INSERT OR IGNORE INTO running_goals (id) VALUES (1)');
        this.exec(`UPDATE running_goals SET ${columns[0]} = ?, ${columns[1]} = ? WHERE id = 1`, target, Values.orNull(deadline));
        return true;
    }
}

module.exports = RunningRepository;
