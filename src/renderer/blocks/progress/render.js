import { BaseBlock } from '../runtime/BaseBlock.js';
import { BlockMath } from '../runtime/BlockMath.js';

export default class ProgressBlock extends BaseBlock {
    build() {
        this.caption = this.el('div', 'bmb-stat-label');
        this.fill = this.el('div', 'bmb-bar-fill');
        const bar = this.el('div', 'bmb-bar');
        bar.append(this.fill);
        const wrapper = this.el('div', 'bmb-progress');
        wrapper.append(this.caption, bar);
        this.element.append(wrapper);
        this.cleanups.push(this.context.store.onChange(this.props.collection, () => this.refresh()));
        this.refresh();
    }

    async refresh() {
        const { store, bm } = this.context;
        const records = BlockMath.filter(await store.list(this.props.collection), BlockMath.periodStart(bm.clock, this.props.period));
        const value = BlockMath.aggregate(records, this.props.field, this.props.op);
        const target = Number(this.props.target) || 1;
        const ratio = Math.min(Math.max(value / target, 0), 1);
        this.caption.textContent = `${this.props.label || ''}: ${BlockMath.round(value)} / ${target}`;
        this.fill.style.setProperty('--bmb-progress', String(ratio));
    }
}
