const BaseController = require('../core/BaseController');

class AuthController extends BaseController {
    constructor(auth) {
        super();
        this.auth = auth;
    }

    get prefix() {
        return 'auth';
    }

    routes() {
        return {
            status: () => this.auth.status(),
            setup: ({ login, password }) => {
                this.auth.setup(login, password);
                return this.auth.status();
            },
            login: ({ login, password }) => {
                this.auth.login(login, password);
                return this.auth.status();
            },
            lock: () => {
                this.auth.lock();
                return this.auth.status();
            },
            change: ({ login, password, newLogin, newPassword }) => {
                this.auth.change(login, password, newLogin, newPassword);
                return this.auth.status();
            },
            remove: ({ login, password }) => {
                this.auth.remove(login, password);
                return this.auth.status();
            }
        };
    }
}

module.exports = AuthController;
