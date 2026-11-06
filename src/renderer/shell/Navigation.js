import { Dom } from './Dom.js';

export class Navigation {
    static SETTINGS_ID = 'settings';

    constructor(root, i18n) {
        this.root = root;
        this.i18n = i18n;
    }

    render(pages, activeId) {
        Dom.clear(this.root);
        for (const page of pages) {
            this.root.append(this.link(page.id, page.title, `#module/${page.id}`, activeId));
        }
        this.root.append(this.link(Navigation.SETTINGS_ID, this.i18n.t('nav.settings'), `#${Navigation.SETTINGS_ID}`, activeId));
    }

    link(id, title, href, activeId) {
        return Dom.el('a', { class: id === activeId ? 'nav-link active' : 'nav-link', href, text: title });
    }
}
