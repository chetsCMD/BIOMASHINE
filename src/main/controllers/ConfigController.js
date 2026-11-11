const BaseController = require('../core/BaseController');
const AppError = require('../core/AppError');

class ConfigController extends BaseController {
    constructor(config, catalog, system, overridesDir, messages) {
        super();
        this.config = config;
        this.catalog = catalog;
        this.system = system;
        this.overridesDir = overridesDir;
        this.messages = messages;
        this.privateNames = config.get('app.privateConfigs');
    }

    get prefix() {
        return 'config';
    }

    translateProblems(problems) {
        if (!this.messages) return problems;
        return problems.map((p) => {
            const key = p.key || p.message;
            const params = { ...(p.params || {}) };
            if (typeof params.reasonKey === 'string') {
                params.reason = this.messages.t(params.reasonKey, params.reasonParams || {});
            }
            const message = this.messages.t(key, params);
            return { ...p, key, message };
        });
    }

    routes() {
        return {
            get: ({ name }) => {
                if (typeof name !== 'string' || this.privateNames.includes(name)) {
                    throw AppError.forbidden('config.forbidden', { name });
                }
                const value = name === 'themes' ? this.catalog.load() : this.config.get(name);
                if (value === undefined) {
                    throw AppError.notFound('config.notFound', { name });
                }
                return value;
            },
            errors: () => this.translateProblems([...this.config.errors, ...this.catalog.problems]),
            openFolder: () => this.system.openFolder(this.overridesDir)
        };
    }
}

module.exports = ConfigController;