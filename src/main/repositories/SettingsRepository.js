const BaseRepository = require('../core/BaseRepository');

class SettingsRepository extends BaseRepository {
    get(key) {
        const row = this.queryOne('SELECT value FROM settings WHERE key = ?', key);
        return row ? JSON.parse(row.value) : null;
    }

    set(key, value) {
        this.exec(
            'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
            key,
            JSON.stringify(value)
        );
    }

    remove(key) {
        this.exec('DELETE FROM settings WHERE key = ?', key);
    }

    all() {
        const result = {};
        for (const row of this.queryAll('SELECT key, value FROM settings ORDER BY key')) {
            result[row.key] = JSON.parse(row.value);
        }
        return result;
    }
}

module.exports = SettingsRepository;
