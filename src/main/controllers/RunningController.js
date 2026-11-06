const BaseController = require('../core/BaseController');
const AppError = require('../core/AppError');
const Dates = require('../core/Dates');

class RunningController extends BaseController {
    constructor(running) {
        super();
        this.running = running;
    }

    get prefix() {
        return 'running';
    }

    routes() {
        return {
            list: () => this.running.list(),
            add: ({ date, time_seconds, distance, calories, start_speed, max_speed, incline }) => {
                if (!date || !time_seconds || !distance) {
                    throw AppError.badRequest('Дата, время и дистанция обязательны');
                }
                const id = this.running.add({ date: Dates.day(date), time_seconds, distance, calories, start_speed, max_speed, incline });
                return { id };
            },
            remove: ({ id }) => {
                if (this.running.remove(BaseController.id(id)) === 0) {
                    throw AppError.notFound('Запись не найдена');
                }
            },
            getGoals: () => this.running.getGoals(),
            saveGoal: ({ goal_type, target, deadline }) => {
                const deadlineDay = deadline ? Dates.day(deadline) : null;
                if (!this.running.saveGoal(goal_type, target, deadlineDay)) {
                    throw AppError.badRequest('Неизвестный тип цели');
                }
            }
        };
    }
}

module.exports = RunningController;
