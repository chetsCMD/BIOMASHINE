const path = require('path');

class AssetResolver {
    constructor({ appRoot, appHost, registry }) {
        this.appRoot = path.resolve(appRoot);
        this.appHost = appHost;
        this.registry = registry;
    }

    baseFor(host) {
        if (host === this.appHost) {
            return this.appRoot;
        }
        const module = this.registry.get(host);
        return module ? module.dir : null;
    }

    resolve(requestUrl) {
        let url;
        try {
            url = new URL(requestUrl);
        } catch (error) {
            return null;
        }
        const base = this.baseFor(url.hostname);
        if (!base) {
            return null;
        }
        let relative;
        try {
            relative = decodeURIComponent(url.pathname);
        } catch (error) {
            return null;
        }
        if (relative.includes('\0')) {
            return null;
        }
        const target = path.resolve(base, `.${path.posix.normalize(`/${relative}`)}`);
        if (target !== base && !target.startsWith(base + path.sep)) {
            return null;
        }
        return target;
    }
}

module.exports = AssetResolver;
