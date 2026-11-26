export class HotkeyContext {
    constructor({ api, win, getPrimary, getPages, settingsId, hubId, pollMs }) {
        this.api = api;
        this.win = win;
        this.getPrimary = getPrimary;
        this.getPages = getPages;
        this.settingsId = settingsId;
        this.hubId = hubId;
        this.pollMs = pollMs;
        this.last = null;
        this.timer = null;
    }

    context() {
        const id = this.getPrimary();
        if (!id) {
            return 'global';
        }
        if (id === this.settingsId) {
            return 'view:settings';
        }
        if (id === this.hubId) {
            return 'view:hub';
        }
        return this.getPages().some((page) => page.id === id) ? `module:${id}` : 'global';
    }

    async report() {
        const context = this.context();
        if (context === this.last) {
            return;
        }
        this.last = context;
        try {
            await this.api.invoke('hotkeys:context', { context });
        } catch (error) {
            this.last = null;
        }
    }

    start() {
        this.last = null;
        if (this.timer === null) {
            this.timer = this.win.setInterval(() => this.report(), this.pollMs);
        }
        return this.report();
    }
}
