const BaseRepository = require('../core/BaseRepository');

class NotificationRepository extends BaseRepository {
    insert(record) {
        const info = this.exec(
            `INSERT INTO notifications (module, title, body, kind, at, repeat_type, repeat_time, repeat_weekdays, next_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            record.module,
            record.title,
            record.body || null,
            record.kind,
            record.at || null,
            record.repeatType || null,
            record.repeatTime || null,
            record.repeatWeekdays ? JSON.stringify(record.repeatWeekdays) : null,
            record.nextAt
        );
        return Number(info.lastInsertRowid);
    }

    removeById(id) {
        this.exec('DELETE FROM notifications WHERE id = ?', id);
    }

    listForModule(module) {
        return this.queryAll('SELECT * FROM notifications WHERE module = ? ORDER BY next_at, id', module);
    }

    listAll() {
        return this.queryAll('SELECT * FROM notifications ORDER BY next_at, id');
    }

    dueAt(timestamp) {
        return this.queryAll('SELECT * FROM notifications WHERE next_at <= ? ORDER BY next_at, id', timestamp);
    }

    updateNextAt(id, nextAt) {
        this.exec('UPDATE notifications SET next_at = ? WHERE id = ?', nextAt, id);
    }

    countForModule(module) {
        const row = this.queryOne('SELECT COUNT(*) AS count FROM notifications WHERE module = ?', module);
        return Number(row.count);
    }

    distinctModules() {
        return this.queryAll('SELECT DISTINCT module FROM notifications');
    }
}

module.exports = NotificationRepository;
