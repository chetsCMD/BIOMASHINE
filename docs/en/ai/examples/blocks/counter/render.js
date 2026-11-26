import { BaseBlock } from 'bm://app/blocks/runtime/BaseBlock.js';

export default class CounterBlock extends BaseBlock {
    build() {
        this.value = this.el('div', 'counter-value');
        const button = this.el('button', 'bm-btn', this.props.label || '+1');
        button.addEventListener('click', () => this.context.store.insert(this.props.collection, { tap: 1 }));
        const card = this.el('div', 'counter-card');
        card.append(this.value, button);
        this.element.append(card);
        this.cleanups.push(this.context.store.onChange(this.props.collection, () => this.refresh()));
        this.refresh();
    }

    async refresh() {
        const records = await this.context.store.list(this.props.collection);
        this.value.textContent = String(records.length);
    }
}
