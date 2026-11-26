export class BuilderInspector {
    static LABELS = {
        text: 'prop.text', level: 'prop.level', align: 'prop.align', label: 'prop.label', placeholder: 'prop.placeholder', collection: 'prop.collection', field: 'prop.field', form: 'prop.form',
        required: 'prop.required', min: 'prop.min', max: 'prop.max', step: 'prop.step', unit: 'prop.unit', default: 'prop.default', options: 'prop.options', columns: 'prop.columns',
        sortField: 'prop.sortField', order: 'prop.order', limit: 'prop.limit', allowDelete: 'prop.allowDelete', filters: 'prop.filters', op: 'prop.op', period: 'prop.period',
        target: 'prop.target', x: 'prop.x', y: 'prop.y', type: 'prop.type', aggregate: 'prop.aggregate', colorToken: 'prop.colorToken', clearAfter: 'prop.clearAfter'
    };

    constructor({ bm, doc, state, onChange, onRemove }) {
        this.bm = bm;
        this.doc = doc;
        this.state = state;
        this.onChange = onChange;
        this.onRemove = onRemove;
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

    control(block, prop) {
        const value = block.props[prop.name];
        const commit = (next) => this.onChange(block.id, { [prop.name]: next });
        const options = (values, current) => {
            const select = this.el('select', 'bm-input');
            for (const item of values) {
                const option = this.el('option', '', String(item));
                option.value = String(item);
                select.append(option);
            }
            select.value = current === undefined ? '' : String(current);
            return select;
        };
        const kinds = {
            boolean: () => {
                const input = this.el('input');
                input.type = 'checkbox';
                input.checked = Boolean(value);
                input.addEventListener('change', () => commit(input.checked));
                return input;
            },
            select: () => {
                const select = options(prop.options || [], value);
                select.addEventListener('change', () => commit(select.value));
                return select;
            },
            collection: () => {
                const select = options(['', ...Object.keys(this.state.spec.collections)], value);
                select.addEventListener('change', () => commit(select.value));
                return select;
            },
            field: () => {
                const select = options(['', 'createdAt', ...this.state.fieldsOf(block.props.collection).map((field) => field.id)], value);
                select.addEventListener('change', () => commit(select.value));
                return select;
            },
            number: () => {
                const input = this.el('input', 'bm-input');
                input.type = 'number';
                input.value = value === undefined || value === null ? '' : String(value);
                input.addEventListener('change', () => commit(input.value === '' ? null : Number(input.value)));
                return input;
            },
            list: () => {
                const area = this.el('textarea', 'bm-input');
                area.value = Array.isArray(value) ? value.join('\n') : '';
                area.addEventListener('change', () => commit(area.value.split('\n').map((line) => line.trim()).filter(Boolean)));
                return area;
            },
            json: () => {
                const area = this.el('textarea', 'bm-input');
                area.value = JSON.stringify(value === undefined ? [] : value);
                area.addEventListener('change', () => {
                    try {
                        commit(JSON.parse(area.value));
                    } catch (error) {
                        area.value = JSON.stringify(value === undefined ? [] : value);
                    }
                });
                return area;
            },
            text: () => {
                const area = this.el('textarea', 'bm-input');
                area.value = value === undefined ? '' : String(value);
                area.addEventListener('change', () => commit(area.value));
                return area;
            },
            string: () => {
                const input = this.el('input', 'bm-input');
                input.type = prop.type === 'color' ? 'color' : 'text';
                input.value = value === undefined || value === null ? '' : String(value);
                input.addEventListener('change', () => commit(input.value));
                return input;
            }
        };
        const kind = prop.type === 'columns' || prop.type === 'filters' ? 'json' : kinds[prop.type] ? prop.type : 'string';
        return kinds[kind]();
    }

    render(manifests) {
        const root = this.el('div', 'builder-side');
        root.append(this.el('div', 'bm-title', this.bm.t('inspector.title')));
        const block = this.state.selected ? this.state.block(this.state.selected) : null;
        const manifest = block ? manifests.find((item) => item.type === block.type) : null;
        if (!block || !manifest) {
            root.append(this.el('div', 'builder-hint', this.bm.t('inspector.empty')));
            return root;
        }
        for (const prop of manifest.props) {
            const row = this.el('div', 'builder-prop');
            const labelKey = BuilderInspector.LABELS[prop.name];
            row.append(this.el('span', 'bm-label', labelKey ? this.bm.t(labelKey) : prop.name), this.control(block, prop));
            root.append(row);
        }
        const remove = this.el('button', 'bm-btn danger', this.bm.t('inspector.remove'));
        remove.addEventListener('click', () => this.onRemove(block.id));
        root.append(remove);
        return root;
    }
}
