const BaseController = require('../core/BaseController');
const AppError = require('../core/AppError');
const Dates = require('../core/Dates');

class WorkoutController extends BaseController {
    constructor(workouts) {
        super();
        this.workouts = workouts;
    }

    get prefix() {
        return 'workouts';
    }

    normalize(payload) {
        const { date, start_time, end_time, type, note, exercises } = payload;
        if (!date || !type || !Array.isArray(exercises) || exercises.length === 0) {
            throw AppError.badRequest('workouts.dateTypeExercisesRequired');
        }
        return {
            date: Dates.day(date),
            start_time: Dates.hoursMinutes(start_time),
            end_time: Dates.hoursMinutes(end_time),
            type,
            note,
            exercises
        };
    }

    routes() {
        return {
            list: () => this.workouts.list(),
            create: (payload) => ({ id: this.workouts.create(this.normalize(payload)) }),
            update: (payload) => this.workouts.update(BaseController.id(payload.id), this.normalize(payload)),
            remove: ({ id }) => {
                if (this.workouts.remove(BaseController.id(id)) === 0) {
                    throw AppError.notFound('workouts.notFound');
                }
            },
            listTemplates: () => this.workouts.listTemplates(),
            createTemplate: ({ name, exercises }) => {
                if (!name || !Array.isArray(exercises) || exercises.length === 0) {
                    throw AppError.badRequest('workouts.nameAndExercisesRequired');
                }
                return { id: this.workouts.createTemplate(name, exercises) };
            },
            removeTemplate: ({ id }) => {
                if (this.workouts.removeTemplate(BaseController.id(id)) === 0) {
                    throw AppError.notFound('workouts.templateNotFound');
                }
            },
            getGoals: () => this.workouts.getGoals(),
            saveGoals: ({ weekly_target, exercise_goals }) => this.workouts.saveGoals(weekly_target, exercise_goals)
        };
    }
}

module.exports = WorkoutController;