const fs = require('fs');
const path = require('path');

class ConfigService {
    constructor(configDir, overridesDir = null) {
        this.data = {};
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
                this.errors.push({ file, message: `некорректный JSON: ${error.message}` });
                continue;
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

    get(dotted, fallback) {
        const value = dotted.split('.').reduce((node, key) => (node === undefined || node === null ? undefined : node[key]), this.data);
        return value === undefined ? fallback : value;
    }

    all() {
        return this.data;
    }
}

module.exports = ConfigService;
