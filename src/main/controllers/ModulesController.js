const BaseController = require('../core/BaseController');
const AppError = require('../core/AppError');

class ModulesController extends BaseController {
    constructor(modules, system, userDirectory, messages) {
        super();
        this.modules = modules;
        this.system = system;
        this.userDirectory = userDirectory;
        this.messages = messages;
    }

    get prefix() {
        return 'modules';
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
            list: () => this.modules.list(),
            errors: () => this.translateProblems(this.modules.errors()),
            rescan: () => this.modules.rescan(),
            openFolder: () => this.system.openFolder(this.userDirectory),
            setHidden: ({ id, hidden }) => {
                if (typeof id !== 'string' || typeof hidden !== 'boolean') {
                    throw AppError.badRequest('modules.hiddenParamsRequired');
                }
                return this.modules.setHidden(id, hidden);
            },
            setPinned: ({ id, pinned }) => {
                if (typeof id !== 'string' || typeof pinned !== 'boolean') {
                    throw AppError.badRequest('modules.pinnedParamsRequired');
                }
                return this.modules.setPinned(id, pinned);
            },
            reorderPinned: ({ ids }) => {
                if (!Array.isArray(ids)) {
                    throw AppError.badRequest('modules.idsArrayRequired');
                }
                return this.modules.reorderPinned(ids);
            },
            setCategory: ({ id, category }) => {
                if (typeof id !== 'string') {
                    throw AppError.badRequest('modules.idRequired');
                }
                if (category !== null && typeof category !== 'string') {
                    throw AppError.badRequest('modules.categoryType');
                }
                return this.modules.setCategory(id, category);
            },
            categories: () => this.modules.categories(),
            createCategory: ({ name }) => {
                if (typeof name !== 'string') {
                    throw AppError.badRequest('modules.categoryNameRequired');
                }
                return this.modules.createCategory(name);
            },
            removeCategory: ({ id }) => {
                if (typeof id !== 'string') {
                    throw AppError.badRequest('modules.categoryIdRequired');
                }
                return this.modules.removeCategory(id);
            }
        };
    }
}

module.exports = ModulesController;