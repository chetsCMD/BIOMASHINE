const BaseController = require('../core/BaseController');
const AppError = require('../core/AppError');
const Dates = require('../core/Dates');

class MeasurementController extends BaseController {
    constructor(measurements) {
        super();
        this.measurements = measurements;
    }

    get prefix() {
        return 'measurements';
    }

    routes() {
        return {
            list: () => this.measurements.list(),
            save: ({ date, weight, fat, water }) => {
                if (!date || !Number.isFinite(Number(weight))) {
                    throw AppError.badRequest('Дата и вес обязательны');
                }
                this.measurements.upsert({ date: Dates.day(date), weight: Number(weight), fat, water });
            },
            remove: ({ date }) => {
                if (this.measurements.remove(Dates.day(date)) === 0) {
                    throw AppError.notFound('Запись не найдена');
                }
            },
            getGoals: () => this.measurements.getGoals(),
            saveGoals: ({ weight_goal, fat_goal, deadline }) => {
                this.measurements.saveGoals({ weight_goal, fat_goal, deadline: deadline ? Dates.day(deadline) : null });
            }
        };
    }
}

module.exports = MeasurementController;
