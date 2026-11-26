import { BaseBlock } from '../runtime/BaseBlock.js';

export default class InputTextBlock extends BaseBlock {
    build() {
        const input = this.el('input', 'bm-input');
        input.type = 'text';
        input.placeholder = this.props.placeholder || '';
        this.register(input, () => input.value, () => {
            input.value = '';
        });
        this.element.append(this.field(this.props.label, input));
    }
}
