const fs = require('fs');
const path = require('path');

class Migrator {
    constructor(database, migrationsDir) {
        this.database = database;
        this.migrationsDir = migrationsDir;
    }

    files() {
        return fs.readdirSync(this.migrationsDir)
            .filter((name) => /^\d+_.+\.sql$/.test(name))
            .sort();
    }

    run() {
        const connection = this.database.connection;
        const current = connection.pragma('user_version', { simple: true });
        for (const file of this.files()) {
            const version = parseInt(file.split('_')[0], 10);
            if (version <= current) {
                continue;
            }
            const sql = fs.readFileSync(path.join(this.migrationsDir, file), 'utf8');
            this.database.transaction(() => {
                connection.exec(sql);
                connection.pragma(`user_version = ${version}`);
            });
        }
    }
}

module.exports = Migrator;
