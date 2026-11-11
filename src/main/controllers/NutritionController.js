const BaseController = require('../core/BaseController');
const AppError = require('../core/AppError');
const Dates = require('../core/Dates');
const Values = require('../core/Values');

class NutritionController extends BaseController {
    constructor(nutrition) {
        super();
        this.nutrition = nutrition;
    }

    get prefix() {
        return 'nutrition';
    }

    routes() {
        return {
            list: () => this.nutrition.list(),
            add: ({ date, name, weight, calories, protein, fat, carbs }) => {
                if (!name || !weight) {
                    throw AppError.badRequest('nutrition.nameAndWeightRequired');
                }
                const id = this.nutrition.add({
                    date: Dates.day(date),
                    name,
                    weight: Number(weight),
                    calories: Values.orZero(calories),
                    protein: Values.orZero(protein),
                    fat: Values.orZero(fat),
                    carbs: Values.orZero(carbs)
                });
                return { id };
            },
            remove: ({ id }) => {
                if (this.nutrition.remove(BaseController.id(id)) === 0) {
                    throw AppError.notFound('nutrition.notFound');
                }
            }
        };
    }
}

module.exports = NutritionController;