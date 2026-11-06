export class DomTranslator {
    static PREFIX = 'data-i18n';

    static apply(root, translator) {
        for (const node of root.querySelectorAll('*')) {
            for (const name of node.getAttributeNames()) {
                if (name !== DomTranslator.PREFIX && !name.startsWith(`${DomTranslator.PREFIX}-`)) {
                    continue;
                }
                const text = translator.t(node.getAttribute(name));
                if (name === DomTranslator.PREFIX) {
                    node.textContent = text;
                } else {
                    node.setAttribute(name.slice(DomTranslator.PREFIX.length + 1), text);
                }
            }
        }
    }
}
