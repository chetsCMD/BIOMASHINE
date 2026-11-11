const BaseController = require('../core/BaseController');
const AppError = require('../core/AppError');

class I18nController extends BaseController {
    constructor(locales, settings, system, userLocalesDir, messages) {
        super();
        this.locales = locales;
        this.settings = settings;
        this.system = system;
        this.userLocalesDir = userLocalesDir;
        this.messages = messages;
    }

    get prefix() {
        return 'i18n';
    }

    translateProblems(problems) {
        if (!this.messages) return problems;
        return problems.map((p) => {
            const key = p.key || p.message;
            const params = p.params || {};
            const message = this.messages.t(key, params);
            return { ...p, key, message };
        });
    }

    routes() {
        return {
            languages: () => this.locales.languages(),
            bundle: ({ scope }) => {
                if (typeof scope !== 'string' || !this.locales.scopeNames().includes(scope)) {
                    throw AppError.badRequest('i18n.unknownScope');
                }
                return this.locales.bundle(scope, this.settings.getAll().language);
            },
            master: ({ code } = {}) => this.locales.master(code || this.settings.getAll().language),
            export: ({ code } = {}) => {
                const base = code || this.settings.getAll().language;
                return this.system.saveFile(`biomashine-language-template-${base}.json`, JSON.stringify(this.locales.master(base), null, 2));
            },
            openFolder: () => this.system.openFolder(this.userLocalesDir),
            errors: () => this.translateProblems(this.locales.errors())
        };
    }
}

module.exports = I18nController;