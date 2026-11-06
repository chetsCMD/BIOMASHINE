const AppError = require('./AppError');

class BaseController {
    get prefix() {
        throw new Error('prefix не задан');
    }

    routes() {
        return {};
    }

    static id(value) {
        const number = Number(value);
        if (!Number.isInteger(number) || number <= 0) {
            throw AppError.badRequest('Некорректный идентификатор');
        }
        return number;
    }
}

module.exports = BaseController;
