import { RunningCalculator } from './RunningCalculator.js';
import { RunningRepository } from './RunningRepository.js';
import { RunningCharts } from './RunningCharts.js';
import { RunningView } from './RunningView.js';
import { ModuleClock } from './ModuleClock.js';

export class RunningModule {
    constructor(bm, doc, ChartClass) {
        this.bm = bm;
        this.doc = doc;
        this.ChartClass = ChartClass;
        this.state = {
            runs: [],
            distance: { target: null, deadline: null, current: 0, progress: 0 },
            time: { target: null, deadline: null, current: 0, progress: 0 },
            calories: { target: null, deadline: null, current: 0, progress: 0 },
            searchDate: null
        };
    }

    formatDate(value) {
        if (!value) {
            return '';
        }
        const parts = String(value).split('T')[0].split('-').map(Number);
        if (parts.length !== 3 || parts.some(Number.isNaN)) {
            return String(value);
        }
        return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString(this.bm.locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    formatTime(totalSeconds) {
        const message = this.calculator.formatTimeToString(totalSeconds);
        return this.bm.t(message.key, message.params);
    }

    formatWeekday(dateStr) {
        return new Date(dateStr + 'T00:00:00').toLocaleDateString(this.bm.locale, { weekday: 'short' });
    }

    async start() {
        this.clock = new ModuleClock(this.bm);
        this.config = await this.loadOwnConfig();
        this.achievementsConfig = await this.loadSharedConfig();
        this.calculator = new RunningCalculator();
        this.repository = new RunningRepository(this.bm);
        this.view = new RunningView(
            this.doc,
            (key, params) => this.bm.t(key, params),
            (dateStr) => this.formatWeekday(dateStr)
        );
        this.charts = new RunningCharts({
            doc: this.doc,
            ChartClass: this.ChartClass,
            palette: this.config.charts,
            t: (key, params) => this.bm.t(key, params),
            formatWeekday: (dateStr) => this.formatWeekday(dateStr)
        });

        this.attachListeners();

        let listResult = [];
        let goalsResult = null;
        try {
            const results = await Promise.all([
                this.repository.list(),
                this.repository.getGoals()
            ]);
            listResult = results[0];
            goalsResult = results[1];
        } catch (error) {
            listResult = [];
            goalsResult = null;
        }
        const runs = Array.isArray(listResult) ? listResult : [];
        this.state.runs = runs.map((r) => ({
            id: r.id,
            date: r.date,
            time_seconds: parseInt(r.time_seconds, 10),
            distance: parseFloat(r.distance),
            calories: r.calories ? parseFloat(r.calories) : null,
            start_speed: r.start_speed ? parseFloat(r.start_speed) : null,
            max_speed: r.max_speed ? parseFloat(r.max_speed) : null,
            incline: r.incline ? parseFloat(r.incline) : null
        }));
        this.applyGoals(goalsResult);

        this.view.fillDefaultDate(this.clock.today());
        this.renderAll();

        try {
            this.bm.onTheme(() => this.renderCharts());
        } catch (error) {
        }
    }

    async loadOwnConfig() {
        let raw = null;
        try {
            raw = await this.bm.config('running');
        } catch (error) {
            raw = null;
        }
        const base = raw && typeof raw === 'object' ? raw : {};
        return {
            charts: base.charts && typeof base.charts === 'object' ? base.charts : {},
            statusHideMs: typeof base.statusHideMs === 'number' ? base.statusHideMs : 3000
        };
    }

    async loadSharedConfig() {
        try {
            const raw = await this.bm.config('achievements');
            return raw && typeof raw === 'object' ? raw : null;
        } catch (error) {
            return null;
        }
    }

    attachListeners() {
        this.view.byId('add-run-btn').addEventListener('click', () => this.addRun());
        this.view.byId('search-btn').addEventListener('click', () => this.search());
        this.view.byId('reset-search-btn').addEventListener('click', () => this.resetSearch());
        this.view.byId('dist-set-btn').addEventListener('click', () => this.setDistanceGoal());
        this.view.byId('time-set-btn').addEventListener('click', () => this.setTimeGoal());
        this.view.byId('cal-set-btn').addEventListener('click', () => this.setCaloriesGoal());
    }

    applyGoals(goals) {
        if (!goals || typeof goals !== 'object') return;
        if (goals.distance_target) this.state.distance.target = parseFloat(goals.distance_target);
        if (goals.distance_deadline) this.state.distance.deadline = goals.distance_deadline;
        if (goals.time_target) this.state.time.target = parseInt(goals.time_target, 10);
        if (goals.time_deadline) this.state.time.deadline = goals.time_deadline;
        if (goals.calories_target) this.state.calories.target = parseFloat(goals.calories_target);
        if (goals.calories_deadline) this.state.calories.deadline = goals.calories_deadline;
    }

    updateGoalProgress() {
        const today = this.clock.today();
        this.state.distance = {
            ...this.state.distance,
            ...this.calculator.goalProgress(this.state.distance, this.state.runs, today, 'distance')
        };
        this.state.time = {
            ...this.state.time,
            ...this.calculator.goalProgress(this.state.time, this.state.runs, today, 'time_seconds')
        };
        this.state.calories = {
            ...this.state.calories,
            ...this.calculator.goalProgress(this.state.calories, this.state.runs, today, 'calories')
        };
    }

    renderAll() {
        if (!Array.isArray(this.state.runs)) {
            this.state.runs = [];
        }
        this.updateGoalProgress();
        this.renderStats();
        this.renderGoals();
        this.renderWeek();
        this.renderCharts();
        this.renderAchievements();
        this.renderList();
        this.updatePills();
    }

    updatePills() {
        try {
            this.bm.setPills([this.clock.today(), this.bm.t('pill.runs', { count: this.state.runs.length })]);
        } catch (error) {
        }
    }

    renderStats() {
        const totals = this.calculator.totals(this.state.runs);
        this.view.renderStats(totals, (s) => this.formatTime(s));
    }

    renderGoals() {
        this.view.renderGoals(this.state, (s) => this.formatTime(s));
    }

    renderWeek() {
        const days = this.clock.currentWeek();
        const weekTotals = this.calculator.weekTotals(this.state.runs, days);
        this.view.renderWeek(
            weekTotals,
            (s) => this.formatTime(s),
            this.clock.today()
        );
    }

    renderCharts() {
        if (!this.ChartClass) return;
        let theme = { text: '#aaaaaa', grid: '#2e2e2e' };
        try {
            if (this.bm.theme && this.bm.theme.chart) {
                theme = this.bm.theme.chart;
            }
        } catch (error) {
            theme = { text: '#aaaaaa', grid: '#2e2e2e' };
        }
        const days = this.clock.currentWeek();
        const weekTotals = this.calculator.weekTotals(this.state.runs, days);
        const sorted = this.calculator.sortedByDateAsc(this.state.runs);
        this.charts.renderWeek(weekTotals, theme);
        this.charts.renderAllTime(sorted, (d) => this.formatDate(d), theme);
    }

    renderAchievements() {
        const config = this.achievementsConfig;
        const list = config && Array.isArray(config.running) ? config.running : [];
        const totalDistance = this.calculator.totalDistance(this.state.runs);
        const achievements = this.calculator.achievements(list, totalDistance);
        this.view.renderAchievements(achievements);
    }

    renderList() {
        const filtered = this.state.searchDate
            ? this.state.runs.filter((r) => r.date === this.state.searchDate)
            : this.state.runs;
        const sorted = this.calculator.sortedByDateDesc(filtered);
        this.view.renderList(
            sorted,
            (d) => this.formatDate(d),
            (s) => this.formatTime(s),
            (id) => this.deleteRun(id)
        );
    }

    async addRun() {
        const form = this.view.readAddForm();
        if (!form.date || !form.timeStr || !form.distance) {
            this.view.showStatus('error', this.bm.t('status.fillRequired'), this.config.statusHideMs);
            return;
        }
        const timeSeconds = this.calculator.parseTimeToSeconds(form.timeStr);
        try {
            const result = await this.repository.add({
                date: form.date,
                time_seconds: timeSeconds,
                distance: form.distance,
                calories: form.calories,
                start_speed: form.startSpeed,
                max_speed: form.maxSpeed,
                incline: form.incline
            });
            this.state.runs.push({
                id: result.id,
                date: form.date,
                time_seconds: timeSeconds,
                distance: form.distance,
                calories: form.calories,
                start_speed: form.startSpeed,
                max_speed: form.maxSpeed,
                incline: form.incline
            });
            this.view.clearAddForm(this.clock.today());
            this.renderAll();
        } catch (error) {
            const message = error && error.status ? this.bm.t('status.addError') : this.bm.t('status.connectionError');
            this.view.showStatus('error', message, this.config.statusHideMs);
        }
    }

    async deleteRun(id) {
        try {
            await this.repository.remove(id);
            this.state.runs = this.state.runs.filter((r) => r.id !== id);
            this.renderAll();
        } catch (error) {
        }
    }

    search() {
        const date = this.view.byId('search-date').value;
        if (!date) return;
        this.state.searchDate = date;
        this.renderList();
    }

    resetSearch() {
        this.state.searchDate = null;
        this.view.byId('search-date').value = '';
        this.renderList();
    }

    async setDistanceGoal() {
        const target = this.view.byId('dist-target').value;
        const deadline = this.view.byId('dist-deadline').value;
        await this.updateGoal('distance', target, deadline);
    }

    async setTimeGoal() {
        const targetStr = this.view.byId('time-target').value;
        const deadline = this.view.byId('time-deadline').value;
        const target = targetStr ? this.calculator.parseTimeToSeconds(targetStr) : null;
        await this.updateGoal('time', target, deadline);
    }

    async setCaloriesGoal() {
        const target = this.view.byId('cal-target').value;
        const deadline = this.view.byId('cal-deadline').value;
        await this.updateGoal('calories', target, deadline);
    }

    async updateGoal(type, target, deadline) {
        const deadlineValue = deadline || null;
        let parsedTarget = null;
        if (target !== '' && target !== null && target !== undefined) {
            parsedTarget = type === 'time' ? parseInt(target, 10) : parseFloat(target);
            if (Number.isNaN(parsedTarget)) parsedTarget = null;
        }
        try {
            await this.repository.saveGoal(type, parsedTarget, deadlineValue);
        } catch (error) {
            return;
        }
        if (type === 'distance') {
            this.state.distance.target = parsedTarget;
            this.state.distance.deadline = deadlineValue;
        } else if (type === 'time') {
            this.state.time.target = parsedTarget;
            this.state.time.deadline = deadlineValue;
        } else if (type === 'calories') {
            this.state.calories.target = parsedTarget;
            this.state.calories.deadline = deadlineValue;
        }
        this.renderGoals();
    }
}