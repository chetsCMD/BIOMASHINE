const fs = require('fs');
const path = require('path');
const AppError = require('../core/AppError');

class ModuleRegistry {
    static KINDS = ['page', 'plugin'];
    static ID_PATTERN = /^[a-z][a-z0-9-]*$/;
    static PERMISSIONS = ['notifications'];

    constructor(roots, config, compare) {
        this.roots = roots;
        this.defaultOrder = config.get('app.modules.defaultOrder');
        this.reservedIds = config.get('app.modules.reservedIds');
        this.compare = typeof compare === 'function' ? compare : (a, b) => String(a).localeCompare(String(b));
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
            this.errors.push({ dir: dirName, source, key: 'module.missingManifest' });
            return;
        }
        try {
            const manifest = this.validate(JSON.parse(fs.readFileSync(manifestPath, 'utf8')), dirName);
            if (this.modules.has(manifest.id)) {
                throw AppError.badRequest('module.idTaken', { id: manifest.id, source: this.modules.get(manifest.id).source });
            }
            this.modules.set(manifest.id, { ...manifest, dir, source });
        } catch (error) {
            if (error.name === 'AppError') {
                this.errors.push({ dir: dirName, source, key: error.key, params: error.params });
            } else {
                this.errors.push({ dir: dirName, source, key: 'module.invalidJson', params: { message: error.message } });
            }
        }
    }

    validate(manifest, dirName) {
        if (typeof manifest.id !== 'string' || !ModuleRegistry.ID_PATTERN.test(manifest.id)) {
            throw AppError.badRequest('module.invalidId');
        }
        if (manifest.id !== dirName) {
            throw AppError.badRequest('module.idMismatch', { id: manifest.id, dir: dirName });
        }
        if (this.reservedIds.includes(manifest.id)) {
            throw AppError.badRequest('module.reservedId', { id: manifest.id });
        }
        if (!ModuleRegistry.KINDS.includes(manifest.kind)) {
            throw AppError.badRequest('module.invalidKind', { kinds: ModuleRegistry.KINDS.join(', ') });
        }
        if (typeof manifest.title !== 'string' || !manifest.title.trim()) {
            throw AppError.badRequest('module.titleRequired');
        }
        const base = {
            id: manifest.id,
            kind: manifest.kind,
            title: manifest.title,
            version: String(manifest.version || '1.0.0'),
            description: String(manifest.description || ''),
            order: Number.isFinite(manifest.order) ? manifest.order : this.defaultOrder,
            hideable: manifest.hideable !== false,
            i18n: manifest.i18n === true,
            category: this.category(manifest.category),
            permissions: []
        };
        if (manifest.kind === 'page') {
            return {
                ...base,
                entry: this.relativePath(manifest.entry || 'index.html'),
                channels: this.channels(manifest.channels),
                permissions: this.permissions(manifest.permissions)
            };
        }
        const css = Array.isArray(manifest.css) ? manifest.css : [];
        if (css.length === 0) {
            throw AppError.badRequest('module.cssRequired');
        }
        return { ...base, css: css.map((file) => this.relativePath(file)) };
    }

    category(value) {
        if (value === undefined || value === null) {
            return null;
        }
        if (typeof value !== 'string' || !ModuleRegistry.ID_PATTERN.test(value)) {
            throw AppError.badRequest('module.invalidCategory');
        }
        return value;
    }

    permissions(value) {
        if (value === undefined) {
            return [];
        }
        if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !ModuleRegistry.PERMISSIONS.includes(item))) {
            throw AppError.badRequest('module.invalidPermissions', { permissions: ModuleRegistry.PERMISSIONS.join(', ') });
        }
        return [...new Set(value)];
    }

    relativePath(value) {
        const normalized = path.posix.normalize(String(value));
        if (normalized.startsWith('..') || path.posix.isAbsolute(normalized)) {
            throw AppError.badRequest('module.invalidPath', { value });
        }
        return normalized;
    }

    channels(value) {
        if (value === undefined) {
            return [];
        }
        if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !/^[a-zA-Z]+:(\*|[a-zA-Z]+)$/.test(item))) {
            throw AppError.badRequest('module.invalidChannels');
        }
        return value;
    }

    get(id) {
        return this.modules.get(id) || null;
    }

    all() {
        return [...this.modules.values()].sort((a, b) => a.order - b.order || this.compare(a.title, b.title));
    }
}

module.exports = ModuleRegistry;