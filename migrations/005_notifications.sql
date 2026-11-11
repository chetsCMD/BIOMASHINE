CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    module TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    kind TEXT NOT NULL,
    at TEXT,
    repeat_type TEXT,
    repeat_time TEXT,
    repeat_weekdays TEXT,
    next_at TEXT NOT NULL,
    created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_notifications_next_at ON notifications(next_at);
CREATE INDEX IF NOT EXISTS idx_notifications_module ON notifications(module);

CREATE TRIGGER IF NOT EXISTS notifications_created_at
AFTER INSERT ON notifications
BEGIN
    UPDATE notifications SET created_at = bm_now() WHERE id = NEW.id;
END;
