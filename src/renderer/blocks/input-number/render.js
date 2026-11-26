import { BaseBlock } from '../runtime/BaseBlock.js';

export default class InputNumberBlock extends BaseBlock {
    build() {
        const input = this.el('input', 'bm-input');
        input.type = 'number';
        for (const name of ['min', 'max', 'step']) {
            if (this.props[name] !== undefined && this.props[name] !== null && this.props[name] !== '') {
                input.setAttribute(name, String(this.props[name]));
            }
        }
        this.register(input, () => (input.value === '' ? null : Number(input.value)), () => {
            input.value = '';
        });
        const label = this.props.unit ? `${this.props.label || ''} (${this.props.unit})` : this.props.label;
        this.element.append(this.field(label, input));
    }
}
