const BaseRepository = require('../core/BaseRepository');

class ExportService extends BaseRepository {
    constructor(database, config, appVersion) {
        super(database);
        this.excludedPrefix = config.get('app.export.excludeSettingsPrefix');
        this.baseName = config.get('app.export.fileName');
        this.appVersion = appVersion;
    }

    tableNames() {
        return this.queryAll(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        ).map((row) => row.name);
    }

    toJson() {
        const tables = {};
        for (const name of this.tableNames()) {
            tables[name] = this.queryAll(`SELECT * FROM "${name}"`);
        }
        tables.settings = tables.settings.filter((row) => !row.key.startsWith(this.excludedPrefix));
        return {
            meta: { app: 'BIOMASHINE', version: this.appVersion, exportedAt: new Date().toISOString() },
            tables
        };
    }

    toCsv() {
        const files = {};
        const data = this.toJson().tables;
        for (const [name, rows] of Object.entries(data)) {
            if (rows.length === 0) {
                continue;
            }
            const columns = Object.keys(rows[0]);
            const lines = [columns.join(',')];
            for (const row of rows) {
                lines.push(columns.map((column) => ExportService.cell(row[column])).join(','));
            }
            files[`${name}.csv`] = lines.join('\n');
        }
        return files;
    }

    static cell(value) {
        if (value === null || value === undefined) {
            return '';
        }
        const text = String(value);
        return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    }
}

module.exports = ExportService;
