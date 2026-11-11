const AppError = require('../core/AppError');

class ThemeCatalog {
    static SCHEMES = ['dark', 'light'];
    static REQUIRED_VARIABLES = ['--bg', '--s1', '--s2', '--s3', '--br', '--br2', '--t', '--td', '--tdd', '--tddd', '--wh', '--overlay', '--header-bg'];

    constructor(config) {
        this.config = config;
        this.problems = [];
    }

    check(name, theme) {
        if (!theme || typeof theme !== 'object') {
            return { key: 'theme.notObject' };
        }
        const hasTitle = typeof theme.title === 'string' && theme.title.trim();
        const hasKey = typeof theme.titleKey === 'string' && theme.titleKey.trim();
        if (!hasTitle && !hasKey) {
            return { key: 'theme.titleRequired' };
        }
        if (!ThemeCatalog.SCHEMES.includes(theme.colorScheme)) {
            return { key: 'theme.invalidScheme', params: { schemes: ThemeCatalog.SCHEMES.join(', ') } };
        }
        const missing = ThemeCatalog.REQUIRED_VARIABLES.filter((variable) => typeof (theme.variables || {})[variable] !== 'string');
        if (missing.length > 0) {
            return { key: 'theme.missingVariables', params: { variables: missing.join(', ') } };
        }
        if (!theme.chart || typeof theme.chart.text !== 'string' || typeof theme.chart.grid !== 'string') {
            return { key: 'theme.chartRequired' };
        }
        return null;
    }

    load() {
        const source = this.config.get('themes', { themes: {} });
        this.problems = [];
        const themes = {};
        for (const [name, theme] of Object.entries(source.themes || {})) {
            const problem = this.check(name, theme);
            if (problem) {
                this.problems.push({
                    file: 'themes.json',
                    key: 'theme.invalid',
                    params: { name, reasonKey: problem.key, reasonParams: problem.params }
                });
            } else {
                themes[name] = theme;
            }
        }
        if (Object.keys(themes).length === 0) {
            throw AppError.badRequest('theme.noValidThemes');
        }
        const fallback = themes[source.default] ? source.default : Object.keys(themes)[0];
        return { default: fallback, themes };
    }
}

module.exports = ThemeCatalog;