import { BaseBlock } from '../runtime/BaseBlock.js';

export default class SelectBlock extends BaseBlock {
    build() {
        const select = this.el('select', 'bm-input');
        for (const option of Array.isArray(this.props.options) ? this.props.options : []) {
            const item = this.el('option', '', String(option));
            item.value = String(option);
            select.append(item);
        }
        this.register(select, () => select.value, () => {
            select.value = select.options && select.options[0] ? select.options[0].value : '';
        });
        this.element.append(this.field(this.props.label, select));
    }
}
