class BaseRepository {
    constructor(database) {
        this.database = database;
    }

    get connection() {
        return this.database.connection;
    }

    queryAll(sql, ...params) {
        return this.connection.prepare(sql).all(...params);
    }

    queryOne(sql, ...params) {
        return this.connection.prepare(sql).get(...params);
    }

    exec(sql, ...params) {
        return this.connection.prepare(sql).run(...params);
    }

    transaction(work) {
        return this.database.transaction(work);
    }
}

module.exports = BaseRepository;
