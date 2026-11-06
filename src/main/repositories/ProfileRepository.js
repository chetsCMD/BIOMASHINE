const BaseRepository = require('../core/BaseRepository');

class ProfileRepository extends BaseRepository {
    get() {
        return this.queryOne('SELECT height, age, trainings_count FROM profile WHERE id = 1');
    }

    ensure(defaults) {
        this.exec('INSERT OR IGNORE INTO profile (id, height, age, trainings_count) VALUES (1, ?, ?, ?)', defaults.height, defaults.age, defaults.trainings_count);
    }

    updateParams({ height, age, trainings_count }) {
        this.exec('UPDATE profile SET height = ?, age = ?, trainings_count = ? WHERE id = 1', height, age, trainings_count);
    }

}

module.exports = ProfileRepository;
