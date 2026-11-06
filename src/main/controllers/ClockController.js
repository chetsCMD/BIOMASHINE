const BaseController = require('../core/BaseController');

class ClockController extends BaseController {
    constructor(clock) {
        super();
        this.clock = clock;
    }

    get prefix() {
        return 'clock';
    }

    routes() {
        return {
            zones: () => this.clock.zonesInfo(),
            now: () => this.clock.describe()
        };
    }
}

module.exports = ClockController;
