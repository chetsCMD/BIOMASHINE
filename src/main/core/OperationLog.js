const AppError = require('./AppError');

const EXCLUDED_TABLES = new Set([
    'settings',
    'operations',
    'operation_entries',
    '_operation_context',
    'schema_migrations',
    'migrations'
]);

function quoteIdent(name) {
    return `"${String(name).replace(/"/g, '""')}"`;
}

function quoteLiteral(value) {
    return `'${String(value).replace(/'/g, "''")}'`;
}

function sameValue(a, b) {
    if (a === null || a === undefined) return b === null || b === undefined;
    if (b === null || b === undefined) return false;
    if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b);
    if (typeof a === 'string' || typeof b === 'string') return String(a) === String(b);
    return a === b;
}

function sameRow(current, expected) {
    if (!current || !expected) return false;
    for (const key of Object.keys(expected)) {
        if (!sameValue(current[key], expected[key])) return false;
    }
    return true;
}

function statusError(status, key, params) {
    return new AppError(key, params, status);
}

class OperationLog {
    constructor(database, options = {}) {
        this.database = database;
        this.connection = database.connection;
        this.max = Number.isInteger(options.max) && options.max > 0 ? options.max : 10;
        this.operations = options.operations || {};
        this.pkMap = new Map();
    }

    install() {
        this.connection.exec(`
            CREATE TABLE IF NOT EXISTS _operation_context (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                operation_id INTEGER
            );
            INSERT OR IGNORE INTO _operation_context (id, operation_id) VALUES (1, NULL);
            UPDATE _operation_context SET operation_id = NULL WHERE id = 1;
        `);
        for (const { name } of this.listTables()) {
            if (this.shouldSkip(name)) continue;
            const pk = this.singlePk(name);
            if (!pk) continue;
            this.pkMap.set(name, pk);
            this.createTriggers(name, pk);
        }
        return this;
    }

    listTables() {
        return this.connection.prepare(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
        ).all();
    }

    shouldSkip(name) {
        return EXCLUDED_TABLES.has(name);
    }

    columnInfo(tableName) {
        return this.connection.pragma(`table_info(${quoteIdent(tableName)})`);
    }

    singlePk(tableName) {
        const columns = this.columnInfo(tableName);
        const primary = columns.filter((column) => column.pk > 0);
        if (primary.length !== 1) return null;
        return primary[0].name;
    }

    createTriggers(tableName, pkColumn) {
        const columns = this.columnInfo(tableName).map((column) => column.name);
        const table = quoteIdent(tableName);
        const pk = quoteIdent(pkColumn);
        const suffix = tableName.replace(/[^A-Za-z0-9_]/g, '_');
        const newImage = columns.map((column) => `${quoteLiteral(column)}, NEW.${quoteIdent(column)}`).join(', ');
        const oldImage = columns.map((column) => `${quoteLiteral(column)}, OLD.${quoteIdent(column)}`).join(', ');
        const contextFilter = 'FROM _operation_context WHERE _operation_context.id = 1 AND _operation_context.operation_id IS NOT NULL';

        const insertSql = `
            CREATE TRIGGER IF NOT EXISTS ${quoteIdent(`bm_log_insert_${suffix}`)}
            AFTER INSERT ON ${table}
            BEGIN
                INSERT INTO operation_entries (operation_id, table_name, row_id, kind, before, after)
                SELECT _operation_context.operation_id, ${quoteLiteral(tableName)}, NEW.${pk}, 'insert', NULL, json_object(${newImage})
                ${contextFilter};
            END
        `;
        const updateSql = `
            CREATE TRIGGER IF NOT EXISTS ${quoteIdent(`bm_log_update_${suffix}`)}
            AFTER UPDATE ON ${table}
            BEGIN
                INSERT INTO operation_entries (operation_id, table_name, row_id, kind, before, after)
                SELECT _operation_context.operation_id, ${quoteLiteral(tableName)}, NEW.${pk}, 'update', json_object(${oldImage}), json_object(${newImage})
                ${contextFilter};
            END
        `;
        const deleteSql = `
            CREATE TRIGGER IF NOT EXISTS ${quoteIdent(`bm_log_delete_${suffix}`)}
            AFTER DELETE ON ${table}
            BEGIN
                INSERT INTO operation_entries (operation_id, table_name, row_id, kind, before, after)
                SELECT _operation_context.operation_id, ${quoteLiteral(tableName)}, OLD.${pk}, 'delete', json_object(${oldImage}), NULL
                ${contextFilter};
            END
        `;
        this.connection.exec(insertSql);
        this.connection.exec(updateSql);
        this.connection.exec(deleteSql);
    }

    extractModule(channel, payload) {
        if (channel.startsWith('storage:')) {
            return payload && payload.module ? String(payload.module) : null;
        }
        const prefix = channel.split(':')[0];
        return prefix || null;
    }

    begin(channel, payload = {}) {
        const module = this.extractModule(channel, payload);
        const info = this.connection.prepare(
            'INSERT INTO operations (channel, module, created_at) VALUES (?, ?, bm_now())'
        ).run(channel, module);
        const id = Number(info.lastInsertRowid);
        this.connection.prepare('UPDATE _operation_context SET operation_id = ? WHERE id = 1').run(id);
        return id;
    }

    commit(operationId) {
        const row = this.connection.prepare(
            'SELECT COUNT(*) AS c FROM operation_entries WHERE operation_id = ?'
        ).get(operationId);
        this.connection.prepare('UPDATE _operation_context SET operation_id = NULL WHERE id = 1').run();
        if (!row || row.c === 0) {
            this.connection.prepare('DELETE FROM operations WHERE id = ?').run(operationId);
            return null;
        }
        this.trim();
        return operationId;
    }

    abort(operationId) {
        this.connection.prepare('UPDATE _operation_context SET operation_id = NULL WHERE id = 1').run();
        this.connection.prepare('DELETE FROM operations WHERE id = ?').run(operationId);
    }

    trim() {
        const excess = this.connection.prepare(
            'SELECT id FROM operations ORDER BY id DESC LIMIT -1 OFFSET ?'
        ).all(this.max);
        const remove = this.connection.prepare('DELETE FROM operations WHERE id = ?');
        for (const row of excess) remove.run(row.id);
    }

    list() {
        const rows = this.connection.prepare(`
            SELECT o.id, o.channel, o.module, o.created_at,
                (SELECT COUNT(*) FROM operation_entries e WHERE e.operation_id = o.id) AS entry_count
            FROM operations o
            ORDER BY o.id DESC
        `).all();
        return rows.map((row) => ({
            id: row.id,
            channel: row.channel,
            label: this.buildLabel(row.channel, row.module),
            at: row.created_at,
            entries: row.entry_count
        }));
    }

    buildLabel(channel, module) {
        const base = (this.operations && this.operations[channel]) || `trash.${channel.replace(/:/g, '.')}`;
        if (channel.startsWith('storage:') && module) {
            return `${base}:${module}`;
        }
        return base;
    }

    undo(operationId) {
        const operation = this.connection.prepare('SELECT id FROM operations WHERE id = ?').get(operationId);
        if (!operation) throw statusError(404, 'trash.operationNotFound', { id: operationId });
        const entries = this.connection.prepare(
            'SELECT * FROM operation_entries WHERE operation_id = ? ORDER BY id DESC'
        ).all(operationId);
        return this.database.transactionDeferred(() => {
            let restored = 0;
            for (const entry of entries) {
                restored += this.applyEntry(entry);
            }
            this.connection.prepare('DELETE FROM operations WHERE id = ?').run(operationId);
            return restored;
        });
    }

    applyEntry(entry) {
        const tableName = entry.table_name;
        const pk = this.pkMap.get(tableName);
        if (!pk) throw statusError(500, 'trash.unknownTable', { table: tableName });
        const table = quoteIdent(tableName);
        const pkIdent = quoteIdent(pk);
        const selectCurrent = this.connection.prepare(`SELECT * FROM ${table} WHERE ${pkIdent} = ?`);

        if (entry.kind === 'insert') {
            const expected = entry.after ? JSON.parse(entry.after) : null;
            const current = selectCurrent.get(entry.row_id);
            if (!current) throw statusError(409, 'trash.rowMissing', { table: tableName, id: entry.row_id });
            if (!sameRow(current, expected)) throw statusError(409, 'trash.rowChanged', { table: tableName, id: entry.row_id });
            this.connection.prepare(`DELETE FROM ${table} WHERE ${pkIdent} = ?`).run(entry.row_id);
            return 1;
        }
        if (entry.kind === 'update') {
            const expected = entry.after ? JSON.parse(entry.after) : null;
            const current = selectCurrent.get(entry.row_id);
            if (!current) throw statusError(409, 'trash.rowAbsent', { table: tableName, id: entry.row_id });
            if (!sameRow(current, expected)) throw statusError(409, 'trash.rowChanged', { table: tableName, id: entry.row_id });
            const before = entry.before ? JSON.parse(entry.before) : {};
            const columns = Object.keys(before);
            const assignments = columns.map((column) => `${quoteIdent(column)} = ?`).join(', ');
            const values = columns.map((column) => before[column]);
            this.connection.prepare(`UPDATE ${table} SET ${assignments} WHERE ${pkIdent} = ?`).run(...values, entry.row_id);
            return 1;
        }
        if (entry.kind === 'delete') {
            const current = selectCurrent.get(entry.row_id);
            if (current) throw statusError(409, 'trash.rowExists', { table: tableName, id: entry.row_id });
            const before = entry.before ? JSON.parse(entry.before) : {};
            const columns = Object.keys(before);
            const names = columns.map((column) => quoteIdent(column)).join(', ');
            const placeholders = columns.map(() => '?').join(', ');
            const values = columns.map((column) => before[column]);
            this.connection.prepare(`INSERT INTO ${table} (${names}) VALUES (${placeholders})`).run(...values);
            return 1;
        }
        throw statusError(500, 'trash.unknownKind', { kind: entry.kind });
    }
}

module.exports = OperationLog;