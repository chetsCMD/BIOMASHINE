import { TrainingViewBase } from './TrainingViewBase.js';

export class TrainingCalendarView extends TrainingViewBase {
    constructor(doc, calculator, stats, t) {
        super(doc, t);
        this.calculator = calculator;
        this.stats = stats;
    }

    renderCalendar({ workouts, goals, todayStr, currentYear, currentMonth, onSelectDay }) {
        const grid = this.byId('calendar-grid');
        const monthLabel = this.byId('month-label');
        monthLabel.textContent = this.calculator.monthLabel(currentYear, currentMonth);

        if (grid.querySelectorAll('.week-day-header').length === 0) {
            for (const key of ['weekday.mon', 'weekday.tue', 'weekday.wed', 'weekday.thu', 'weekday.fri', 'weekday.sat', 'weekday.sun']) {
                grid.append(this.el('div', 'week-day-header', this.t(key)));
            }
        } else {
            while (grid.children.length > 7) {
                grid.removeChild(grid.lastChild);
            }
        }

        const { startDay, days } = this.calculator.monthGrid(currentYear, currentMonth);

        for (let i = 0; i < startDay; i++) {
            const empty = this.el('div', 'week-day');
            empty.style.background = 'transparent';
            empty.style.border = 'none';
            empty.style.cursor = 'default';
            grid.append(empty);
        }

        const hasGoals = (goals.exercise_goals || []).length > 0;

        for (const { day, dateStr } of days) {
            const dayDiv = this.el('div', 'week-day');
            if (dateStr === todayStr) {
                dayDiv.classList.add('today');
            }
            const dayWorkouts = workouts.filter((workout) => workout.date === dateStr);
            if (dayWorkouts.length > 0) {
                dayDiv.classList.add('has-workout');
            }

            dayDiv.append(
                this.el('div', 'week-day-number', String(day)),
                this.el('div', 'week-day-count', dayWorkouts.length > 0 ? this.t('calendar.workoutCount', { count: dayWorkouts.length }) : '')
            );

            if (hasGoals) {
                const indicatorClass = this.stats.calendarIndicator(goals, workouts, dateStr);
                dayDiv.append(this.el('div', `week-day-goal-indicator ${indicatorClass}`));
            }

            dayDiv.dataset.date = dateStr;
            dayDiv.addEventListener('click', () => onSelectDay(dateStr));
            grid.append(dayDiv);
        }
    }

    renderDayDetail({ dateStr, workouts, goals, onEdit, onDelete }) {
        const container = this.byId('day-detail');
        const dayWorkouts = workouts.filter((workout) => workout.date === dateStr);
        if (dayWorkouts.length === 0) {
            container.style.display = 'none';
            return;
        }
        container.style.display = 'block';
        container.replaceChildren();

        container.append(this.el('div', 'day-detail-title', this.t('calendar.dayDetail', { date: this.calculator.formatDate(dateStr) })));

        for (const workout of dayWorkouts) {
            const item = this.el('div', 'day-workout-item');
            const header = this.el('div', 'day-workout-header');

            const summary = this.el('span');
            const strong = this.el('strong', null, this.calculator.typeLabel(workout.type));
            summary.append(strong, this.doc.createTextNode(` ${this.calculator.timeRange(workout)}`));

            const actions = this.el('div', 'day-workout-actions');
            const edit = this.el('button', 'btn edit btn-xs', this.t('action.edit'));
            edit.addEventListener('click', () => onEdit(workout.id));
            const remove = this.el('button', 'delete-btn', this.t('common.delete'));
            remove.addEventListener('click', () => onDelete(workout.id));
            actions.append(edit, remove);

            header.append(summary, actions);
            item.append(header, this.el('div', 'day-workout-exercises', this.calculator.exerciseText(workout.exercises)));

            if (workout.note) {
                item.append(this.el('div', 'day-workout-note', workout.note));
            }

            container.append(item);
        }

        this.renderDayProgress({ container, dateStr, workouts, goals });
    }

    renderDayProgress({ container, dateStr, workouts, goals }) {
        const block = this.el('div', 'day-goal-progress');
        const exerciseGoals = goals.exercise_goals || [];

        if (exerciseGoals.length === 0) {
            block.append(this.el('div', 'day-goal-item', this.t('goals.noneDaily')));
            container.append(block);
            return;
        }

        block.append(this.el('div', 'day-goal-title', this.t('goals.dayProgress')));

        for (const goal of exerciseGoals) {
            const done = this.calculator.dayRepsForExercise(workouts, goal.exercise_name, dateStr);
            const target = goal.target_reps || 0;
            const status = this.stats.dayGoalStatus(done, target);

            const row = this.el('div', 'day-goal-item');
            row.append(
                this.el('span', null, goal.exercise_name),
                this.el('span', null, this.t('goals.repsProgress', { done, target })),
                this.el('span', `goal-status ${status.statusClass}`, status.text)
            );
            block.append(row);
        }

        container.append(block);
    }
}