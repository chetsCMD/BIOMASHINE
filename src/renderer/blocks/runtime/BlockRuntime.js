import { BlockBus } from './BlockBus.js';
import { BlockEditor } from './BlockEditor.js';
import { CanvasGeometry } from '../../sdk/CanvasGeometry.js';

export class BlockRuntime {
    constructor({ bm, doc, win = null, root, store, loader, mode = 'run', limits = null, onSelect = () => {}, onLayout = () => {}, onDelete = () => {} }) {
        this.bm = bm;
        this.doc = doc;
        this.win = win;
        this.root = root;
        this.store = store;
        this.loader = loader;
        this.mode = mode;
        this.limits = limits;
        this.onSelect = onSelect;
        this.onLayout = onLayout;
        this.onDelete = onDelete;
        this.spec = null;
        this.instances = new Map();
        this.wrappers = new Map();
        this.editor = null;
        this.canvas = null;
    }

    async start(spec) {
        this.spec = spec;
        await this.render();
    }

    layoutOf(id) {
        return this.spec.blocks.find((block) => block.id === id).layout;
    }

    context(block) {
        return {
            blockId: block.id,
            props: block.props,
            bm: this.bm,
            doc: this.doc,
            t: (key, params) => this.bm.t(key, params),
            store: this.store,
            bus: this.bus,
            spec: this.spec,
            collection: (name) => this.spec.collections[name] || null
        };
    }

    setVar(element, name, value) {
        if (element.style && element.style.setProperty) {
            element.style.setProperty(name, String(value));
        }
    }

    place(wrapper, layout) {
        this.setVar(wrapper, '--bmb-x', layout.x);
        this.setVar(wrapper, '--bmb-w', layout.w);
        this.setVar(wrapper, '--bmb-y', `${layout.y}px`);
        this.setVar(wrapper, '--bmb-h', `${layout.h}px`);
    }

    resize() {
        const bottom = CanvasGeometry.contentBottom(Object.fromEntries(this.spec.blocks.map((block) => [block.id, block.layout])));
        this.setVar(this.canvas, '--bmb-canvas-height', `${bottom}px`);
    }

    async mountBlock(block) {
        const wrapper = this.doc.createElement('div');
        wrapper.className = 'bmb-block';
        wrapper.setAttribute('data-bm-block', block.id);
        wrapper.setAttribute('data-bmb-id', block.id);
        const content = this.doc.createElement('div');
        content.className = 'bmb-content';
        wrapper.append(content);
        this.canvas.append(wrapper);
        this.wrappers.set(block.id, wrapper);
        this.place(wrapper, block.layout);
        try {
            const BlockClass = await this.loader.load(block.type);
            const instance = new BlockClass(this.context(block));
            await instance.mount(content);
            this.instances.set(block.id, instance);
        } catch (error) {
            content.className = 'bmb-content bmb-error';
            content.textContent = `${this.bm.t('block.loadFailed')}: ${block.type}`;
        }
    }

    async render() {
        this.destroy();
        this.root.textContent = '';
        this.bus = new BlockBus();
        this.canvas = this.doc.createElement('div');
        this.canvas.className = this.mode === 'edit' ? 'bmb-canvas bmb-editing' : 'bmb-canvas';
        this.root.append(this.canvas);
        for (const block of this.spec.blocks) {
            await this.mountBlock(block);
        }
        this.resize();
        if (this.mode === 'edit' && this.win) {
            this.editor = new BlockEditor({
                canvas: this.canvas,
                doc: this.doc,
                win: this.win,
                limits: this.limits,
                layoutOf: (id) => this.layoutOf(id),
                onSelect: (id) => this.onSelect(id),
                onLayout: (id, layout, commit) => {
                    this.layoutOf(id).x = layout.x;
                    this.layoutOf(id).y = layout.y;
                    this.layoutOf(id).w = layout.w;
                    this.layoutOf(id).h = layout.h;
                    this.place(this.wrappers.get(id), layout);
                    this.resize();
                    this.onLayout(id, layout, commit);
                },
                onDelete: (id) => this.onDelete(id)
            });
            this.editor.enable();
        }
    }

    select(id) {
        if (this.editor && this.wrappers.has(id)) {
            this.editor.select(id);
        }
    }

    destroy() {
        if (this.editor) {
            this.editor.disable();
            this.editor = null;
        }
        this.instances.forEach((instance) => instance.destroy && instance.destroy());
        this.instances = new Map();
        this.wrappers = new Map();
    }
}
