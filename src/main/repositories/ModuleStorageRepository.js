const BaseRepository = require('../core/BaseRepository');

class ModuleStorageRepository extends BaseRepository {
    static COLUMNS = 'id, data, created_at, updated_at';

    map(row) {
        return { id: row.id, data: JSON.parse(row.data), createdAt: row.created_at, updatedAt: row.updated_at };
    }

    list(moduleId, collection) {
        return this.queryAll(
            `SELECT ${ModuleStorageRepository.COLUMNS} FROM module_documents WHERE module_id = ? AND collection = ? ORDER BY id`,
            moduleId,
            collection
        ).map((row) => this.map(row));
    }

    get(moduleId, collection, id) {
        const row = this.queryOne(
            `SELECT ${ModuleStorageRepository.COLUMNS} FROM module_documents WHERE module_id = ? AND collection = ? AND id = ?`,
            moduleId,
            collection,
            id
        );
        return row ? this.map(row) : null;
    }

    insert(moduleId, collection, data) {
        return this.exec(
            'INSERT INTO module_documents (module_id, collection, data) VALUES (?, ?, ?)',
            moduleId,
            collection,
            JSON.stringify(data)
        ).lastInsertRowid;
    }

    update(moduleId, collection, id, data) {
        return this.exec(
            `UPDATE module_documents SET data = ?, updated_at = bm_now()
             WHERE module_id = ? AND collection = ? AND id = ?`,
            JSON.stringify(data),
            moduleId,
            collection,
            id
        ).changes;
    }

    remove(moduleId, collection, id) {
        return this.exec('DELETE FROM module_documents WHERE module_id = ? AND collection = ? AND id = ?', moduleId, collection, id).changes;
    }

    clear(moduleId, collection) {
        return this.exec('DELETE FROM module_documents WHERE module_id = ? AND collection = ?', moduleId, collection).changes;
    }
}

module.exports = ModuleStorageRepository;
