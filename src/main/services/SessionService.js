const AppError = require('../core/AppError');

class SessionService {
    static KEYS = { mode: 'session.mode', state: 'session.state' };

    constructor(store, config) {
        this.store = store;
        this.settings = config.get('session');
    }

    mode() {
        const stored = this.store.get(SessionService.KEYS.mode);
        return this.settings.modes.includes(stored) ? stored : this.settings.defaultMode;
    }

    setMode(mode) {
        if (!this.settings.modes.includes(mode)) {
            throw AppError.badRequest('session.invalidMode');
        }
        this.store.set(SessionService.KEYS.mode, mode);
    }

    save(state) {
        if (!state || typeof state !== 'object' || Array.isArray(state) || state.version !== 1) {
            throw AppError.badRequest('session.invalidState');
        }
        if (JSON.stringify(state).length > this.settings.maxStateBytes) {
            throw AppError.badRequest('session.stateTooLarge', { max: this.settings.maxStateBytes });
        }
        this.store.set(SessionService.KEYS.state, state);
    }

    load() {
        return this.store.get(SessionService.KEYS.state) || null;
    }

    clear() {
        this.store.remove(SessionService.KEYS.state);
    }
}

module.exports = SessionService;
