export class BaseBlock {
    constructor(context) {
        this.context = context;
        this.props = context.props;
        this.element = null;
        this.cleanups = [];
    }

    el(tag, className = '', text = '') {
        const element = this.context.doc.createElement(tag);
        if (className) {
            element.className = className;
        }
        if (text) {
            element.textContent = text;
        }
        return element;
    }

    field(label, control) {
        const wrapper = this.el('label', 'bmb-field');
        if (label) {
            wrapper.append(this.el('span', 'bm-label', label));
        }
        wrapper.append(control);
        return wrapper;
    }

    register(control, get, reset, kind = 'value') {
        const { bus, blockId } = this.context;
        bus.registerField(blockId, { form: this.props.form, collection: this.props.collection, field: this.props.field, required: Boolean(this.props.required), kind, get, reset });
        control.addEventListener(kind === 'checkbox' ? 'change' : 'input', () => bus.publish(blockId, get()));
        this.cleanups.push(() => bus.unregister(blockId));
    }

    mount(element) {
        this.element = element;
        this.build();
    }

    update(props) {
        this.cleanup();
        this.props = props;
        this.element.textContent = '';
        this.build();
    }

    cleanup() {
        this.cleanups.forEach((work) => work());
        this.cleanups = [];
    }

    destroy() {
        this.cleanup();
    }

    build() {}
}
