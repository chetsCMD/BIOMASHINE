import { BaseBlock } from '../runtime/BaseBlock.js';
import { BlockMath } from '../runtime/BlockMath.js';

export default class ChartBlock extends BaseBlock {
    build() {
        const holder = this.el('div', 'bmb-chart');
        this.canvas = this.el('canvas');
        holder.append(this.canvas);
        this.element.append(holder);
        this.cleanups.push(() => this.chart && this.chart.destroy());
        this.cleanups.push(this.context.store.onChange(this.props.collection, () => this.refresh()));
        this.refresh();
    }

    async refresh() {
        const { store, bm } = this.context;
        const Chart = this.context.doc.defaultView ? this.context.doc.defaultView.Chart : null;
        if (!Chart) {
            return;
        }
        const records = BlockMath.filter(await store.list(this.props.collection), BlockMath.periodStart(bm.clock, this.props.period));
        const groups = new Map();
        for (const record of records) {
            const day = String(record[this.props.x] || record.createdAt).slice(0, 10);
            groups.set(day, [...(groups.get(day) || []), record]);
        }
        const labels = [...groups.keys()].sort();
        const data = labels.map((day) => BlockMath.round(BlockMath.aggregate(groups.get(day), this.props.y, this.props.aggregate)));
        const style = this.context.doc.defaultView.getComputedStyle(this.context.doc.documentElement);
        const color = style.getPropertyValue(`--${this.props.colorToken || 'wh'}`) || style.getPropertyValue('--wh');
        if (this.chart) {
            this.chart.destroy();
        }
        this.chart = new Chart(this.canvas, {
            type: this.props.type === 'bar' ? 'bar' : 'line',
            data: { labels, datasets: [{ data, borderColor: color, backgroundColor: color }] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: { ticks: { color: bm.theme.chart.text }, grid: { color: bm.theme.chart.grid } }, y: { ticks: { color: bm.theme.chart.text }, grid: { color: bm.theme.chart.grid } } }
            }
        });
    }
}
