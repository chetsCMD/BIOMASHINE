const BaseController = require('../core/BaseController');
const AppError = require('../core/AppError');

class ReactionController extends BaseController {
    constructor(tests) {
        super();
        this.tests = tests;
    }

    get prefix() {
        return 'reaction';
    }

    routes() {
        return {
            list: () => this.tests.list(),
            add: ({ values, average }) => {
                if (!Array.isArray(values) || values.length === 0 || !Number.isFinite(Number(average))) {
                    throw AppError.badRequest('Значения и среднее обязательны');
                }
                return { id: this.tests.add(values, Number(average)) };
            },
            remove: ({ id }) => this.tests.remove(BaseController.id(id))
        };
    }
}

module.exports = ReactionController;
