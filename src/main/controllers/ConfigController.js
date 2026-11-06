const BaseController = require('../core/BaseController');
const AppError = require('../core/AppError');

class ConfigController extends BaseController {
    constructor(config, catalog, system, overridesDir) {
        super();
        this.config = config;
        this.catalog = catalog;
        this.system = system;
        this.overridesDir = overridesDir;
        this.privateNames = config.get('app.privateConfigs');
    }

    get prefix() {
        return 'config';
    }

    routes() {
        return {
            get: ({ name }) => {
                if (typeof name !== 'string' || this.privateNames.includes(name)) {
                    throw AppError.forbidden(`Конфиг недоступен: ${name}`);
                }
                const value = name === 'themes' ? this.catalog.load() : this.config.get(name);
                if (value === undefined) {
                    throw AppError.notFound(`Конфиг не найден: ${name}`);
                }
                return value;
            },
            errors: () => [...this.config.errors, ...this.catalog.problems],
            openFolder: () => this.system.openFolder(this.overridesDir)
        };
    }
}

module.exports = ConfigController;
