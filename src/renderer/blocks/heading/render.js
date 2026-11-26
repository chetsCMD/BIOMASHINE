import { BaseBlock } from '../runtime/BaseBlock.js';

export default class HeadingBlock extends BaseBlock {
    build() {
        const level = Math.min(Math.max(Number(this.props.level) || 1, 1), 3);
        this.element.append(this.el(`h${level}`, 'bmb-heading', this.props.text || ''));
    }
}
