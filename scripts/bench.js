const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'bench.json'), 'utf8'));
const argument = (name) => {
    const found = process.argv.find((item) => item.startsWith(`--${name}=`));
    return found ? Number(found.split('=')[1]) : null;
};
const rows = argument('rows') || config.rows;
const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-bench-'));
const file = path.join(folder, 'bench.sqlite');
const db = new Database(file);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.exec('CREATE TABLE pulse (ts INTEGER NOT NULL, bpm INTEGER NOT NULL, spo2 INTEGER NOT NULL)');

const results = [];
const measure = (label, count, work) => {
    const begin = process.hrtime.bigint();
    const value = work();
    const ms = Number(process.hrtime.bigint() - begin) / 1e6;
    results.push({ label, ms: Math.round(ms * 10) / 10, perSecond: count ? Math.round(count / (ms / 1000)) : null });
    return value;
};

let seed = config.seed;
const next = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
};
const step = Math.max(1, Math.floor((config.days * config.daySeconds) / rows));
const insert = db.prepare('INSERT INTO pulse (ts, bpm, spo2) VALUES (?, ?, ?)');
const batch = db.transaction((from, to) => {
    for (let index = from; index < to; index += 1) {
        insert.run(config.startTimestamp + index * step, config.bpm.min + Math.floor(next() * config.bpm.range), config.spo2.min + Math.floor(next() * config.spo2.range));
    }
});

measure('insert (batched transactions)', rows, () => {
    for (let from = 0; from < rows; from += config.batchSize) {
        batch(from, Math.min(from + config.batchSize, rows));
    }
});
measure('create index on ts', rows, () => db.exec('CREATE INDEX idx_pulse_ts ON pulse (ts)'));
measure('count all rows', rows, () => db.prepare('SELECT COUNT(*) FROM pulse').pluck().get());
measure('daily avg/min/max over all rows', rows, () =>
    db.prepare('SELECT ts / ? AS day, AVG(bpm), MIN(bpm), MAX(bpm), AVG(spo2) FROM pulse GROUP BY day').all(config.daySeconds)
);
const dayStart = config.startTimestamp + config.daySeconds * config.sampleDayOffset;
measure('one day in 1-minute buckets', null, () =>
    db.prepare('SELECT ts / ? AS minute, AVG(bpm), MIN(spo2) FROM pulse WHERE ts >= ? AND ts < ? GROUP BY minute').all(config.minuteSeconds, dayStart, dayStart + config.daySeconds)
);
measure('latest rows', config.recentLimit, () => db.prepare('SELECT ts, bpm, spo2 FROM pulse ORDER BY ts DESC LIMIT ?').all(config.recentLimit));
measure('one-hour range scan', null, () => db.prepare('SELECT ts, bpm FROM pulse WHERE ts BETWEEN ? AND ?').all(dayStart, dayStart + config.hourSeconds));
const values = measure('read all bpm into a JS array', rows, () => db.prepare('SELECT bpm FROM pulse ORDER BY ts').pluck().all());
measure(`moving average (window ${config.windowSize}) in JS`, rows, () => {
    const prefix = new Float64Array(values.length + 1);
    for (let index = 0; index < values.length; index += 1) {
        prefix[index + 1] = prefix[index] + values[index];
    }
    const out = new Float64Array(values.length);
    for (let index = 0; index < values.length; index += 1) {
        const from = Math.max(0, index - config.windowSize + 1);
        out[index] = (prefix[index + 1] - prefix[from]) / (index + 1 - from);
    }
    return out;
});

console.log(JSON.stringify({ rows, databaseMegabytes: Math.round(fs.statSync(file).size / 1048576), node: process.version, results }, null, 2));
db.close();
fs.rmSync(folder, { recursive: true, force: true });
