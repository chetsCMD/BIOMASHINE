import { BaseBlock } from '../runtime/BaseBlock.js';

export default class InputDateBlock extends BaseBlock {
    build() {
        const input = this.el('input', 'bm-input');
        input.type = 'date';
        const initial = () => (this.props.default === 'empty' ? '' : this.context.bm.clock.today());
        input.value = initial();
        this.register(input, () => input.value, () => {
            input.value = initial();
        });
        this.element.append(this.field(this.props.label, input));
    }
}
