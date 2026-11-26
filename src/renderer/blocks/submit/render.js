import { BaseBlock } from '../runtime/BaseBlock.js';

export default class SubmitBlock extends BaseBlock {
    build() {
        const status = this.el('div', 'bm-muted bmb-status');
        const button = this.el('button', 'bm-btn', this.props.label || this.context.t('common.save'));
        button.addEventListener('click', () => this.submit(status));
        this.element.append(button, status);
    }

    async submit(status) {
        const { bus, store, t } = this.context;
        const fields = bus.fields(this.props.form).filter((field) => !this.props.collection || field.collection === this.props.collection);
        const record = {};
        for (const field of fields) {
            const value = field.get();
            if (field.required && (value === null || value === undefined || value === '')) {
                status.textContent = t('block.required');
                return;
            }
            if (field.field) {
                record[field.field] = value;
            }
        }
        await store.insert(this.props.collection, record);
        if (this.props.clearAfter) {
            fields.forEach((field) => field.reset());
        }
        status.textContent = t('block.saved');
    }
}
