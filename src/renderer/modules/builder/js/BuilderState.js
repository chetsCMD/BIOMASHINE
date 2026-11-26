export class BuilderState {
    static ITEM = /^[a-z][a-z0-9-]{0,35}$/;

    constructor(gap) {
        this.gap = gap;
        this.reset();
    }

    reset() {
        this.spec = { version: 1, collections: {}, blocks: [] };
        this.selected = null;
        this.counter = 0;
    }

    load(spec) {
        this.spec = JSON.parse(JSON.stringify(spec));
        this.selected = null;
        this.counter = Math.max(0, ...this.spec.blocks.map((block) => Number(String(block.id).replace(/\D/g, '')) || 0));
    }

    toSpec() {
        return JSON.parse(JSON.stringify(this.spec));
    }

    block(id) {
        return this.spec.blocks.find((block) => block.id === id) || null;
    }

    bottom() {
        return this.spec.blocks.reduce((bottom, block) => Math.max(bottom, block.layout.y + block.layout.h), 0);
    }

    addBlock(manifest) {
        this.counter += 1;
        const id = `b${this.counter}`;
        const props = {};
        for (const prop of manifest.props) {
            if (prop.default !== undefined) {
                props[prop.name] = JSON.parse(JSON.stringify(prop.default));
            }
        }
        const bottom = this.bottom();
        this.spec.blocks.push({ id, type: manifest.type, props, layout: { x: Math.min(0.05, 1 - manifest.size.w), y: bottom + this.gap, w: manifest.size.w, h: manifest.size.h } });
        this.selected = id;
        return id;
    }

    removeBlock(id) {
        this.spec.blocks = this.spec.blocks.filter((block) => block.id !== id);
        if (this.selected === id) {
            this.selected = null;
        }
    }

    setProps(id, patch) {
        const block = this.block(id);
        if (block) {
            block.props = { ...block.props, ...patch };
        }
    }

    setLayout(id, layout) {
        const block = this.block(id);
        if (block) {
            block.layout = { x: layout.x, y: layout.y, w: layout.w, h: layout.h };
        }
    }

    addCollection(id, title) {
        if (!BuilderState.ITEM.test(id) || this.spec.collections[id]) {
            return false;
        }
        this.spec.collections[id] = { title: title || id, fields: [] };
        return true;
    }

    removeCollection(id) {
        delete this.spec.collections[id];
    }

    addField(collection, field) {
        const target = this.spec.collections[collection];
        if (!target || !BuilderState.ITEM.test(field.id) || target.fields.some((item) => item.id === field.id)) {
            return false;
        }
        target.fields.push({ id: field.id, type: field.type, ...(field.type === 'select' ? { options: field.options || [] } : {}) });
        return true;
    }

    removeField(collection, id) {
        const target = this.spec.collections[collection];
        if (target) {
            target.fields = target.fields.filter((field) => field.id !== id);
        }
    }

    fieldsOf(collection) {
        return this.spec.collections[collection] ? this.spec.collections[collection].fields : [];
    }
}
