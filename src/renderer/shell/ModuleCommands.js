import { Navigation } from './Navigation.js';

export class ModuleCommands {
    constructor(getPages, navigate, i18n) {
        this.i18n = i18n;
        this.getPages = getPages;
        this.navigate = navigate;
    }

    provide() {
        const modules = this.getPages().map((page) => ({
            id: `module:${page.id}`,
            title: page.title,
            hint: this.i18n.t(page.source === 'user' ? 'palette.hint.userModule' : 'palette.hint.module'),
            keywords: [page.id, page.description],
            run: () => this.navigate(`module/${page.id}`)
        }));
        const settings = {
            id: 'settings',
            title: this.i18n.t('nav.settings'),
            hint: this.i18n.t('palette.hint.section'),
            keywords: [this.i18n.t('palette.settingsKeywords')],
            run: () => this.navigate(Navigation.SETTINGS_ID)
        };
        return [...modules, settings];
    }
}
