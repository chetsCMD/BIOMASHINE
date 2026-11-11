class MessageTranslator {
    constructor({ language, locale, strings } = {}) {
        this.language = language || 'en';
        this.locale = locale || this.language;
        this.strings = strings && typeof strings === 'object' && !Array.isArray(strings) ? strings : {};
        this.missing = new Set();
        this.pluralRules = this.rulesFor(this.locale);
    }

    rulesFor(locale) {
        try {
            return new Intl.PluralRules(locale);
        } catch (error) {
            return new Intl.PluralRules('en');
        }
    }

    has(key) {
        return Object.prototype.hasOwnProperty.call(this.strings, key);
    }

    t(key, params) {
        const value = this.strings[key];
        if (value === undefined) {
            this.missing.add(key);
            return key;
        }
        if (typeof value === 'string') {
            return this.interpolate(value, params);
        }
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            const numeric = params && params.count !== undefined ? Number(params.count) : NaN;
            const category = Number.isFinite(numeric) ? this.pluralRules.select(numeric) : 'other';
            const text = value[category] || value.other || '';
            return this.interpolate(text, params);
        }
        return key;
    }

    interpolate(text, params) {
        if (!params || typeof params !== 'object') {
            return text;
        }
        return String(text).replace(/\{(\w+)\}/g, (match, name) => {
            const value = params[name];
            return value === undefined || value === null ? match : String(value);
        });
    }

    load({ language, locale, strings } = {}) {
        this.language = language || this.language;
        this.locale = locale || this.language;
        this.strings = strings && typeof strings === 'object' && !Array.isArray(strings) ? strings : {};
        this.pluralRules = this.rulesFor(this.locale);
        return this;
    }
}

module.exports = MessageTranslator;