const BaseRepository = require('../core/BaseRepository');

class NutritionRepository extends BaseRepository {
    list() {
        return this.queryAll(
            'SELECT id, date, name, weight, calories, protein, fat, carbs FROM nutrition_logs ORDER BY date DESC, created_at DESC, id DESC'
        );
    }

    add({ date, name, weight, calories, protein, fat, carbs }) {
        return this.exec(
            'INSERT INTO nutrition_logs (date, name, weight, calories, protein, fat, carbs) VALUES (?, ?, ?, ?, ?, ?, ?)',
            date,
            name,
            weight,
            calories,
            protein,
            fat,
            carbs
        ).lastInsertRowid;
    }

    remove(id) {
        return this.exec('DELETE FROM nutrition_logs WHERE id = ?', id).changes;
    }
}

module.exports = NutritionRepository;
