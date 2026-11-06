export class PluginStyles {
    static ATTRIBUTE = 'data-bm-plugin';

    constructor(doc) {
        this.doc = doc;
    }

    apply(urls) {
        this.doc.head.querySelectorAll(`link[${PluginStyles.ATTRIBUTE}]`).forEach((link) => link.remove());
        for (const href of urls) {
            const link = this.doc.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.setAttribute(PluginStyles.ATTRIBUTE, '');
            this.doc.head.append(link);
        }
    }
}
