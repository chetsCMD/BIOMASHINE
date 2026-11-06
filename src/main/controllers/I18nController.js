const BaseController = require('../core/BaseController');
const AppError = require('../core/AppError');

class I18nController extends BaseController {
    constructor(locales, settings, system, userLocalesDir) {
        super();
        this.locales = locales;
        this.settings = settings;
        this.system = system;
        this.userLocalesDir = userLocalesDir;
    }

    get prefix() {
        return 'i18n';
    }

    routes() {
        return {
            languages: () => this.locales.languages(),
            bundle: ({ scope }) => {
                if (typeof scope !== 'string' || !this.locales.scopeNames().includes(scope)) {
                    throw AppError.badRequest('Неизвестная область переводов');
                }
                return this.locales.bundle(scope, this.settings.getAll().language);
            },
            master: ({ code } = {}) => this.locales.master(code || this.settings.getAll().language),
            export: ({ code } = {}) => {
                const base = code || this.settings.getAll().language;
                return this.system.saveFile(`biomashine-language-template-${base}.json`, JSON.stringify(this.locales.master(base), null, 2));
            },
            openFolder: () => this.system.openFolder(this.userLocalesDir),
            errors: () => this.locales.errors()
        };
    }
}

module.exports = I18nController;
