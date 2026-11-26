export class BuilderToolbar {
    constructor({ bm, doc, categories, actions }) {
        this.bm = bm;
        this.doc = doc;
        this.categories = categories;
        this.actions = actions;
        this.name = null;
        this.description = null;
        this.category = null;
        this.status = null;
        this.pick = null;
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

    button(key, handler, className = 'bm-btn secondary') {
        const button = this.el('button', className, this.bm.t(key));
        button.addEventListener('click', handler);
        return button;
    }

    meta() {
        return { title: this.name.value, description: this.description.value, category: this.category.value };
    }

    setMeta(meta) {
        this.name.value = meta.title || '';
        this.description.value = meta.description || '';
        this.category.value = meta.category || 'other';
    }

    setStatus(text) {
        this.status.textContent = text;
    }

    setModules(modules, current) {
        this.pick.textContent = '';
        const empty = this.el('option', '', this.bm.t('toolbar.pick'));
        empty.value = '';
        this.pick.append(empty);
        for (const item of modules) {
            const option = this.el('option', '', item.title);
            option.value = item.id;
            this.pick.append(option);
        }
        this.pick.value = current || '';
    }

    render() {
        const root = this.el('div', 'builder-bar');
        this.name = this.el('input', 'bm-input');
        this.name.placeholder = this.bm.t('toolbar.name');
        this.description = this.el('input', 'bm-input');
        this.description.placeholder = this.bm.t('toolbar.description');
        this.category = this.el('select', 'bm-input');
        for (const name of this.categories) {
            const option = this.el('option', '', name);
            option.value = name;
            this.category.append(option);
        }
        this.pick = this.el('select', 'bm-input');
        this.pick.addEventListener('change', () => this.pick.value && this.actions.open(this.pick.value));
        this.status = this.el('span', 'builder-status');
        const file = this.el('input');
        file.type = 'file';
        file.className = 'hidden';
        file.addEventListener('change', () => file.files[0] && this.actions.import(file.files[0]));
        root.append(
            this.name, this.description, this.category, this.pick,
            this.button('toolbar.new', () => this.actions.create()),
            this.button('toolbar.save', () => this.actions.save(), 'bm-btn'),
            this.button('toolbar.remove', () => this.actions.remove(), 'bm-btn danger'),
            this.button('toolbar.export', () => this.actions.export()),
            this.button('toolbar.import', () => file.click()),
            this.button('toolbar.blocks', () => this.actions.blocks()),
            this.button('toolbar.rescan', () => this.actions.rescan()),
            file, this.status
        );
        return root;
    }
}
