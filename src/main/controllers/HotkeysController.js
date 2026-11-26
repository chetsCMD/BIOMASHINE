const BaseController = require('../core/BaseController');

class HotkeysController extends BaseController {
    constructor(shortcuts) {
        super();
        this.shortcuts = shortcuts;
    }

    get prefix() {
        return 'hotkeys';
    }

    routes() {
        return {
            context: ({ context }) => this.shortcuts.setContext(context),
            contextual: () => this.shortcuts.contextual(),
            contextAdd: (payload) => this.shortcuts.addContextual(payload),
            contextRemove: ({ index }) => this.shortcuts.removeContextual(index),
            macros: () => this.shortcuts.macros(),
            macroSave: (payload) => this.shortcuts.saveMacro(payload),
            macroRemove: ({ id }) => this.shortcuts.removeMacro(id)
        };
    }
}

module.exports = HotkeysController;
