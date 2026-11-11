const BaseController = require('../core/BaseController');
const AppError = require('../core/AppError');

class ProfileController extends BaseController {
    constructor(profile, measurements) {
        super();
        this.profile = profile;
        this.measurements = measurements;
    }

    get prefix() {
        return 'profile';
    }

    routes() {
        return {
            get: () => this.profile.get(),
            overview: () => ({
                user: this.profile.get(),
                measurements: this.measurements.list(),
                goals: this.measurements.getGoals()
            }),
            updateParams: ({ height, age, trainings_count }) => {
                const values = [height, age, trainings_count].map(Number);
                const valid = values.every((value) => Number.isInteger(value)) && values[0] > 0 && values[1] > 0 && values[2] >= 0;
                if (!valid) {
                    throw AppError.badRequest('profile.invalidParams');
                }
                this.profile.updateParams({ height: values[0], age: values[1], trainings_count: values[2] });
                return this.profile.get();
            }
        };
    }
}

module.exports = ProfileController;