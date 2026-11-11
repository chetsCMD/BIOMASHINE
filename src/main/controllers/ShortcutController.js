const BaseController = require('../core/BaseController');

class ShortcutController extends BaseController {
    constructor(shortcuts) {
        super();
        this.shortcuts = shortcuts;
    }

    get prefix() {
        return 'shortcuts';
    }

    get channel() {
        return this.prefix;
    }

    routes() {
        return {
            list: () => this.shortcuts.list(),
            set: ({ id, binding }) => this.shortcuts.set(id, binding),
            reset: ({ id } = {}) => this.shortcuts.reset(id)
        };
    }
}

module.exports = ShortcutController;
