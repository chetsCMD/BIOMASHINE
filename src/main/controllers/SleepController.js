const BaseController = require('../core/BaseController');
const AppError = require('../core/AppError');
const Dates = require('../core/Dates');

class SleepController extends BaseController {
    constructor(sleep) {
        super();
        this.sleep = sleep;
    }

    get prefix() {
        return 'sleep';
    }

    routes() {
        return {
            listLogs: () => this.sleep.listLogs(),
            addLog: ({ start_time, end_time }) => {
                if (!start_time || !end_time) {
                    throw AppError.badRequest('Время начала и окончания обязательны');
                }
                const start = Dates.timestamp(start_time);
                const end = Dates.timestamp(end_time);
                if (end <= start) {
                    throw AppError.badRequest('Время окончания должно быть позже начала');
                }
                return { id: this.sleep.addLog(start, end) };
            },
            removeLog: ({ id }) => this.sleep.removeLog(BaseController.id(id)),
            getSchedule: () => this.sleep.getSchedule(),
            saveSchedule: ({ ideal_bedtime, ideal_waketime }) => {
                if (!ideal_bedtime || !ideal_waketime) {
                    throw AppError.badRequest('Время отхода ко сну и пробуждения обязательны');
                }
                this.sleep.saveSchedule(Dates.time(ideal_bedtime), Dates.time(ideal_waketime));
            },
            resetSchedule: () => this.sleep.resetSchedule(),
            listNoSleep: () => this.sleep.listNoSleepDays(),
            addNoSleep: ({ date }) => {
                const day = Dates.day(date);
                if (this.sleep.countLogsOnDay(day) > 0) {
                    throw AppError.badRequest('В этот день уже есть записи сна, нельзя отметить как "не спал"');
                }
                this.sleep.addNoSleepDay(day);
            },
            removeNoSleep: ({ date }) => {
                if (this.sleep.removeNoSleepDay(Dates.day(date)) === 0) {
                    throw AppError.notFound('Запись не найдена');
                }
            }
        };
    }
}

module.exports = SleepController;
