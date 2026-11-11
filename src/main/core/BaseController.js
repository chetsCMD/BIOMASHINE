const AppError = require('./AppError');

class BaseController {
    get prefix() {
        throw new Error('prefix is not defined');
    }

    routes() {
        return {};
    }

    static id(value) {
        const number = Number(value);
        if (!Number.isInteger(number) || number <= 0) {
            throw AppError.badRequest('common.invalidId');
        }
        return number;
    }
}

module.exports = BaseController;