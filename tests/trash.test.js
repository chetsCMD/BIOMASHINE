const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp, rejects } = require('./helpers');

class TestController {
    constructor(connection) {
        this.connection = connection;
        this.prefix = 'test';
    }

    routes() {
        return {
            addItem: (payload) => {
                const info = this.connection.prepare('INSERT INTO test_items (name) VALUES (?)').run(String(payload.name));
                return { id: Number(info.lastInsertRowid) };
            },
            renameItem: (payload) => {
                this.connection.prepare('UPDATE test_items SET name = ? WHERE id = ?').run(String(payload.name), Number(payload.id));
                return { ok: true };
            },
            removeItem: (payload) => {
                this.connection.prepare('DELETE FROM test_items WHERE id = ?').run(Number(payload.id));
                return { ok: true };
            },
            removeParent: (payload) => {
                this.connection.prepare('DELETE FROM test_parents WHERE id = ?').run(Number(payload.id));
                return { ok: true };
            }
        };
    }
}

function prepare(app) {
    app.container.auth.isUnlocked = () => true;
    const connection = app.container.database.connection;
    connection.exec(`
        CREATE TABLE IF NOT EXISTS test_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS test_parents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS test_children (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            parent_id INTEGER NOT NULL REFERENCES test_parents(id) ON DELETE CASCADE,
            name TEXT NOT NULL
        );
    `);
    app.container.operationLog.install();
    app.container.router.register(new TestController(connection));
    return app;
}

test('trash logs an insert and undo removes it', async () => {
    const app = prepare(createApp());
    const created = await app.call('test:addItem', { name: 'alpha' });
    const list = await app.call('trash:list');
    assert.equal(list.length, 1);
    assert.equal(list[0].channel, 'test:addItem');
    assert.equal(list[0].entries, 1);
    assert.equal(list[0].label, 'trash.test.addItem');
    const result = await app.call('trash:undo', { id: list[0].id });
    assert.equal(result.restored, 1);
    assert.equal(app.container.database.connection.prepare('SELECT COUNT(*) AS c FROM test_items').get().c, 0);
    assert.equal((await app.call('trash:list')).length, 0);
    assert.ok(created.id);
});

test('trash logs update and undo restores previous values', async () => {
    const app = prepare(createApp());
    const connection = app.container.database.connection;
    connection.prepare('INSERT INTO test_items (id, name) VALUES (?, ?)').run(1, 'original');
    await app.call('test:renameItem', { id: 1, name: 'updated' });
    const list = await app.call('trash:list');
    assert.equal(list.length, 1);
    assert.equal(list[0].entries, 1);
    await app.call('trash:undo', { id: list[0].id });
    assert.equal(connection.prepare('SELECT name FROM test_items WHERE id = 1').get().name, 'original');
});

test('trash logs delete and undo restores the row', async () => {
    const app = prepare(createApp());
    const connection = app.container.database.connection;
    connection.prepare('INSERT INTO test_items (id, name) VALUES (?, ?)').run(7, 'keep');
    await app.call('test:removeItem', { id: 7 });
    assert.equal(connection.prepare('SELECT COUNT(*) AS c FROM test_items').get().c, 0);
    const list = await app.call('trash:list');
    assert.equal(list[0].entries, 1);
    const result = await app.call('trash:undo', { id: list[0].id });
    assert.equal(result.restored, 1);
    assert.equal(connection.prepare('SELECT name FROM test_items WHERE id = 7').get().name, 'keep');
});

test('trash undo restores cascaded children with the parent', async () => {
    const app = prepare(createApp());
    const connection = app.container.database.connection;
    connection.prepare('INSERT INTO test_parents (id, name) VALUES (?, ?)').run(5, 'p');
    connection.prepare('INSERT INTO test_children (id, parent_id, name) VALUES (?, ?, ?)').run(1, 5, 'c1');
    connection.prepare('INSERT INTO test_children (id, parent_id, name) VALUES (?, ?, ?)').run(2, 5, 'c2');
    await app.call('test:removeParent', { id: 5 });
    assert.equal(connection.prepare('SELECT COUNT(*) AS c FROM test_children').get().c, 0);
    const list = await app.call('trash:list');
    assert.equal(list[0].entries, 3);
    const result = await app.call('trash:undo', { id: list[0].id });
    assert.equal(result.restored, 3);
    assert.equal(connection.prepare('SELECT COUNT(*) AS c FROM test_parents').get().c, 1);
    assert.equal(connection.prepare('SELECT COUNT(*) AS c FROM test_children').get().c, 2);
});

test('trash undo reports conflict when row changed after operation', async () => {
    const app = prepare(createApp());
    const connection = app.container.database.connection;
    const created = await app.call('test:addItem', { name: 'first' });
    const list = await app.call('trash:list');
    connection.prepare('UPDATE test_items SET name = ? WHERE id = ?').run('tampered', created.id);
    await rejects(app.call('trash:undo', { id: list[0].id }), 409);
    assert.equal(connection.prepare('SELECT name FROM test_items WHERE id = ?').get(created.id).name, 'tampered');
    assert.equal((await app.call('trash:list')).length, 1);
});

test('trash keeps only the ten most recent operations', async () => {
    const app = prepare(createApp());
    for (let index = 0; index < 12; index += 1) {
        await app.call('test:addItem', { name: `item-${index}` });
    }
    const list = await app.call('trash:list');
    assert.equal(list.length, 10);
    const connection = app.container.database.connection;
    assert.equal(connection.prepare('SELECT COUNT(*) AS c FROM operations').get().c, 10);
    assert.equal(connection.prepare('SELECT COUNT(*) AS c FROM operation_entries').get().c, 10);
});

test('trash undo validates identifier', async () => {
    const app = prepare(createApp());
    await rejects(app.call('trash:undo', { id: 'oops' }), 400);
    await rejects(app.call('trash:undo', { id: 999 }), 404);
});

test('trash label for storage channels includes module name', () => {
    const app = prepare(createApp());
    const label = app.container.operationLog.buildLabel('storage:add', 'running');
    assert.equal(label, 'trash.storage.add:running');
    assert.equal(app.container.operationLog.buildLabel('nutrition:add', null), 'trash.nutrition.add');
});

test('trash undo messages in English', async () => {
    const app = prepare(createApp({ systemLocale: 'ru-RU' }));
    await app.call('settings:set', { key: 'language', value: 'en' });

    const invalid = await rejects(app.call('trash:undo', { id: 'oops' }), 400);
    assert.match(invalid.message, /Invalid operation identifier/);

    const missing = await rejects(app.call('trash:undo', { id: 999 }), 404);
    assert.match(missing.message, /Operation not found: 999/);

    const connection = app.container.database.connection;
    const created = await app.call('test:addItem', { name: 'first' });
    const list = await app.call('trash:list');
    connection.prepare('UPDATE test_items SET name = ? WHERE id = ?').run('tampered', created.id);
    const conflict = await rejects(app.call('trash:undo', { id: list[0].id }), 409);
    assert.match(conflict.message, /has been changed/);
});