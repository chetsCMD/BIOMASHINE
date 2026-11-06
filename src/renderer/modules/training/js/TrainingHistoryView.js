import { TrainingViewBase } from './TrainingViewBase.js';

export class TrainingHistoryView extends TrainingViewBase {
    constructor(doc, calculator, t) {
        super(doc, t);
        this.calculator = calculator;
    }

    readFilters() {
        return {
            type: this.byId('history-filter-type').value,
            period: this.byId('history-filter-period').value,
            from: this.byId('history-filter-from').value,
            to: this.byId('history-filter-to').value
        };
    }

    resetFilters() {
        this.byId('history-filter-type').value = 'all';
        this.byId('history-filter-period').value = 'week';
        this.byId('history-filter-from').value = '';
        this.byId('history-filter-to').value = '';
    }

    renderHistory({ workouts, todayStr, onEdit, onDelete }) {
        const list = this.byId('history-list');
        list.replaceChildren();

        const filtered = this.calculator.filterHistory(workouts, this.readFilters(), todayStr);
        if (filtered.length === 0) {
            list.append(this.el('div', 'empty', this.t('history.empty')));
            return;
        }

        for (const workout of filtered) {
            const item = this.el('div', 'history-item');
            const info = this.el('div', 'history-item-info');

            info.append(
                this.el('span', 'history-item-date', `${this.calculator.formatDate(workout.date)} ${this.calculator.timeRange(workout)}`),
                this.el('span', 'history-item-type', this.calculator.typeLabel(workout.type)),
                this.el('span', 'history-item-exercises', this.calculator.exerciseText(workout.exercises))
            );

            if (workout.note) {
                info.append(this.el('span', 'history-item-note', workout.note));
            }

            const actions = this.el('div', 'history-item-actions');
            const edit = this.el('button', 'btn edit btn-xs', this.t('action.edit'));
            edit.addEventListener('click', () => onEdit(workout.id));
            const remove = this.el('button', 'delete-btn', this.t('common.delete'));
            remove.addEventListener('click', () => onDelete(workout.id));
            actions.append(edit, remove);

            item.append(info, actions);
            list.append(item);
        }
    }
}