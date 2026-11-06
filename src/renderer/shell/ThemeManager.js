import { ThemeStyle } from '../sdk/ThemeStyle.js';

export class ThemeManager {
    constructor(api, doc, i18n) {
        this.api = api;
        this.doc = doc;
        this.i18n = i18n;
        this.definition = null;
        this.name = null;
        this.listeners = new Set();
    }

    async load() {
        this.definition = await this.api.invoke('config:get', { name: 'themes' });
    }

    names() {
        return Object.entries(this.definition.themes).map(([name, theme]) => ({ name, title: theme.titleKey ? this.i18n.t(theme.titleKey) : theme.title }));
    }

    apply(name) {
        const theme = this.definition.themes[name] || this.definition.themes[this.definition.default];
        this.name = this.definition.themes[name] ? name : this.definition.default;
        ThemeStyle.apply(this.doc, { name: this.name, ...theme });
        this.listeners.forEach((listener) => listener(this.current()));
    }

    current() {
        const theme = this.definition.themes[this.name];
        return { name: this.name, colorScheme: theme.colorScheme, variables: theme.variables, chart: theme.chart };
    }

    onChange(listener) {
        this.listeners.add(listener);
    }
}
