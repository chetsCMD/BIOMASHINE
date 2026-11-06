class ThemeCatalog {
    static SCHEMES = ['dark', 'light'];
    static REQUIRED_VARIABLES = ['--bg', '--s1', '--s2', '--s3', '--br', '--br2', '--t', '--td', '--tdd', '--tddd', '--wh', '--overlay', '--header-bg'];

    constructor(config) {
        this.config = config;
        this.problems = [];
    }

    check(name, theme) {
        if (!theme || typeof theme !== 'object') {
            return 'не объект';
        }
        const hasTitle = typeof theme.title === 'string' && theme.title.trim();
        const hasKey = typeof theme.titleKey === 'string' && theme.titleKey.trim();
        if (!hasTitle && !hasKey) {
            return 'нет title или titleKey';
        }
        if (!ThemeCatalog.SCHEMES.includes(theme.colorScheme)) {
            return `colorScheme должен быть ${ThemeCatalog.SCHEMES.join(' или ')}`;
        }
        const missing = ThemeCatalog.REQUIRED_VARIABLES.filter((variable) => typeof (theme.variables || {})[variable] !== 'string');
        if (missing.length > 0) {
            return `нет переменных: ${missing.join(', ')}`;
        }
        if (!theme.chart || typeof theme.chart.text !== 'string' || typeof theme.chart.grid !== 'string') {
            return 'нет chart.text и chart.grid';
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
                this.problems.push({ file: 'themes.json', message: `тема «${name}»: ${problem}` });
            } else {
                themes[name] = theme;
            }
        }
        if (Object.keys(themes).length === 0) {
            throw new Error('В themes.json нет ни одной корректной темы');
        }
        const fallback = themes[source.default] ? source.default : Object.keys(themes)[0];
        return { default: fallback, themes };
    }
}

module.exports = ThemeCatalog;
