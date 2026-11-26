import { BaseBlock } from '../runtime/BaseBlock.js';

export default class DividerBlock extends BaseBlock {
    build() {
        this.element.append(this.el('hr', 'bmb-divider'));
    }
}
