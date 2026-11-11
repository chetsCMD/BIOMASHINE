const MessageTranslator = require('../core/MessageTranslator');

class MessageService {
    constructor({ locales, language }) {
        this.locales = locales;
        this.getLanguage = typeof language === 'function' ? language : () => language || 'en';
        this.current = null;
    }

    translator() {
        const language = this.getLanguage();
        if (!this.current || this.current.language !== language) {
            const bundle = this.locales.bundle('backend', language);
            this.current = new MessageTranslator(bundle);
        }
        return this.current;
    }

    t(key, params) {
        return this.translator().t(key, params);
    }
}

module.exports = MessageService;