const BaseController = require('../core/BaseController');
const AppError = require('../core/AppError');
const Dates = require('../core/Dates');

class MoodController extends BaseController {
    constructor(mood) {
        super();
        this.mood = mood;
    }

    get prefix() {
        return 'mood';
    }

    routes() {
        return {
            list: () => this.mood.list(),
            save: (entry) => {
                if (!entry.date || !entry.time || !entry.mood) {
                    throw AppError.badRequest('Дата, время и настроение обязательны');
                }
                this.mood.upsert({ ...entry, date: Dates.day(entry.date), time: Dates.time(entry.time) });
            },
            remove: ({ id }) => {
                if (this.mood.remove(BaseController.id(id)) === 0) {
                    throw AppError.notFound('Запись не найдена');
                }
            }
        };
    }
}

module.exports = MoodController;
