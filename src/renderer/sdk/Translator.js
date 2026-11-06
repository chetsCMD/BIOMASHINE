export class Translator {
    static EMPTY = { language: 'en', locale: 'en-US', strings: {} };

    constructor(bundle = Translator.EMPTY) {
        this.missing = new Set();
        this.load(bundle);
    }

    load(bundle) {
        this.language = bundle.language;
        this.locale = bundle.locale;
        this.strings = bundle.strings;
        try {
            this.rules = new Intl.PluralRules(bundle.locale);
        } catch (error) {
            this.rules = new Intl.PluralRules('en');
        }
    }

    has(key) {
        return Object.prototype.hasOwnProperty.call(this.strings, key);
    }

    t(key, params = {}) {
        if (!this.has(key)) {
            this.missing.add(key);
            return key;
        }
        const entry = this.strings[key];
        const template = typeof entry === 'string' ? entry : entry[this.rules.select(Number(params.count))] || entry.other;
        return template.replace(/\{(\w+)\}/g, (placeholder, name) => (name in params ? String(params[name]) : placeholder));
    }
}
