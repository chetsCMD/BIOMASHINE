CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE currencies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    rate_to_rub REAL NOT NULL
);

CREATE TABLE profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    height INTEGER NOT NULL,
    age INTEGER NOT NULL,
    trainings_count INTEGER NOT NULL,
    main_currency_id INTEGER REFERENCES currencies(id) ON DELETE SET NULL
);

CREATE TABLE measurements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    weight REAL NOT NULL,
    fat REAL,
    water REAL
);

CREATE TABLE weight_goals (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    weight_goal REAL,
    fat_goal REAL,
    deadline TEXT
);

CREATE TABLE sleep_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    CHECK (end_time > start_time)
);

CREATE TABLE sleep_schedule (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    ideal_bedtime TEXT NOT NULL,
    ideal_waketime TEXT NOT NULL
);

CREATE TABLE no_sleep_days (
    date TEXT PRIMARY KEY
);

CREATE TABLE nutrition_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    name TEXT NOT NULL,
    weight REAL NOT NULL,
    calories REAL NOT NULL,
    protein REAL NOT NULL,
    fat REAL NOT NULL,
    carbs REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE running_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    time_seconds INTEGER NOT NULL,
    distance REAL NOT NULL,
    calories REAL,
    start_speed REAL,
    max_speed REAL,
    incline REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE running_goals (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    distance_target REAL,
    distance_deadline TEXT,
    time_target INTEGER,
    time_deadline TEXT,
    calories_target REAL,
    calories_deadline TEXT
);

CREATE TABLE workouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    type TEXT NOT NULL CHECK (type IN ('home', 'gym')),
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE workout_exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    exercise_name TEXT NOT NULL,
    sets INTEGER NOT NULL,
    reps INTEGER NOT NULL,
    weight REAL,
    note TEXT
);

CREATE TABLE workout_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE template_exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
    exercise_name TEXT NOT NULL,
    sets INTEGER NOT NULL,
    reps INTEGER NOT NULL
);

CREATE TABLE training_goals (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    weekly_target INTEGER
);

CREATE TABLE exercise_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exercise_name TEXT NOT NULL UNIQUE,
    target_reps INTEGER,
    target_weight REAL
);

CREATE TABLE accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    currency_id INTEGER NOT NULL REFERENCES currencies(id) ON DELETE CASCADE
);

CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
);

CREATE TABLE transfer_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT
);

CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    amount REAL NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    comment TEXT,
    transfer_group_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE reaction_tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    samples TEXT NOT NULL,
    average REAL NOT NULL
);

CREATE TABLE pills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    dosage_mg REAL NOT NULL,
    equivalent_pills REAL NOT NULL,
    intake_timing TEXT NOT NULL CHECK (intake_timing IN ('before', 'after', 'any')),
    start_date TEXT NOT NULL,
    end_date TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    daily_intakes INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE pill_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pill_id INTEGER NOT NULL UNIQUE REFERENCES pills(id) ON DELETE CASCADE,
    schedule_type TEXT NOT NULL CHECK (schedule_type IN ('daily_time', 'daily', 'weekdays', 'every_other_day', 'as_needed')),
    time TEXT,
    weekdays TEXT
);

CREATE TABLE pill_intake_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pill_id INTEGER NOT NULL REFERENCES pills(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    taken_mg REAL NOT NULL DEFAULT 0,
    taken_pills REAL NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE mood_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    time TEXT NOT NULL,
    mood INTEGER NOT NULL CHECK (mood BETWEEN 1 AND 10),
    anxiety INTEGER CHECK (anxiety BETWEEN 1 AND 10),
    fear INTEGER CHECK (fear BETWEEN 1 AND 10),
    sadness INTEGER CHECK (sadness BETWEEN 1 AND 10),
    anger INTEGER CHECK (anger BETWEEN 1 AND 10),
    energy INTEGER CHECK (energy BETWEEN 1 AND 10),
    tension INTEGER CHECK (tension BETWEEN 1 AND 10),
    motivation INTEGER CHECK (motivation BETWEEN 1 AND 10),
    stress INTEGER CHECK (stress BETWEEN 1 AND 10),
    comment TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    job_type TEXT NOT NULL CHECK (job_type IN ('job', 'gig')),
    pay_type TEXT NOT NULL CHECK (pay_type IN ('hourly', 'piece', 'salary', 'salary_hourly')),
    rate REAL,
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE shifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    amount REAL NOT NULL,
    pending INTEGER NOT NULL DEFAULT 0,
    transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX idx_sleep_logs_start ON sleep_logs(start_time);
CREATE INDEX idx_nutrition_date ON nutrition_logs(date);
CREATE INDEX idx_running_date ON running_logs(date);
CREATE INDEX idx_workouts_date ON workouts(date);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_group ON transactions(transfer_group_id);
CREATE INDEX idx_intake_pill_date ON pill_intake_logs(pill_id, date);
CREATE INDEX idx_shifts_job ON shifts(job_id);
