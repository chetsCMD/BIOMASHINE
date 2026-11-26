export class MacroRunner {
    constructor({ api, win, perform }) {
        this.api = api;
        this.win = win;
        this.perform = perform;
        this.running = false;
    }

    async run(id) {
        if (this.running) {
            return;
        }
        const macro = (await this.api.invoke('hotkeys:macros')).find((item) => item.id === id);
        if (!macro) {
            return;
        }
        this.running = true;
        try {
            for (const step of macro.steps) {
                if (step.startsWith('wait:')) {
                    await new Promise((resolve) => this.win.setTimeout(resolve, Number(step.slice('wait:'.length))));
                } else {
                    await this.perform(step);
                }
            }
        } finally {
            this.running = false;
        }
    }
}
