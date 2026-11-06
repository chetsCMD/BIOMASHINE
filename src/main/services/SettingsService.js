const AppError = require('../core/AppError');

class SettingsService {
    constructor(repository, config, system, catalog, locales, clock) {
        this.repository = repository;
        this.defaults = config.get('app.settingsDefaults');
        const themes = catalog.load();
        this.themes = Object.keys(themes.themes);
        this.defaultTheme = this.themes.includes(this.defaults.theme) ? this.defaults.theme : themes.default;
        this.excludedPrefix = config.get('app.export.excludeSettingsPrefix');
        this.system = system;
        this.locales = locales;
        this.clock = clock;
        this.validators = {
            timezone: (value) => typeof value === 'string' && this.clock.isValid(value),
            language: (value) => typeof value === 'string' && this.locales.has(value),
            theme: (value) => this.themes.includes(value),
            autostart: (value) => typeof value === 'boolean'
        };
    }

    getAll() {
        const stored = this.repository.all();
        const result = { ...this.defaults, theme: this.defaultTheme, language: this.locales.detect(null) };
        for (const key of Object.keys(this.defaults)) {
            const valid = key === 'theme' ? this.themes.includes(stored[key]) : key === 'language' ? this.locales.has(stored[key]) : key === 'timezone' ? this.clock.isValid(stored[key]) : true;
            if (key in stored && valid) {
                result[key] = stored[key];
            }
        }
        return result;
    }

    set(key, value) {
        const validator = this.validators[key];
        if (!validator) {
            throw AppError.badRequest(`Неизвестная настройка: ${key}`);
        }
        if (!validator(value)) {
            throw AppError.badRequest(`Недопустимое значение настройки: ${key}`);
        }
        this.repository.set(key, value);
        if (key === 'timezone') {
            this.clock.reload();
        }
        if (key === 'autostart') {
            this.system.applyAutostart(value);
        }
        return this.getAll();
    }

    ensureLanguage(systemLocale) {
        const stored = this.repository.get('language');
        if (typeof stored === 'string' && this.locales.has(stored)) {
            return stored;
        }
        const detected = this.locales.detect(systemLocale);
        this.repository.set('language', detected);
        return detected;
    }

    relaunch() {
        this.system.relaunch();
    }

    applyStored() {
        this.system.applyAutostart(this.getAll().autostart);
    }
}

module.exports = SettingsService;
