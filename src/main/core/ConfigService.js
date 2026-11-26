const fs = require('fs');
const path = require('path');

class ConfigService {
    constructor(configDir, overridesDir = null) {
        this.data = {};
        this.base = {};
        this.overrides = {};
        this.configDir = configDir;
        this.overridesDir = overridesDir;
        this.errors = [];
        this.load(configDir);
        if (overridesDir && fs.existsSync(overridesDir)) {
            this.load(overridesDir, true);
        }
    }

    load(dir, merge = false) {
        for (const file of fs.readdirSync(dir)) {
            if (path.extname(file) !== '.json') {
                continue;
            }
            const key = path.basename(file, '.json');
            const text = fs.readFileSync(path.join(dir, file), 'utf8').replace(/^\uFEFF/, '');
            let parsed;
            try {
                parsed = JSON.parse(text);
            } catch (error) {
                if (!merge) {
                    throw error;
                }
                this.errors.push({ file, key: 'config.invalidJson', params: { message: error.message } });
                continue;
            }
            if (merge) {
                this.overrides[key] = parsed;
            } else {
                this.base[key] = parsed;
            }
            this.data[key] = merge && this.data[key] ? ConfigService.merge(this.data[key], parsed) : parsed;
        }
    }

    static merge(base, extra) {
        if (Array.isArray(extra) || typeof extra !== 'object' || extra === null) {
            return extra;
        }
        const result = { ...base };
        for (const [key, value] of Object.entries(extra)) {
            result[key] = key in base ? ConfigService.merge(base[key], value) : value;
        }
        return result;
    }

    reload() {
        this.data = {};
        this.base = {};
        this.overrides = {};
        this.errors = [];
        this.load(this.configDir);
        if (this.overridesDir && fs.existsSync(this.overridesDir)) {
            this.load(this.overridesDir, true);
        }
    }

    names() {
        return Object.keys(this.data).sort();
    }

    snapshot(name) {
        return {
            name,
            base: this.base[name] === undefined ? null : this.base[name],
            override: this.overrides[name] === undefined ? null : this.overrides[name],
            effective: this.data[name] === undefined ? null : this.data[name]
        };
    }

    static diff(base, edited) {
        if (JSON.stringify(base) === JSON.stringify(edited)) {
            return undefined;
        }
        const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
        if (!plain(base) || !plain(edited)) {
            return edited;
        }
        const result = {};
        for (const key of Object.keys(edited)) {
            const part = ConfigService.diff(base[key], edited[key]);
            if (part !== undefined) {
                result[key] = part;
            }
        }
        return result;
    }

    writeOverride(name, data) {
        if (!this.overridesDir) {
            throw new Error('configs.noFolder');
        }
        const override = ConfigService.diff(this.base[name] === undefined ? {} : this.base[name], data);
        if (override === undefined || (typeof override === 'object' && Object.keys(override).length === 0)) {
            this.removeOverride(name);
            return;
        }
        fs.mkdirSync(this.overridesDir, { recursive: true });
        fs.writeFileSync(path.join(this.overridesDir, `${name}.json`), `${JSON.stringify(override, null, 2)}\n`);
        this.reload();
    }

    removeOverride(name) {
        if (this.overridesDir) {
            fs.rmSync(path.join(this.overridesDir, `${name}.json`), { force: true });
        }
        this.reload();
    }

    get(dotted, fallback) {
        const value = dotted.split('.').reduce((node, key) => (node === undefined || node === null ? undefined : node[key]), this.data);
        return value === undefined ? fallback : value;
    }

    all() {
        return this.data;
    }
}

module.exports = ConfigService;