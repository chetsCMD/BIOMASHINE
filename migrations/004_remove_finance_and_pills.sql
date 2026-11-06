DROP TABLE shifts;
DROP TABLE jobs;
DROP TABLE transactions;
DROP TABLE accounts;
DROP TABLE categories;
DROP TABLE transfer_groups;
DROP TABLE pill_intake_logs;
DROP TABLE pill_schedules;
DROP TABLE pills;

CREATE TABLE profile_new (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    height INTEGER NOT NULL,
    age INTEGER NOT NULL,
    trainings_count INTEGER NOT NULL
);

INSERT INTO profile_new (id, height, age, trainings_count)
SELECT id, height, age, trainings_count FROM profile;

DROP TABLE profile;
ALTER TABLE profile_new RENAME TO profile;
DROP TABLE currencies;
