const BaseController = require('../core/BaseController');
const AppError = require('../core/AppError');

class ConfigEditorController extends BaseController {
    static NAME = /^[a-z][a-z0-9-]*$/;

    constructor(config) {
        super();
        this.config = config;
        this.restartRequired = config.get('app.configEditor.restartRequired', []);
        this.privateNames = config.get('app.privateConfigs', []);
        this.maxBytes = config.get('app.configEditor.maxBytes');
    }

    get prefix() {
        return 'configs';
    }

    name(value, mustExist) {
        if (typeof value !== 'string' || !ConfigEditorController.NAME.test(value)) {
            throw AppError.badRequest('configs.invalidName', { name: String(value) });
        }
        if (mustExist && this.config.data[value] === undefined) {
            throw AppError.notFound('configs.unknown', { name: value });
        }
        return value;
    }

    routes() {
        return {
            list: () =>
                this.config.names().map((name) => ({
                    name,
                    private: this.privateNames.includes(name),
                    restart: this.restartRequired.includes(name),
                    hasOverride: this.config.overrides[name] !== undefined
                })),
            read: ({ name }) => this.config.snapshot(this.name(name, true)),
            write: ({ name, data }) => {
                this.name(name, false);
                if (data === null || typeof data !== 'object' || Array.isArray(data)) {
                    throw AppError.badRequest('configs.invalidData');
                }
                if (JSON.stringify(data).length > this.maxBytes) {
                    throw AppError.badRequest('configs.tooLarge', { max: this.maxBytes });
                }
                this.config.writeOverride(name, data);
                return this.config.snapshot(name);
            },
            reset: ({ name }) => {
                this.name(name, true);
                this.config.removeOverride(name);
                return this.config.snapshot(name);
            }
        };
    }
}

module.exports = ConfigEditorController;
