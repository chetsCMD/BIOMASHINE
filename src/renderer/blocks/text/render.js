import { BaseBlock } from '../runtime/BaseBlock.js';

export default class TextBlock extends BaseBlock {
    build() {
        const align = this.props.align && this.props.align !== 'left' ? ` bmb-align-${this.props.align}` : '';
        this.element.append(this.el('p', `bmb-text${align}`, this.props.text || ''));
    }
}
