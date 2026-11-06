const BaseController = require('../core/BaseController');
const AppError = require('../core/AppError');

class ModulesController extends BaseController {
    constructor(modules, system, userDirectory) {
        super();
        this.modules = modules;
        this.system = system;
        this.userDirectory = userDirectory;
    }

    get prefix() {
        return 'modules';
    }

    routes() {
        return {
            list: () => this.modules.list(),
            errors: () => this.modules.errors(),
            rescan: () => this.modules.rescan(),
            openFolder: () => this.system.openFolder(this.userDirectory),
            setHidden: ({ id, hidden }) => {
                if (typeof id !== 'string' || typeof hidden !== 'boolean') {
                    throw AppError.badRequest('Нужны id модуля и признак hidden');
                }
                return this.modules.setHidden(id, hidden);
            }
        };
    }
}

module.exports = ModulesController;
