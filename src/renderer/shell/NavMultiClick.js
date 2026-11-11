export class NavMultiClick {
    constructor({ root, isPage, onOpen, document }) {
        this.root = root;
        this.isPage = isPage;
        this.onOpen = onOpen;
        this.document = document;
        this.handler = (event) => this.handle(event);
    }

    attach() {
        this.document.addEventListener('click', this.handler, true);
        return this;
    }

    detach() {
        this.document.removeEventListener('click', this.handler, true);
    }

    handle(event) {
        if (!event.ctrlKey && !event.metaKey) {
            return;
        }
        const target = event.target && typeof event.target.closest === 'function'
            ? event.target.closest('a, button, [data-id], [data-module-id]')
            : null;
        if (!target || !this.root.contains(target)) {
            return;
        }
        let id = target.dataset.moduleId || target.dataset.id || null;
        if (!id) {
            const href = target.getAttribute('href') || '';
            const match = href.match(/^#?module\/([^/?#]+)/);
            if (match) {
                id = match[1];
            }
        }
        if (!id || !this.isPage(id)) {
            return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        this.onOpen(id);
    }
}
