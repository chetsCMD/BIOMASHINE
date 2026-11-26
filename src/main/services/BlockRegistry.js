const fs = require('fs');
const path = require('path');

class BlockRegistry {
    constructor({ config, systemDir, userDir }) {
        this.settings = config.get('builder');
        this.systemDir = systemDir;
        this.userDir = userDir;
        this.problems = [];
        this.typePattern = new RegExp(this.settings.blockTypePattern);
    }

    check(name, manifest) {
        const settings = this.settings;
        if (!manifest || typeof manifest !== 'object' || manifest.type !== name || !this.typePattern.test(name)) {
            return { key: 'block.typeMismatch', params: { dir: name } };
        }
        const title = manifest.title;
        if (!(typeof title === 'string' || (title && typeof title === 'object' && typeof title.en === 'string'))) {
            return { key: 'block.invalidTitle', params: { dir: name } };
        }
        if (!settings.groups.includes(manifest.group)) {
            return { key: 'block.invalidGroup', params: { dir: name } };
        }
        const size = manifest.size;
        if (!size || !(size.w > 0 && size.w <= 1) || !(size.h > 0)) {
            return { key: 'block.invalidSize', params: { dir: name } };
        }
        const props = manifest.props;
        const okProps = Array.isArray(props) && props.every((prop) => prop && typeof prop.name === 'string' && settings.propTypes.includes(prop.type));
        return okProps ? null : { key: 'block.invalidProps', params: { dir: name } };
    }

    scan(dir, source) {
        const found = [];
        if (!dir || !fs.existsSync(dir)) {
            return found;
        }
        for (const name of fs.readdirSync(dir).sort()) {
            const folder = path.join(dir, name);
            const manifestFile = path.join(folder, 'block.json');
            if (name === 'runtime' || !fs.statSync(folder).isDirectory() || !fs.existsSync(manifestFile)) {
                continue;
            }
            try {
                const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8').replace(/^\uFEFF/, ''));
                const problem = this.check(name, manifest) || (fs.existsSync(path.join(folder, 'render.js')) ? null : { key: 'block.missingRender', params: { dir: name } });
                if (problem) {
                    this.problems.push({ dir: name, source, ...problem });
                } else {
                    found.push({ type: manifest.type, title: manifest.title, group: manifest.group, size: manifest.size, props: manifest.props, source, dir: folder });
                }
            } catch (error) {
                this.problems.push({ dir: name, source, key: 'block.invalidJson', params: { message: error.message } });
            }
        }
        return found;
    }

    list() {
        this.problems = [];
        const system = this.scan(this.systemDir, 'system');
        const user = this.scan(this.userDir, 'user').filter((block) => {
            const clash = system.some((item) => item.type === block.type);
            if (clash) {
                this.problems.push({ dir: block.type, source: 'user', key: 'block.duplicate', params: { type: block.type } });
            }
            return !clash;
        });
        return [...system, ...user].map(({ dir, ...rest }) => rest);
    }

    get(type) {
        this.problems = [];
        const all = [...this.scan(this.systemDir, 'system'), ...this.scan(this.userDir, 'user')];
        return all.find((block) => block.type === type) || null;
    }

    errors() {
        this.list();
        return this.problems;
    }

    resolveUrl(requestUrl) {
        let url;
        try {
            url = new URL(requestUrl);
        } catch (error) {
            return undefined;
        }
        if (url.hostname !== 'blocks') {
            return undefined;
        }
        const [, type, file, extra] = url.pathname.split('/');
        if (!this.userDir || !type || extra !== undefined || !this.typePattern.test(type) || !this.settings.blockFiles.includes(file)) {
            return null;
        }
        const target = path.join(this.userDir, type, file);
        return fs.existsSync(target) ? target : null;
    }
}

module.exports = BlockRegistry;
