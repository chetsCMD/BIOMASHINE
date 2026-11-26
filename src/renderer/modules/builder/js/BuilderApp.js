import { BuilderCollections } from './BuilderCollections.js';
import { BuilderInspector } from './BuilderInspector.js';
import { BuilderPalette } from './BuilderPalette.js';
import { BuilderRepository } from './BuilderRepository.js';
import { BuilderState } from './BuilderState.js';
import { BuilderToolbar } from './BuilderToolbar.js';

export class BuilderApp {
    constructor(bm, doc) {
        this.bm = bm;
        this.doc = doc;
        this.repository = new BuilderRepository(bm);
        this.currentId = null;
        this.consent = false;
        this.runtime = null;
        this.kit = null;
    }

    el(tag, className = '', text = '') {
        const element = this.doc.createElement(tag);
        if (className) {
            element.className = className;
        }
        if (text) {
            element.textContent = text;
        }
        return element;
    }

    setVar(element, name, value) {
        if (element.style && element.style.setProperty) {
            element.style.setProperty(name, String(value));
        }
    }

    async loadRuntime() {
        const base = this.settings.systemBlocksBase;
        try {
            const [runtime, loader, memory] = await Promise.all([import(`${base}runtime/BlockRuntime.js`), import(`${base}runtime/BlockLoader.js`), import(`${base}runtime/MemoryStore.js`)]);
            return { BlockRuntime: runtime.BlockRuntime, BlockLoader: loader.BlockLoader, MemoryStore: memory.MemoryStore };
        } catch (error) {
            return null;
        }
    }

    async start() {
        this.settings = await this.bm.config('builder');
        this.limits = await this.bm.config('canvas');
        this.manifests = await this.repository.blocks();
        this.kit = await this.loadRuntime();
        this.state = new BuilderState(this.settings.newBlockGapPx);
        this.loader = this.kit
            ? new this.kit.BlockLoader({ doc: this.doc, manifests: this.manifests, systemBase: this.settings.systemBlocksBase, userBase: this.settings.userBlocksBase, allowUser: () => this.consent })
            : null;
        this.toolbar = new BuilderToolbar({
            bm: this.bm,
            doc: this.doc,
            categories: this.settings.categories,
            actions: {
                open: (id) => this.open(id),
                create: () => this.create(),
                save: () => this.save(),
                remove: () => this.remove(),
                export: () => this.export(),
                import: (file) => this.import(file),
                blocks: () => this.repository.openBlocksFolder(),
                rescan: () => this.rescan()
            }
        });
        this.palette = new BuilderPalette({ bm: this.bm, doc: this.doc, groups: this.settings.groups, onPick: (manifest) => this.add(manifest) });
        this.root = this.doc.getElementById('builder-root');
        this.layout();
        if (this.doc.defaultView) {
            this.doc.defaultView.addEventListener('resize', () => this.fit());
        }
        await this.refreshModules();
        await this.draw();
    }

    layout() {
        this.root.textContent = '';
        const grid = this.el('div', 'builder');
        grid.append(this.toolbar.render());
        this.left = this.el('div');
        this.stage = this.el('div', 'builder-stage');
        this.fitBox = this.el('div', 'builder-fit');
        this.page = this.el('div', 'builder-page');
        this.fitBox.append(this.page);
        this.stage.append(this.fitBox);
        this.right = this.el('div');
        grid.append(this.left, this.stage, this.right);
        this.root.append(grid);
    }

    fit() {
        const width = this.settings.pageWidthPx;
        const available = Math.max((this.stage.clientWidth || width + this.settings.stagePaddingPx) - this.settings.stagePaddingPx, 1);
        const scale = Math.min(available / width, 1);
        const height = Math.max(this.settings.pageHeightPx, this.state.bottom() + this.settings.newBlockGapPx);
        this.setVar(this.page, '--builder-page-width', `${width}px`);
        this.setVar(this.page, '--builder-page-height', `${height}px`);
        this.setVar(this.page, '--builder-scale', scale);
        this.setVar(this.page, '--bmb-inverse', 1 / scale);
        this.setVar(this.page, '--bmb-grid', `${this.limits.snapPx}px`);
        this.setVar(this.fitBox, '--builder-fit-height', `${height * scale}px`);
    }

    async refreshModules() {
        this.toolbar.setModules(await this.repository.list(), this.currentId);
    }

    async ensureConsent(manifest) {
        if (!manifest || manifest.source !== 'user' || this.consent) {
            return true;
        }
        this.consent = await this.bm.confirm(this.bm.t('confirm.userBlocks'), { danger: true });
        return this.consent;
    }

    async add(manifest) {
        if (await this.ensureConsent(manifest)) {
            this.state.addBlock(manifest);
            await this.draw();
        }
    }

    side() {
        this.left.textContent = '';
        this.left.append(this.palette.render(this.manifests));
        this.left.append(new BuilderCollections({ bm: this.bm, doc: this.doc, state: this.state, fieldTypes: this.settings.fieldTypes, onChange: () => this.draw() }).render());
        this.right.textContent = '';
        const inspector = new BuilderInspector({
            bm: this.bm,
            doc: this.doc,
            state: this.state,
            onChange: (id, patch) => {
                this.state.setProps(id, patch);
                this.draw();
            },
            onRemove: (id) => {
                this.state.removeBlock(id);
                this.draw();
            }
        });
        this.right.append(inspector.render(this.manifests));
        this.right.append(this.el('div', 'builder-hint', this.bm.t('hint.canvas')));
    }

    async draw() {
        this.side();
        this.fit();
        if (this.runtime) {
            this.runtime.destroy();
            this.runtime = null;
        }
        if (!this.kit) {
            this.page.textContent = this.bm.t('status.error', { message: 'runtime' });
            return;
        }
        this.runtime = new this.kit.BlockRuntime({
            bm: this.bm,
            doc: this.doc,
            win: this.doc.defaultView,
            root: this.page,
            store: new this.kit.MemoryStore(this.bm),
            loader: this.loader,
            mode: 'edit',
            limits: this.limits,
            onSelect: (id) => {
                if (this.state.selected !== id) {
                    this.state.selected = id;
                    this.side();
                }
            },
            onLayout: (id, layout, commit) => {
                this.state.setLayout(id, layout);
                this.fit();
                if (commit) {
                    this.side();
                }
            },
            onDelete: (id) => {
                this.state.removeBlock(id);
                this.draw();
            }
        });
        await this.runtime.start(this.state.toSpec());
        if (this.state.selected) {
            this.runtime.select(this.state.selected);
        }
    }

    create() {
        this.currentId = null;
        this.state.reset();
        this.toolbar.setMeta({});
        this.refreshModules();
        return this.draw();
    }

    async rescan() {
        this.manifests = await this.repository.rescanBlocks();
        if (this.loader) {
            this.loader.manifests = this.manifests;
        }
        await this.draw();
    }

    async open(id) {
        const loaded = await this.repository.load(id);
        const user = loaded.spec.blocks.map((block) => this.manifests.find((item) => item.type === block.type)).find((item) => item && item.source === 'user');
        if (user && !(await this.ensureConsent(user))) {
            return;
        }
        this.currentId = id;
        this.state.load(loaded.spec);
        this.toolbar.setMeta(loaded);
        await this.draw();
        this.toolbar.setStatus(this.bm.t('status.loaded'));
    }

    async guarded(work) {
        try {
            await work();
        } catch (error) {
            this.toolbar.setStatus(this.bm.t('status.error', { message: error.message }));
        }
    }

    save() {
        return this.guarded(async () => {
            const result = await this.repository.save({ id: this.currentId || undefined, ...this.toolbar.meta(), spec: this.state.toSpec() });
            this.currentId = result.id;
            await this.refreshModules();
            this.toolbar.setStatus(this.bm.t('status.saved'));
        });
    }

    remove() {
        return this.guarded(async () => {
            if (!this.currentId) {
                this.toolbar.setStatus(this.bm.t('status.nothing'));
                return;
            }
            if (await this.bm.confirm(this.bm.t('confirm.remove'), { danger: true })) {
                await this.repository.remove(this.currentId);
                await this.create();
                this.toolbar.setStatus(this.bm.t('status.removed'));
            }
        });
    }

    export() {
        return this.guarded(async () => {
            if (!this.currentId) {
                this.toolbar.setStatus(this.bm.t('status.nothing'));
                return;
            }
            const result = await this.repository.exportBundle(this.currentId);
            this.toolbar.setStatus(result && result.path ? this.bm.t('status.exported', { path: result.path }) : this.bm.t('status.nothing'));
        });
    }

    import(file) {
        return this.guarded(async () => {
            const data = JSON.parse(await file.text());
            const info = await this.repository.inspect(data);
            const types = info.blocks.map((block) => block.type).join(', ');
            if (info.blocks.length > 0 && !(await this.bm.confirm(this.bm.t('confirm.importBlocks', { types }), { danger: true }))) {
                return;
            }
            const result = await this.repository.importBundle(data);
            this.manifests = await this.repository.blocks();
            if (this.loader) {
                this.loader.manifests = this.manifests;
            }
            this.consent = this.consent || info.blocks.length > 0;
            await this.refreshModules();
            await this.open(result.id);
            this.toolbar.setStatus(this.bm.t('status.imported'));
        });
    }
}
