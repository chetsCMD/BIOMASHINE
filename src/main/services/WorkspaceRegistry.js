const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AppError = require('../core/AppError');

class WorkspaceRegistry {
    constructor({ dataDir, settings, fileName }) {
        this.dataDir = dataDir;
        this.settings = settings;
        this.fileName = fileName;
    }

    file() {
        return path.join(this.dataDir, this.settings.registryFile);
    }

    read() {
        try {
            return JSON.parse(fs.readFileSync(this.file(), 'utf8'));
        } catch (error) {
            return null;
        }
    }

    write(data) {
        fs.mkdirSync(this.dataDir, { recursive: true });
        fs.writeFileSync(this.file(), JSON.stringify(data, null, 2));
    }

    ensure() {
        let data = this.read();
        if (!data || !Array.isArray(data.profiles) || data.profiles.length === 0) {
            data = {
                active: this.settings.defaultId,
                profiles: [{ id: this.settings.defaultId, name: null, nameKey: this.settings.defaultNameKey, file: this.fileName, createdAt: new Date().toISOString() }]
            };
            this.write(data);
        }
        if (!data.profiles.some((profile) => profile.id === data.active)) {
            data.active = data.profiles[0].id;
            this.write(data);
        }
        return data;
    }

    get(id) {
        return this.ensure().profiles.find((profile) => profile.id === id) || null;
    }

    resolve(requested) {
        const data = this.ensure();
        return requested && data.profiles.some((profile) => profile.id === requested) ? requested : data.active;
    }

    pathOf(entry) {
        return path.join(this.dataDir, entry.file);
    }

    dbPath(id) {
        return this.pathOf(this.get(id));
    }

    validName(name) {
        const text = typeof name === 'string' ? name.trim() : '';
        if (!text || text.length > this.settings.maxNameLength) {
            throw AppError.badRequest('workspace.invalidName', { max: this.settings.maxNameLength });
        }
        return text;
    }

    newId(data) {
        let id;
        do {
            id = crypto.randomBytes(Math.ceil(this.settings.idLength / 2)).toString('hex').slice(0, this.settings.idLength);
        } while (data.profiles.some((profile) => profile.id === id));
        return id;
    }

    create(name) {
        const data = this.ensure();
        const id = this.newId(data);
        const entry = { id, name: this.validName(name), nameKey: null, file: this.settings.fileTemplate.replace('{id}', id), createdAt: new Date().toISOString() };
        data.profiles.push(entry);
        this.write(data);
        return entry;
    }

    rename(id, name) {
        const data = this.ensure();
        const entry = data.profiles.find((profile) => profile.id === id);
        if (!entry) {
            throw AppError.notFound('workspace.unknown', { id });
        }
        entry.name = this.validName(name);
        this.write(data);
        return entry;
    }

    setActive(id) {
        const data = this.ensure();
        if (!data.profiles.some((profile) => profile.id === id)) {
            throw AppError.notFound('workspace.unknown', { id });
        }
        data.active = id;
        this.write(data);
    }

    remove(id) {
        const data = this.ensure();
        const entry = data.profiles.find((profile) => profile.id === id);
        if (!entry) {
            throw AppError.notFound('workspace.unknown', { id });
        }
        data.profiles = data.profiles.filter((profile) => profile.id !== id);
        this.write(data);
        for (const suffix of ['', '-wal', '-shm']) {
            fs.rmSync(`${this.pathOf(entry)}${suffix}`, { force: true });
        }
    }
}

module.exports = WorkspaceRegistry;
