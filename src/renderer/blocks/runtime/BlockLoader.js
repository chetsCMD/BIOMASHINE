export class BlockLoader {
    constructor({ doc, manifests, systemBase, userBase, allowUser = () => true, importer = (url) => import(url) }) {
        this.doc = doc;
        this.manifests = manifests;
        this.systemBase = systemBase;
        this.userBase = userBase;
        this.allowUser = allowUser;
        this.importer = importer;
        this.cache = new Map();
        this.styles = new Set();
    }

    manifest(type) {
        return this.manifests.find((item) => item.type === type) || null;
    }

    styleOnce(href) {
        if (this.styles.has(href)) {
            return;
        }
        this.styles.add(href);
        const link = this.doc.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        this.doc.head.append(link);
    }

    load(type) {
        const manifest = this.manifest(type);
        if (!manifest || (manifest.source === 'user' && !this.allowUser())) {
            return Promise.reject(new Error(`block ${type} is not available`));
        }
        if (!this.cache.has(type)) {
            const base = manifest.source === 'user' ? this.userBase : this.systemBase;
            if (manifest.source === 'user') {
                this.styleOnce(`${base}${type}/style.css`);
            }
            this.cache.set(type, this.importer(`${base}${type}/render.js`).then((module) => module.default));
        }
        return this.cache.get(type);
    }
}
