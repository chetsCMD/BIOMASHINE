import { BaseBlock } from '../runtime/BaseBlock.js';
import { BlockMath } from '../runtime/BlockMath.js';

export default class StatBlock extends BaseBlock {
    build() {
        this.value = this.el('div', 'bmb-stat-value');
        const card = this.el('div', 'bmb-stat');
        card.append(this.value, this.el('div', 'bmb-stat-label', this.props.label || ''));
        this.element.append(card);
        this.cleanups.push(this.context.store.onChange(this.props.collection, () => this.refresh()));
        this.refresh();
    }

    async refresh() {
        const { store, bm } = this.context;
        const records = BlockMath.filter(await store.list(this.props.collection), BlockMath.periodStart(bm.clock, this.props.period));
        const number = BlockMath.round(BlockMath.aggregate(records, this.props.field, this.props.op));
        this.value.textContent = this.props.unit ? `${number} ${this.props.unit}` : String(number);
    }
}
