export class BuilderCollections {
    constructor({ bm, doc, state, fieldTypes, onChange }) {
        this.bm = bm;
        this.doc = doc;
        this.state = state;
        this.fieldTypes = fieldTypes;
        this.onChange = onChange;
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

    typeLabel(type) {
        const labels = { text: this.bm.t('field.type.text'), number: this.bm.t('field.type.number'), date: this.bm.t('field.type.date'), select: this.bm.t('field.type.select'), checkbox: this.bm.t('field.type.checkbox') };
        return labels[type] || type;
    }

    row(collection, field) {
        const row = this.el('div', 'builder-field');
        row.append(this.el('span', 'bm-muted', `${field.id} (${this.typeLabel(field.type)})`));
        const remove = this.el('button', 'bm-btn danger', this.bm.t('collections.remove'));
        remove.addEventListener('click', () => {
            this.state.removeField(collection, field.id);
            this.onChange();
        });
        row.append(remove);
        return row;
    }

    addField(collection) {
        const row = this.el('div', 'builder-field');
        const id = this.el('input', 'bm-input');
        id.placeholder = this.bm.t('collections.fieldId');
        const type = this.el('select', 'bm-input');
        for (const name of this.fieldTypes) {
            const option = this.el('option', '', this.typeLabel(name));
            option.value = name;
            type.append(option);
        }
        const options = this.el('input', 'bm-input');
        options.placeholder = this.bm.t('collections.fieldOptions');
        const add = this.el('button', 'bm-btn secondary', this.bm.t('collections.fieldAdd'));
        add.addEventListener('click', () => {
            const list = options.value.split(',').map((item) => item.trim()).filter(Boolean);
            if (this.state.addField(collection, { id: id.value.trim(), type: type.value, options: list })) {
                this.onChange();
            }
        });
        row.append(id, type, options, add);
        return row;
    }

    render() {
        const root = this.el('div', 'builder-side');
        root.append(this.el('div', 'bm-title', this.bm.t('collections.title')));
        for (const [id, collection] of Object.entries(this.state.spec.collections)) {
            const card = this.el('div', 'bm-card');
            card.append(this.el('div', 'bm-label', id));
            collection.fields.forEach((field) => card.append(this.row(id, field)));
            card.append(this.addField(id));
            const remove = this.el('button', 'bm-btn danger', this.bm.t('collections.remove'));
            remove.addEventListener('click', () => {
                this.state.removeCollection(id);
                this.onChange();
            });
            card.append(remove);
            root.append(card);
        }
        const name = this.el('input', 'bm-input');
        name.placeholder = this.bm.t('collections.name');
        const add = this.el('button', 'bm-btn secondary', this.bm.t('collections.add'));
        add.addEventListener('click', () => {
            if (this.state.addCollection(name.value.trim(), name.value.trim())) {
                this.onChange();
            }
        });
        root.append(name, add);
        return root;
    }
}
