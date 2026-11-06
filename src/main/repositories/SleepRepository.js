const BaseRepository = require('../core/BaseRepository');

class SleepRepository extends BaseRepository {
    listLogs() {
        return this.queryAll('SELECT id, start_time, end_time FROM sleep_logs ORDER BY start_time DESC, id DESC');
    }

    addLog(startTime, endTime) {
        return this.exec('INSERT INTO sleep_logs (start_time, end_time) VALUES (?, ?)', startTime, endTime).lastInsertRowid;
    }

    removeLog(id) {
        this.exec('DELETE FROM sleep_logs WHERE id = ?', id);
    }

    countLogsOnDay(day) {
        return this.queryOne('SELECT COUNT(*) AS total FROM sleep_logs WHERE date(start_time) = ?', day).total;
    }

    getSchedule() {
        const row = this.queryOne('SELECT ideal_bedtime, ideal_waketime FROM sleep_schedule WHERE id = 1');
        return row || { ideal_bedtime: null, ideal_waketime: null };
    }

    saveSchedule(bedtime, waketime) {
        this.exec(
            `INSERT INTO sleep_schedule (id, ideal_bedtime, ideal_waketime) VALUES (1, ?, ?)
             ON CONFLICT(id) DO UPDATE SET ideal_bedtime = excluded.ideal_bedtime, ideal_waketime = excluded.ideal_waketime`,
            bedtime,
            waketime
        );
    }

    resetSchedule() {
        this.exec('DELETE FROM sleep_schedule WHERE id = 1');
    }

    listNoSleepDays() {
        return this.queryAll('SELECT date FROM no_sleep_days ORDER BY date').map((row) => row.date);
    }

    addNoSleepDay(day) {
        this.exec('INSERT OR IGNORE INTO no_sleep_days (date) VALUES (?)', day);
    }

    removeNoSleepDay(day) {
        return this.exec('DELETE FROM no_sleep_days WHERE date = ?', day).changes;
    }
}

module.exports = SleepRepository;
