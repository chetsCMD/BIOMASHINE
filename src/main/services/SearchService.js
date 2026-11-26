const AppError = require('../core/AppError');

class SearchService {
    static fold(value) {
        return String(value === null || value === undefined ? '' : value).normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();
    }

    static KEY = 'search.snapshots';

    constructor({ config, database, getModules, store }) {
        this.store = store;
        this.settings = config.get('search');
        this.db = database.connection;
        this.getModules = getModules;
        this.db.function('bm_fold', { deterministic: true }, (value) => SearchService.fold(value));
    }

    quote(name) {
        return `"${String(name).replace(/"/g, '""')}"`;
    }

    pattern(token) {
        return `%${token.replace(/[\\%_]/g, '\\$&')}%`;
    }

    modules() {
        return this.getModules().filter((module) => module.kind === 'page');
    }

    moduleResults(tokens) {
        return this.modules()
            .filter((module) => {
                const text = SearchService.fold(`${module.title} ${module.description || ''}`);
                return tokens.every((token) => text.includes(token));
            })
            .map((module) => ({ kind: 'module', module: module.id, moduleTitle: module.title, table: null, rowId: null, title: module.title, snippet: module.description || '', fields: [] }));
    }

    snapshots() {
        const stored = this.store.get(SearchService.KEY);
        return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
    }

    saveSnapshot(module, lines) {
        const settings = this.settings.snapshot;
        const known = this.modules().some((item) => item.id === module);
        const valid = known && Array.isArray(lines) && lines.length <= settings.maxLines && lines.every((line) => typeof line === 'string' && line.length <= settings.maxLine);
        const all = { ...this.snapshots(), [module]: valid ? lines : [] };
        if (!valid || JSON.stringify(all).length > settings.maxBytes) {
            throw AppError.badRequest('search.invalidSnapshot');
        }
        this.store.set(SearchService.KEY, all);
    }

    pageResults(tokens) {
        const titles = new Map(this.modules().map((module) => [module.id, module.title]));
        const found = [];
        for (const [module, lines] of Object.entries(this.snapshots())) {
            if (!titles.has(module)) {
                continue;
            }
            const matched = lines.filter((line) => tokens.every((token) => SearchService.fold(line).includes(token))).slice(0, this.settings.snapshot.perModule);
            for (const line of matched) {
                found.push({ kind: 'page', module, moduleTitle: titles.get(module), table: null, rowId: null, title: line, snippet: '', fields: [] });
            }
        }
        return found;
    }

    tables() {
        const settings = this.settings;
        const names = this.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").pluck().all();
        const known = Object.keys(settings.tables);
        return [...known.filter((name) => names.includes(name)), ...names.filter((name) => !known.includes(name))].filter((name) => !settings.excludeTables.includes(name));
    }

    titleOf(table, row, columns) {
        const configured = (this.settings.tables[table] || {}).titleColumns || [];
        const candidates = [...configured.filter((column) => columns.includes(column)), ...columns];
        const column = candidates.find((name) => row[name] !== null && row[name] !== undefined && String(row[name]).trim() !== '');
        return column ? String(row[column]) : table;
    }

    recordResults(tokens) {
        const settings = this.settings;
        const titles = new Map(this.modules().map((module) => [module.id, module.title]));
        const found = [];
        for (const table of this.tables()) {
            try {
                const columns = this.db.prepare(`PRAGMA table_info(${this.quote(table)})`).all().map((column) => column.name).filter((name) => !settings.excludeColumns.includes(name));
                if (columns.length === 0) {
                    continue;
                }
                const where = tokens.map(() => `(${columns.map((column) => `bm_fold(CAST(${this.quote(column)} AS TEXT)) LIKE ? ESCAPE '\\'`).join(' OR ')})`).join(' AND ');
                const params = tokens.flatMap((token) => columns.map(() => this.pattern(token)));
                const rows = this.db.prepare(`SELECT rowid AS _rid, * FROM ${this.quote(table)} WHERE ${where} ORDER BY rowid DESC LIMIT ?`).all(...params, settings.perTable);
                for (const row of rows) {
                    const matched = columns.filter((column) => tokens.some((token) => SearchService.fold(row[column]).includes(token)));
                    const module = table === 'module_documents' ? row.module_id : (settings.tables[table] || {}).module || null;
                    found.push({
                        kind: 'record',
                        module,
                        moduleTitle: module ? titles.get(module) || module : table,
                        table,
                        rowId: row._rid,
                        title: table === 'module_documents' ? String(row.collection) : this.titleOf(table, row, columns),
                        snippet: matched.map((column) => `${column}: ${row[column]}`).join(' · ').slice(0, settings.snippetLength),
                        fields: matched
                    });
                }
            } catch (error) {
                continue;
            }
        }
        return found;
    }

    query(text) {
        const settings = this.settings;
        if (typeof text !== 'string' || text.length > settings.maxQueryLength) {
            throw AppError.badRequest('search.invalidQuery', { max: settings.maxQueryLength });
        }
        const tokens = SearchService.fold(text).split(/\s+/).filter(Boolean);
        if (text.trim().length < settings.minQueryLength || tokens.length === 0) {
            return { results: [], truncated: false };
        }
        const all = [...this.moduleResults(tokens), ...this.pageResults(tokens), ...this.recordResults(tokens)];
        return { results: all.slice(0, settings.maxResults), truncated: all.length > settings.maxResults };
    }
}

module.exports = SearchService;
