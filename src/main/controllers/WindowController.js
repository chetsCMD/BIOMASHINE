const BaseController = require('../core/BaseController');

class WindowController extends BaseController {
    constructor(system) {
        super();
        this.system = system;
    }

    get prefix() {
        return 'window';
    }

    routes() {
        return {
            state: () => this.system.windowState(),
            toggleFullscreen: () => this.system.toggleFullscreen(),
            close: () => this.system.closeWindow()
        };
    }
}

module.exports = WindowController;
