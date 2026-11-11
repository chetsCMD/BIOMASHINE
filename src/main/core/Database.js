const fs = require('fs');
const path = require('path');
const BetterSqlite = require('better-sqlite3');

class Database {
    constructor(filePath) {
        this.filePath = filePath;
        this.connection = null;
    }

    open() {
        if (this.filePath !== ':memory:') {
            fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
        }
        this.connection = new BetterSqlite(this.filePath);
        this.connection.pragma('journal_mode = WAL');
        this.connection.pragma('foreign_keys = ON');
        this.registerNow(() => new Date().toISOString().slice(0, 19).replace('T', ' '));
        return this;
    }

    registerNow(provider) {
        this.connection.function('bm_now', { deterministic: false }, provider);
    }

    useClock(clock) {
        this.registerNow(() => clock.timestamp());
    }

    transaction(work) {
        return this.connection.transaction(work)();
    }

    transactionDeferred(work) {
        const runner = this.connection.transaction(() => {
            this.connection.pragma('defer_foreign_keys = ON');
            return work();
        });
        return runner();
    }

    close() {
        if (this.connection) {
            this.connection.close();
            this.connection = null;
        }
    }
}

module.exports = Database;
