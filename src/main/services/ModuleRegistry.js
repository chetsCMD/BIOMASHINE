const fs = require('fs');
const path = require('path');

class ModuleRegistry {
    static KINDS = ['page', 'plugin'];
    static ID_PATTERN = /^[a-z][a-z0-9-]*$/;

    constructor(roots, config) {
        this.roots = roots;
        this.defaultOrder = config.get('app.modules.defaultOrder');
        this.reservedIds = config.get('app.modules.reservedIds');
        this.modules = new Map();
        this.errors = [];
    }

    scan() {
        this.modules = new Map();
        this.errors = [];
        for (const root of this.roots) {
            if (!fs.existsSync(root.dir)) {
                continue;
            }
            for (const name of fs.readdirSync(root.dir).sort()) {
                this.load(path.join(root.dir, name), name, root.source);
            }
        }
        return this;
    }

    load(dir, dirName, source) {
        const manifestPath = path.join(dir, 'manifest.json');
        if (!fs.statSync(dir).isDirectory()) {
            return;
        }
        if (!fs.existsSync(manifestPath)) {
            this.errors.push({ dir: dirName, source, message: 'нет файла manifest.json' });
            return;
        }
        try {
            const manifest = this.validate(JSON.parse(fs.readFileSync(manifestPath, 'utf8')), dirName);
            if (this.modules.has(manifest.id)) {
                throw new Error(`id "${manifest.id}" уже занят модулем из ${this.modules.get(manifest.id).source === 'system' ? 'системной поставки' : 'пользовательской папки'}`);
            }
            this.modules.set(manifest.id, { ...manifest, dir, source });
        } catch (error) {
            this.errors.push({ dir: dirName, source, message: error.message });
        }
    }

    validate(manifest, dirName) {
        if (typeof manifest.id !== 'string' || !ModuleRegistry.ID_PATTERN.test(manifest.id)) {
            throw new Error('id модуля: строчные латинские буквы, цифры и дефис');
        }
        if (manifest.id !== dirName) {
            throw new Error(`id "${manifest.id}" не совпадает с именем папки "${dirName}"`);
        }
        if (this.reservedIds.includes(manifest.id)) {
            throw new Error(`id "${manifest.id}" зарезервирован`);
        }
        if (!ModuleRegistry.KINDS.includes(manifest.kind)) {
            throw new Error(`kind должен быть одним из: ${ModuleRegistry.KINDS.join(', ')}`);
        }
        if (typeof manifest.title !== 'string' || !manifest.title.trim()) {
            throw new Error('title обязателен');
        }
        const base = {
            id: manifest.id,
            kind: manifest.kind,
            title: manifest.title,
            version: String(manifest.version || '1.0.0'),
            description: String(manifest.description || ''),
            order: Number.isFinite(manifest.order) ? manifest.order : this.defaultOrder,
            hideable: manifest.hideable !== false,
            i18n: manifest.i18n === true
        };
        if (manifest.kind === 'page') {
            return { ...base, entry: this.relativePath(manifest.entry || 'index.html'), channels: this.channels(manifest.channels) };
        }
        const css = Array.isArray(manifest.css) ? manifest.css : [];
        if (css.length === 0) {
            throw new Error('plugin должен перечислить css-файлы');
        }
        return { ...base, css: css.map((file) => this.relativePath(file)) };
    }

    relativePath(value) {
        const normalized = path.posix.normalize(String(value));
        if (normalized.startsWith('..') || path.posix.isAbsolute(normalized)) {
            throw new Error(`Недопустимый путь в манифесте: ${value}`);
        }
        return normalized;
    }

    channels(value) {
        if (value === undefined) {
            return [];
        }
        if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !/^[a-zA-Z]+:(\*|[a-zA-Z]+)$/.test(item))) {
            throw new Error('channels: массив строк вида "домен:*" или "домен:действие"');
        }
        return value;
    }

    get(id) {
        return this.modules.get(id) || null;
    }

    all() {
        return [...this.modules.values()].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'ru'));
    }
}

module.exports = ModuleRegistry;
