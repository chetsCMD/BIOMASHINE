import { BaseBlock } from '../runtime/BaseBlock.js';

export default class ListBlock extends BaseBlock {
    build() {
        this.holder = this.el('div', 'bm-list');
        this.element.append(this.holder);
        const { store, bus } = this.context;
        this.cleanups.push(store.onChange(this.props.collection, () => this.refresh()));
        this.cleanups.push(bus.subscribe(() => this.refresh()));
        this.refresh();
    }

    columns() {
        const configured = Array.isArray(this.props.columns) ? this.props.columns : [];
        if (configured.length > 0) {
            return configured;
        }
        const collection = this.context.collection(this.props.collection);
        return collection ? collection.fields.map((field) => ({ field: field.id, label: field.label || field.id })) : [];
    }

    async refresh() {
        const { store, bus, bm } = this.context;
        let records = await store.list(this.props.collection);
        for (const filter of Array.isArray(this.props.filters) ? this.props.filters : []) {
            const value = bus.value(filter.blockId);
            if (value !== undefined && value !== null && value !== '') {
                records = records.filter((record) => String(record[filter.field]) === String(value));
            }
        }
        const sortField = this.props.sortField || 'createdAt';
        const direction = this.props.order === 'asc' ? 1 : -1;
        records = [...records].sort((a, b) => (a[sortField] > b[sortField] ? direction : a[sortField] < b[sortField] ? -direction : 0));
        if (Number(this.props.limit) > 0) {
            records = records.slice(0, Number(this.props.limit));
        }
        this.holder.textContent = '';
        if (records.length === 0) {
            this.holder.append(this.el('div', 'bm-empty', bm.t('block.empty')));
            return;
        }
        const columns = this.columns();
        for (const record of records) {
            const row = this.el('div', 'bm-list-item');
            const cells = this.el('div', 'bmb-cells');
            for (const column of columns) {
                cells.append(this.el('span', 'bmb-cell', String(record[column.field] === undefined ? '' : record[column.field])));
            }
            row.append(cells);
            if (this.props.allowDelete) {
                const remove = this.el('button', 'bm-btn danger', bm.t('common.delete'));
                remove.addEventListener('click', async () => {
                    if (await bm.confirm(bm.t('block.deleteConfirm'), { danger: true })) {
                        await store.remove(this.props.collection, record.id);
                    }
                });
                row.append(remove);
            }
            this.holder.append(row);
        }
    }
}
