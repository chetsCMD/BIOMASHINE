const BaseController = require('../core/BaseController');

class SettingsController extends BaseController {
    constructor(settings) {
        super();
        this.settings = settings;
    }

    get prefix() {
        return 'settings';
    }

    routes() {
        return {
            get: () => this.settings.getAll(),
            set: ({ key, value }) => this.settings.set(key, value),
            relaunch: () => this.settings.relaunch()
        };
    }
}

module.exports = SettingsController;
