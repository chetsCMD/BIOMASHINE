const BaseController = require('../core/BaseController');

class SessionController extends BaseController {
    constructor(session) {
        super();
        this.session = session;
    }

    get prefix() {
        return 'session';
    }

    routes() {
        return {
            get: () => ({ mode: this.session.mode(), hasState: this.session.load() !== null }),
            setMode: ({ mode }) => this.session.setMode(mode),
            save: ({ state }) => this.session.save(state),
            load: () => this.session.load(),
            clear: () => this.session.clear()
        };
    }
}

module.exports = SessionController;
