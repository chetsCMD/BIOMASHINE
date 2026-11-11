const BaseController = require('../core/BaseController');
const AppError = require('../core/AppError');

class TrashController extends BaseController {
    constructor(operationLog) {
        super();
        this.operationLog = operationLog;
    }

    get prefix() {
        return 'trash';
    }

    routes() {
        return {
            list: () => this.operationLog.list(),
            undo: (payload) => {
                const id = Number(payload && payload.id);
                if (!Number.isInteger(id) || id <= 0) {
                    throw AppError.badRequest('trash.invalidId');
                }
                return { restored: this.operationLog.undo(id) };
            }
        };
    }
}

module.exports = TrashController;