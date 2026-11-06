const BaseRepository = require('../core/BaseRepository');
const Values = require('../core/Values');

class MoodRepository extends BaseRepository {
    static SCALES = ['anxiety', 'fear', 'sadness', 'anger', 'energy', 'tension', 'motivation', 'stress'];

    list() {
        return this.queryAll(
            `SELECT id, date, time, mood, anxiety, fear, sadness, anger, energy, tension, motivation, stress, comment
             FROM mood_entries ORDER BY date DESC`
        );
    }

    upsert(entry) {
        const scales = MoodRepository.SCALES.map((name) => Values.orNull(entry[name]));
        this.exec(
            `INSERT INTO mood_entries (date, time, mood, anxiety, fear, sadness, anger, energy, tension, motivation, stress, comment)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(date) DO UPDATE SET
                time = excluded.time, mood = excluded.mood, anxiety = excluded.anxiety, fear = excluded.fear,
                sadness = excluded.sadness, anger = excluded.anger, energy = excluded.energy, tension = excluded.tension,
                motivation = excluded.motivation, stress = excluded.stress, comment = excluded.comment,
                created_at = bm_now()`,
            entry.date,
            entry.time,
            entry.mood,
            ...scales,
            Values.orNull(entry.comment)
        );
    }

    remove(id) {
        return this.exec('DELETE FROM mood_entries WHERE id = ?', id).changes;
    }
}

module.exports = MoodRepository;
