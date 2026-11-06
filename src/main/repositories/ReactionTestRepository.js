const BaseRepository = require('../core/BaseRepository');
const Values = require('../core/Values');

class ReactionTestRepository extends BaseRepository {
    list() {
        return this.queryAll('SELECT id, date, samples, average FROM reaction_tests ORDER BY date DESC, id DESC').map(
            ({ samples, ...row }) => ({ ...row, values: Values.json(samples) })
        );
    }

    add(values, average) {
        return this.exec('INSERT INTO reaction_tests (samples, average) VALUES (?, ?)', JSON.stringify(values), average).lastInsertRowid;
    }

    remove(id) {
        this.exec('DELETE FROM reaction_tests WHERE id = ?', id);
    }
}

module.exports = ReactionTestRepository;
