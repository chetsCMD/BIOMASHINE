CREATE TABLE IF NOT EXISTS operations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel TEXT NOT NULL,
    module TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS operation_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation_id INTEGER NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
    table_name TEXT NOT NULL,
    row_id INTEGER NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('insert', 'update', 'delete')),
    before TEXT,
    after TEXT
);

CREATE INDEX IF NOT EXISTS idx_operation_entries_operation
    ON operation_entries (operation_id);
