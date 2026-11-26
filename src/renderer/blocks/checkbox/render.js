import { BaseBlock } from '../runtime/BaseBlock.js';

export default class CheckboxBlock extends BaseBlock {
    build() {
        const input = this.el('input');
        input.type = 'checkbox';
        this.register(input, () => input.checked, () => {
            input.checked = false;
        }, 'checkbox');
        const wrapper = this.el('label', 'bmb-field');
        wrapper.append(input, this.el('span', 'bm-label', this.props.label || ''));
        this.element.append(wrapper);
    }
}
