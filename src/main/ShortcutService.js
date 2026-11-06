class ShortcutService {
    constructor(shortcuts, actions) {
        this.shortcuts = shortcuts;
        this.actions = actions;
    }

    match(input) {
        if (input.type !== 'keyDown' || input.alt || input.shift) {
            return null;
        }
        const modifier = Boolean(input.control || input.meta);
        for (const [name, shortcut] of Object.entries(this.shortcuts)) {
            if (input.code === shortcut.code && modifier === Boolean(shortcut.ctrlOrMeta)) {
                return name;
            }
        }
        return null;
    }

    attach(contents) {
        contents.on('before-input-event', (event, input) => {
            const name = this.match(input);
            if (name && this.actions[name]) {
                event.preventDefault();
                this.actions[name]();
            }
        });
    }
}

module.exports = ShortcutService;
