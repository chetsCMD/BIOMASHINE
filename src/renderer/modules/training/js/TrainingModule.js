import { ModuleClock } from './ModuleClock.js';
import { TrainingCalculator } from './TrainingCalculator.js';
import { TrainingStats } from './TrainingStats.js';
import { TrainingRepository } from './TrainingRepository.js';
import { TrainingFormView } from './TrainingFormView.js';
import { TrainingCalendarView } from './TrainingCalendarView.js';
import { TrainingGoalsView } from './TrainingGoalsView.js';
import { TrainingHistoryView } from './TrainingHistoryView.js';
import { TrainingChartsView } from './TrainingChartsView.js';

export class TrainingModule {
    constructor(bm, doc, ChartClass) {
        this.bm = bm;
        this.doc = doc;
        this.ChartClass = ChartClass;
        this.state = {
            workouts: [],
            templates: [],
            goals: { weekly_target: null, exercise_goals: [] },
            currentMonth: 0,
            currentYear: 0,
            selectedDate: null,
            editingWorkoutId: null,
            todayStr: ''
        };
    }

    async start() {
        this.config = await this.bm.config('training');
        this.t = (key, params) => this.bm.t(key, params);
        this.clock = new ModuleClock(this.bm);
        this.calculator = new TrainingCalculator(this.t, this.bm.locale);
        this.stats = new TrainingStats(this.calculator, this.t);
        this.repository = new TrainingRepository(this.bm);
        this.formView = new TrainingFormView(this.doc, this.calculator, this.t);
        this.calendarView = new TrainingCalendarView(this.doc, this.calculator, this.stats, this.t);
        this.goalsView = new TrainingGoalsView(this.doc, this.calculator, this.stats, this.t);
        this.historyView = new TrainingHistoryView(this.doc, this.calculator, this.t);
        this.chartsView = new TrainingChartsView(this.doc, this.calculator, this.stats, this.config, this.ChartClass, this.t);

        this.state.currentMonth = this.clock.month();
        this.state.currentYear = this.clock.year();
        this.state.todayStr = this.clock.today();
        this.formView.setDefaultDate(this.state.todayStr);

        this.bindEvents();
        this.bm.onTheme(() => this.renderProgress());
        await this.refresh();
    }

    bindEvents() {
        this.formView.bindAdd({
            onSave: () => this.saveWorkout(),
            onAddExercise: () => this.formView.addExerciseRow('exercises-container'),
            onSaveTemplate: () => this.saveTemplate(),
            onApplyTemplate: () => this.applyTemplate()
        });
        this.formView.bindEdit({
            onSave: () => this.saveEditWorkout(),
            onAddExercise: () => this.formView.addExerciseRow('edit-exercises-container'),
            onClose: () => this.formView.closeEdit()
        });
        this.goalsView.byId('set-weekly-goal').addEventListener('click', () => this.setWeeklyGoal());
        this.goalsView.byId('add-daily-goal-btn').addEventListener('click', () => this.addDailyGoal());
        this.historyView.byId('apply-history-filter').addEventListener('click', () => this.renderHistory());
        this.historyView.byId('reset-history-filter').addEventListener('click', () => {
            this.historyView.resetFilters();
            this.renderHistory();
        });
        this.chartsView.byId('progress-exercise-select').addEventListener('change', () => this.renderProgress());
        this.chartsView.byId('progress-period').addEventListener('change', () => this.renderProgress());
        this.calendarView.byId('prev-month').addEventListener('click', () => this.shiftMonth(-1));
        this.calendarView.byId('next-month').addEventListener('click', () => this.shiftMonth(1));
    }

    shiftMonth(delta) {
        let month = this.state.currentMonth + delta;
        let year = this.state.currentYear;
        if (month < 0) {
            month = 11;
            year -= 1;
        }
        if (month > 11) {
            month = 0;
            year += 1;
        }
        this.state.currentMonth = month;
        this.state.currentYear = year;
        this.state.selectedDate = null;
        this.renderAll();
    }

    async refresh() {
        const [workouts, templates, goals] = await Promise.all([
            this.repository.list(),
            this.repository.listTemplates(),
            this.repository.getGoals()
        ]);
        this.state.workouts = Array.isArray(workouts) ? workouts : [];
        this.state.templates = Array.isArray(templates) ? templates : [];
        this.state.goals = {
            weekly_target: (goals && goals.weekly_target) || null,
            exercise_goals: goals && Array.isArray(goals.exercise_goals) ? goals.exercise_goals : []
        };
        this.renderAll();
    }

    renderAll() {
        this.state.todayStr = this.clock.today();
        this.renderCalendar();
        this.renderWeekStats();
        this.formView.renderTemplates(this.state.templates);
        this.renderDailyGoalSelect();
        this.renderExerciseGoals();
        this.renderProgress();
        this.renderHistory();
        if (this.state.selectedDate) {
            this.calendarView.renderDayDetail({
                dateStr: this.state.selectedDate,
                workouts: this.state.workouts,
                goals: this.state.goals,
                onEdit: (id) => this.openEdit(id),
                onDelete: (id) => this.deleteWorkout(id)
            });
        }
        this.bm.setPills([this.calculator.formatDate(this.state.todayStr), this.t('pill.workouts', { count: this.state.workouts.length })]);
    }

    renderCalendar() {
        this.calendarView.renderCalendar({
            workouts: this.state.workouts,
            goals: this.state.goals,
            todayStr: this.state.todayStr,
            currentYear: this.state.currentYear,
            currentMonth: this.state.currentMonth,
            onSelectDay: (dateStr) => {
                this.state.selectedDate = dateStr;
                this.calendarView.renderDayDetail({
                    dateStr,
                    workouts: this.state.workouts,
                    goals: this.state.goals,
                    onEdit: (id) => this.openEdit(id),
                    onDelete: (id) => this.deleteWorkout(id)
                });
                this.renderCalendar();
            }
        });
    }

    renderWeekStats() {
        const stats = this.stats.weekStats(this.state.workouts, this.state.goals.weekly_target, this.state.todayStr);
        this.calendarView.byId('week-count').textContent = String(stats.count);
        this.calendarView.byId('week-time').textContent = stats.totalTime;
        this.calendarView.byId('week-avg').textContent = stats.avgTime;
        this.calendarView.byId('week-goal-progress').textContent = stats.progressLabel;
        this.calendarView.byId('week-goal-bar').style.width = `${stats.goalBarWidth}%`;
        this.calendarView.byId('week-goal-text').textContent = stats.goalText;
    }

    renderDailyGoalSelect() {
        const names = this.stats.allExercises(this.state.workouts);
        const current = this.goalsView.byId('daily-goal-exercise').value;
        this.goalsView.renderDailyGoalSelect(names, current);
    }

    renderExerciseGoals() {
        this.goalsView.renderExerciseGoals({
            goals: this.state.goals,
            workouts: this.state.workouts,
            todayStr: this.state.todayStr,
            onRemove: (name) => this.removeExerciseGoal(name)
        });
    }

    renderProgress() {
        const names = this.stats.allExercises(this.state.workouts);
        this.chartsView.fillExerciseSelect(names);
        this.chartsView.render({
            workouts: this.state.workouts,
            chartTheme: this.bm.theme.chart
        });
    }

    renderHistory() {
        this.historyView.renderHistory({
            workouts: this.state.workouts,
            todayStr: this.state.todayStr,
            onEdit: (id) => this.openEdit(id),
            onDelete: (id) => this.deleteWorkout(id)
        });
    }

    async saveWorkout() {
        const data = this.formView.readAdd();
        if (data.exercises.length === 0) {
            this.formView.showAddStatus('error', this.t('status.addExerciseRequired'), this.config.statusHideMs);
            return;
        }
        try {
            await this.repository.create(data);
        } catch (error) {
            this.formView.showAddStatus('error', this.t(error.status ? 'status.saveError' : 'status.connectionError'), this.config.statusHideMs);
            return;
        }
        this.formView.showAddStatus('success', this.t('status.savedWorkout'), this.config.statusHideMs);
        this.formView.clearAddAfterSave();
        await this.refresh();
    }

    async deleteWorkout(id) {
        if (!(await this.bm.confirm(this.t('confirm.deleteWorkout'), { confirmText: this.t('common.delete'), danger: true }))) {
            return;
        }
        try {
            await this.repository.remove(id);
        } catch {
            return;
        }
        await this.refresh();
    }

    async saveTemplate() {
        const name = this.formView.readTemplateName();
        if (!name) {
            this.formView.showAddStatus('error', this.t('status.templateNameRequired'), this.config.statusHideMs);
            return;
        }
        const exercises = this.formView.readExercises('exercises-container').map((exercise) => ({
            exercise_name: exercise.exercise_name,
            sets: exercise.sets,
            reps: exercise.reps
        }));
        if (exercises.length === 0) {
            this.formView.showAddStatus('error', this.t('status.noExercisesForTemplate'), this.config.statusHideMs);
            return;
        }
        try {
            await this.repository.createTemplate({ name, exercises });
        } catch (error) {
            this.formView.showAddStatus('error', this.t(error.status ? 'status.error' : 'status.connectionError'), this.config.statusHideMs);
            return;
        }
        this.formView.showAddStatus('success', this.t('status.templateSaved'), this.config.statusHideMs);
        this.formView.clearTemplateName();
        await this.refresh();
    }

    async deleteTemplate(id) {
        if (!(await this.bm.confirm(this.t('confirm.deleteTemplate'), { confirmText: this.t('common.delete'), danger: true }))) {
            return;
        }
        try {
            await this.repository.removeTemplate(id);
        } catch {
            return;
        }
        await this.refresh();
    }

    applyTemplate() {
        const id = this.formView.readTemplateId();
        if (!id) {
            return;
        }
        const template = this.state.templates.find((item) => item.id === id);
        if (!template) {
            return;
        }
        const container = this.formView.byId('exercises-container');
        container.replaceChildren();
        for (const exercise of template.exercises || []) {
            this.formView.addExerciseRow('exercises-container', exercise);
        }
    }

    openEdit(id) {
        const workout = this.state.workouts.find((item) => item.id === id);
        if (!workout) {
            return;
        }
        this.state.editingWorkoutId = id;
        this.formView.fillEdit(workout);
        this.formView.openEdit();
    }

    async saveEditWorkout() {
        const data = this.formView.readEdit();
        if (data.exercises.length === 0) {
            this.formView.showEditStatus('error', this.t('status.addExerciseRequired'), this.config.statusHideMs);
            return;
        }
        try {
            await this.repository.update(this.state.editingWorkoutId, data);
        } catch (error) {
            this.formView.showEditStatus('error', this.t(error.status ? 'status.saveError' : 'status.connectionError'), this.config.statusHideMs);
            return;
        }
        this.formView.showEditStatus('success', this.t('status.changesSaved'), this.config.statusHideMs);
        this.formView.closeEdit();
        await this.refresh();
    }

    async setWeeklyGoal() {
        const value = this.goalsView.readWeeklyTarget();
        if (Number.isNaN(value) || value < 0) {
            this.formView.showAddStatus('error', this.t('status.enterNumber'), this.config.statusHideMs);
            return;
        }
        this.state.goals.weekly_target = value;
        await this.saveGoals();
        this.renderAll();
    }

    async addDailyGoal() {
        const { exercise, reps } = this.goalsView.readDailyGoal();
        if (!exercise) {
            this.formView.showAddStatus('error', this.t('status.selectExercise'), this.config.statusHideMs);
            return;
        }
        if (Number.isNaN(reps) || reps < 1) {
            this.formView.showAddStatus('error', this.t('status.enterReps'), this.config.statusHideMs);
            return;
        }
        const existing = this.state.goals.exercise_goals.find((goal) => goal.exercise_name === exercise);
        if (existing) {
            existing.target_reps = reps;
            existing.target_weight = null;
        } else {
            this.state.goals.exercise_goals.push({ exercise_name: exercise, target_reps: reps, target_weight: null });
        }
        await this.saveGoals();
        this.renderAll();
        this.goalsView.clearDailyGoalReps();
        this.formView.showAddStatus('success', this.t('status.goalAdded'), this.config.statusHideMs);
    }

    async removeExerciseGoal(name) {
        this.state.goals.exercise_goals = this.state.goals.exercise_goals.filter((goal) => goal.exercise_name !== name);
        await this.saveGoals();
        this.renderAll();
    }

    async saveGoals() {
        try {
            await this.repository.saveGoals({
                weekly_target: this.state.goals.weekly_target,
                exercise_goals: this.state.goals.exercise_goals
            });
            return true;
        } catch {
            return false;
        }
    }
}