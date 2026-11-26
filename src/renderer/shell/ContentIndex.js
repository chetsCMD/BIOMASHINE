import { ModuleBridge } from './ModuleBridge.js';

export class ContentIndex {
    constructor({ api, win }) {
        this.api = api;
        this.win = win;
        this.config = null;
        this.available = false;
        this.busy = false;
        this.last = new Map();
    }

    async start() {
        this.config = await this.api.invoke('config:get', { name: 'search' });
        this.win.setInterval(() => this.tick(), this.config.snapshot.intervalMs);
    }

    setAvailable(available) {
        this.available = available;
    }

    async tick() {
        if (!this.available || this.busy) {
            return;
        }
        this.busy = true;
        try {
            for (const bridge of [...ModuleBridge.live]) {
                const id = bridge.key();
                if (!bridge.frame || !bridge.frame.isConnected || !id) {
                    continue;
                }
                const lines = await bridge.textLines(this.config.snapshot, this.config.snapshot.timeoutMs);
                if (lines && lines.join('\n') !== this.last.get(id)) {
                    this.last.set(id, lines.join('\n'));
                    await this.api.invoke('search:snapshot', { module: id, lines });
                }
            }
        } catch (error) {
            this.last.clear();
        } finally {
            this.busy = false;
        }
    }
}
