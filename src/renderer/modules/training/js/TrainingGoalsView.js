import { TrainingViewBase } from './TrainingViewBase.js';

export class TrainingGoalsView extends TrainingViewBase {
    constructor(doc, calculator, stats, t) {
        super(doc, t);
        this.calculator = calculator;
        this.stats = stats;
    }

    renderExerciseGoals({ goals, workouts, todayStr, onRemove }) {
        const container = this.byId('exercise-goals-list');
        container.replaceChildren();
        const exerciseGoals = goals.exercise_goals || [];

        if (exerciseGoals.length === 0) {
            container.append(this.el('div', 'empty goals-empty', this.t('goals.noneDaily')));
            return;
        }

        for (const goal of exerciseGoals) {
            const done = this.calculator.dayRepsForExercise(workouts, goal.exercise_name, todayStr);
            const target = goal.target_reps || 0;
            const status = this.stats.goalStatus(done, target);
            const remaining = Math.max(0, target - done);

            const item = this.el('div', 'goal-item');
            const name = this.el('span', 'goal-name', goal.exercise_name);

            const wrap = this.el('div', 'goal-progress-wrap');
            const bar = this.el('div', 'goal-progress-bar');
            const fill = this.el('div', `goal-progress-fill ${status.barClass}`);
            fill.style.width = `${status.progress}%`;
            bar.append(fill);

            const label = this.el('div', 'goal-label');
            label.append(
                this.el('span', null, this.t('goals.repsProgress', { done, target })),
                this.el('span', null, this.t('goals.remaining', { remaining }))
            );
            wrap.append(bar, label);

            const statusNode = this.el('span', `goal-status ${status.statusClass}`, status.text);
            const remove = this.el('button', 'delete-btn btn-icon', this.t('common.delete'));
            remove.addEventListener('click', () => onRemove(goal.exercise_name));

            item.append(name, wrap, statusNode, remove);
            container.append(item);
        }
    }

    renderDailyGoalSelect(names, current) {
        const select = this.byId('daily-goal-exercise');
        select.replaceChildren();
        const empty = this.el('option', null, '—');
        empty.value = '';
        select.append(empty);
        for (const name of names) {
            const option = this.el('option', null, name);
            option.value = name;
            select.append(option);
        }
        if (current && names.has(current)) {
            select.value = current;
        }
    }

    readWeeklyTarget() {
        return parseInt(this.byId('weekly-target').value, 10);
    }

    readDailyGoal() {
        return {
            exercise: this.byId('daily-goal-exercise').value,
            reps: parseInt(this.byId('daily-goal-reps').value, 10)
        };
    }

    clearDailyGoalReps() {
        this.byId('daily-goal-reps').value = '';
    }
}