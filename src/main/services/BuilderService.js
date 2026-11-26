const fs = require('fs');
const path = require('path');
const AppError = require('../core/AppError');

class BuilderService {
    constructor({ config, blocks, registry, userModulesDir, userBlocksDir, onChanged }) {
        this.settings = config.get('builder');
        this.blocks = blocks;
        this.registry = registry;
        this.userModulesDir = userModulesDir;
        this.userBlocksDir = userBlocksDir;
        this.onChanged = onChanged;
        this.idPattern = new RegExp(this.settings.idPattern);
        this.itemPattern = new RegExp(this.settings.itemPattern);
    }

    folder() {
        if (!this.userModulesDir) {
            throw AppError.badRequest('builder.noFolder');
        }
        return this.userModulesDir;
    }

    manifestOf(id) {
        const file = path.join(this.folder(), id, 'manifest.json');
        if (!this.idPattern.test(id) || !fs.existsSync(file)) {
            throw AppError.notFound('builder.notFound', { id: String(id) });
        }
        const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (!manifest.builder) {
            throw AppError.badRequest('builder.notBuilder', { id });
        }
        return manifest;
    }

    slug(title) {
        const text = title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
        return text || 'module';
    }

    freshId(title) {
        const base = `${this.settings.idPrefix}${this.slug(title)}`;
        let id = base;
        for (let number = 2; this.registry.get(id) || fs.existsSync(path.join(this.folder(), id)); number += 1) {
            id = `${base}-${number}`;
        }
        return id;
    }

    reason(reason) {
        return AppError.badRequest('builder.invalidSpec', { reason });
    }

    spec(raw) {
        const settings = this.settings;
        if (!raw || typeof raw !== 'object' || raw.version !== 1 || !raw.collections || typeof raw.collections !== 'object' || !Array.isArray(raw.blocks)) {
            throw this.reason('shape');
        }
        if (JSON.stringify(raw).length > settings.maxSpecBytes) {
            throw AppError.badRequest('builder.tooLarge', { max: settings.maxSpecBytes });
        }
        const collections = {};
        const names = Object.keys(raw.collections);
        if (names.length > settings.maxCollections) {
            throw this.reason('collections');
        }
        for (const name of names) {
            const collection = raw.collections[name];
            if (!this.itemPattern.test(name) || !collection || !Array.isArray(collection.fields) || collection.fields.length > settings.maxFields) {
                throw this.reason(`collection ${name}`);
            }
            const seen = new Set();
            const fields = collection.fields.map((field) => {
                const valid = field && this.itemPattern.test(field.id) && !seen.has(field.id) && settings.fieldTypes.includes(field.type);
                if (!valid) {
                    throw this.reason(`field ${name}.${field && field.id}`);
                }
                seen.add(field.id);
                const clean = { id: field.id, type: field.type };
                if (typeof field.label === 'string') clean.label = field.label.slice(0, settings.maxTitleLength);
                if (typeof field.unit === 'string') clean.unit = field.unit.slice(0, settings.maxTitleLength);
                if (field.type === 'select') {
                    clean.options = (Array.isArray(field.options) ? field.options : []).filter((item) => typeof item === 'string').slice(0, settings.maxOptions);
                }
                return clean;
            });
            collections[name] = { title: typeof collection.title === 'string' ? collection.title.slice(0, settings.maxTitleLength) : name, fields };
        }
        if (raw.blocks.length > settings.maxBlocks) {
            throw this.reason('blocks');
        }
        const ids = new Set();
        const blocks = raw.blocks.map((block) => {
            const layout = block && block.layout;
            const valid = block && this.itemPattern.test(block.id) && !ids.has(block.id) && this.blocks.get(block.type) && block.props && typeof block.props === 'object' && !Array.isArray(block.props)
                && layout && layout.x >= 0 && layout.w > 0 && layout.x + layout.w <= 1.0001 && layout.y >= 0 && layout.h > 0;
            if (!valid) {
                throw block && block.type && !this.blocks.get(block.type) ? AppError.badRequest('builder.unknownBlock', { type: String(block.type) }) : this.reason(`block ${block && block.id}`);
            }
            ids.add(block.id);
            return { id: block.id, type: block.type, props: block.props, layout: { x: Math.round(layout.x * 10000) / 10000, y: Math.round(layout.y), w: Math.round(layout.w * 10000) / 10000, h: Math.round(layout.h) } };
        });
        return { version: 1, collections, blocks };
    }

    escape(text) {
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    page(title, spec) {
        const data = JSON.stringify(spec).replace(/</g, '\\u003c');
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${this.escape(title)}</title>
    <link rel="stylesheet" href="bm://app/vendor/fonts/fonts.css">
    <link rel="stylesheet" href="bm://app/shared/base.css">
    <link rel="stylesheet" href="bm://app/shared/components.css">
    <link rel="stylesheet" href="bm://app/blocks/runtime/runtime.css">
    <script src="bm://app/vendor/chart.min.js"></script>
    <script type="module" src="bm://app/blocks/runtime/main.js"></script>
</head>
<body>
<main class="bm-page">
    <div id="bmb-root"></div>
    <script type="application/json" id="bmb-spec">${data}</script>
</main>
</body>
</html>
`;
    }

    list() {
        if (!this.userModulesDir) {
            return [];
        }
        const dir = this.folder();
        if (!fs.existsSync(dir)) {
            return [];
        }
        const found = [];
        for (const name of fs.readdirSync(dir).sort()) {
            const file = path.join(dir, name, 'manifest.json');
            try {
                const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
                if (manifest.builder) {
                    found.push({ id: manifest.id, title: manifest.title, description: manifest.description || '', category: manifest.category || 'other' });
                }
            } catch (error) {
                continue;
            }
        }
        return found;
    }

    load(id) {
        const manifest = this.manifestOf(id);
        const spec = JSON.parse(fs.readFileSync(path.join(this.folder(), id, 'spec.json'), 'utf8'));
        return { id, title: manifest.title, description: manifest.description || '', category: manifest.category || 'other', spec };
    }

    copyBlock(from, to) {
        fs.mkdirSync(to, { recursive: true });
        for (const file of this.settings.blockFiles) {
            if (fs.existsSync(path.join(from, file))) {
                fs.copyFileSync(path.join(from, file), path.join(to, file));
            }
        }
    }

    save({ id, title, description = '', category = 'other', spec }) {
        const settings = this.settings;
        if (typeof title !== 'string' || !title.trim() || title.length > settings.maxTitleLength) {
            throw AppError.badRequest('builder.invalidTitle', { max: settings.maxTitleLength });
        }
        if (!settings.categories.includes(category)) {
            throw this.reason('category');
        }
        const clean = this.spec(spec);
        let previous = null;
        if (id) {
            previous = this.manifestOf(id);
        }
        const moduleId = id || this.freshId(title.trim());
        const dir = path.join(this.folder(), moduleId);
        fs.mkdirSync(dir, { recursive: true });
        const used = [...new Set(clean.blocks.map((block) => block.type))].map((type) => this.blocks.get(type)).filter((block) => block && block.source === 'user');
        for (const block of used) {
            this.copyBlock(block.dir, path.join(dir, 'blocks', block.type));
        }
        const manifest = {
            id: moduleId,
            kind: 'page',
            title: title.trim(),
            version: previous ? previous.version : '1.0.0',
            description: String(description).slice(0, settings.maxTitleLength * 3),
            category,
            entry: 'index.html',
            hideable: true,
            i18n: false,
            builder: { version: 1 },
            channels: ['blocks:list']
        };
        if (previous && previous.order !== undefined) manifest.order = previous.order;
        fs.writeFileSync(path.join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
        fs.writeFileSync(path.join(dir, 'spec.json'), `${JSON.stringify(clean, null, 2)}\n`);
        fs.writeFileSync(path.join(dir, 'index.html'), this.page(manifest.title, clean));
        this.onChanged();
        return { id: moduleId };
    }

    remove(id) {
        this.manifestOf(id);
        fs.rmSync(path.join(this.folder(), id), { recursive: true, force: true });
        this.onChanged();
    }

    exportBundle(id) {
        const loaded = this.load(id);
        const types = [...new Set(loaded.spec.blocks.map((block) => block.type))];
        const blocks = [];
        for (const type of types) {
            const block = this.blocks.get(type);
            if (block && block.source === 'user') {
                const files = {};
                for (const file of this.settings.blockFiles) {
                    const target = path.join(block.dir, file);
                    if (fs.existsSync(target)) files[file] = fs.readFileSync(target, 'utf8');
                }
                blocks.push({ type, files });
            }
        }
        return { format: this.settings.bundleFormat, version: this.settings.bundleVersion, manifest: { title: loaded.title, description: loaded.description, category: loaded.category }, requires: types, spec: loaded.spec, blocks };
    }

    bundle(data) {
        const settings = this.settings;
        if (!data || data.format !== settings.bundleFormat || data.version !== settings.bundleVersion || !data.manifest || !data.spec || !Array.isArray(data.blocks)) {
            throw AppError.badRequest('builder.invalidBundle');
        }
        if (JSON.stringify(data).length > settings.maxBundleBytes) {
            throw AppError.badRequest('builder.bundleTooLarge', { max: settings.maxBundleBytes });
        }
        const typePattern = new RegExp(settings.blockTypePattern);
        for (const block of data.blocks) {
            const valid = block && typePattern.test(block.type) && block.files && typeof block.files === 'object' && typeof block.files['block.json'] === 'string' && typeof block.files['render.js'] === 'string'
                && Object.entries(block.files).every(([name, text]) => settings.blockFiles.includes(name) && typeof text === 'string' && text.length <= settings.maxBlockFileBytes);
            if (!valid) {
                throw AppError.badRequest('builder.invalidBundle');
            }
        }
        return data;
    }

    inspectBundle(data) {
        const bundle = this.bundle(data);
        return {
            title: String(bundle.manifest.title || ''),
            blocks: bundle.blocks.map((block) => ({ type: block.type, installed: Boolean(this.blocks.get(block.type)), bytes: Object.values(block.files).reduce((total, text) => total + text.length, 0) })),
            requires: Array.isArray(bundle.requires) ? bundle.requires : []
        };
    }

    importBundle(data) {
        const bundle = this.bundle(data);
        if (!this.userBlocksDir) {
            throw AppError.badRequest('builder.noFolder');
        }
        const installed = [];
        for (const block of bundle.blocks) {
            if (!this.blocks.get(block.type)) {
                const target = path.join(this.userBlocksDir, block.type);
                fs.mkdirSync(target, { recursive: true });
                for (const [name, text] of Object.entries(block.files)) {
                    fs.writeFileSync(path.join(target, name), text);
                }
                installed.push(block.type);
            }
        }
        const saved = this.save({ title: String(bundle.manifest.title || 'module'), description: bundle.manifest.description || '', category: bundle.manifest.category || 'other', spec: bundle.spec });
        return { id: saved.id, installedBlocks: installed };
    }
}

module.exports = BuilderService;
