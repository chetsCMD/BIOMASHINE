import { ModuleClock } from './ModuleClock.js';
import { WeightCalculator } from './WeightCalculator.js';
import { WeightStats } from './WeightStats.js';
import { WeightRepository } from './WeightRepository.js';
import { WeightView } from './WeightView.js';
import { WeightCharts } from './WeightCharts.js';

export class WeightModule {
    constructor(bm, doc) {
        this.bm = bm;
        this.doc = doc;
        this.clock = new ModuleClock(bm);
        this.state = {
            measurements: [],
            goals: { weight_goal: null, fat_goal: null, deadline: null },
            user: null,
            chartPeriod: 'all',
            activeMonths: 1,
            pendingDeleteDate: null
        };
    }

    async start() {
        this.config = await this.bm.config('weight');
        this.calculator = new WeightCalculator(this.config);
        this.stats = new WeightStats();
        this.repository = new WeightRepository(this.bm);
        this.view = new WeightView(this.doc, (key, params) => this.bm.t(key, params));

        this.charts = new WeightCharts({
            container: this.doc.getElementById('charts-row'),
            settings: this.config.chartSettings,
            palette: this.config.charts,
            ChartClass: window.Chart,
            bm: this.bm,
            clock: this.clock,
            doc: this.doc,
            t: (key, params) => this.bm.t(key, params)
        });

        this.bindEvents();
        await this.loadData();

        this.bm.onTheme(() => {
            if (this.state.measurements.length) {
                this.renderCharts();
            }
        });
    }

    bindEvents() {
        this.view.byId('add-measurement-btn').addEventListener('click', () => this.addMeasurement());
        this.view.byId('delete-measurement-btn').addEventListener('click', () => this.openDeleteModal());
        this.view.byId('set-goals-btn').addEventListener('click', () => this.saveGoals());
        this.view.byId('close-delete-modal-btn').addEventListener('click', () => this.view.closeDeleteModal());
        this.view.byId('apply-chart-period').addEventListener('click', () => this.changeChartPeriod());
        this.view.byId('chart-period').addEventListener('change', () => this.changeChartPeriod());
        this.view.byId('btn-custom').addEventListener('click', () => this.calculateCustomRange());

        const monthsList = [1, 3, 6, 12];
        const tabs = monthsList.map(m => this.view.byId(`ptab-${m}`));
        tabs.forEach((btn, index) => {
            if (!btn) return;
            btn.addEventListener('click', () => {
                tabs.forEach(b => {
                    if (b) b.classList.remove('on');
                });
                btn.classList.add('on');
                this.state.activeMonths = monthsList[index];
                this.renderPeriodTable();
            });
        });
    }

    async loadData() {
        try {
            const overview = await this.repository.overview();
            this.state.user = overview.user;
            this.state.measurements = overview.measurements || [];

            if (overview.goals) {
                this.state.goals = {
                    weight_goal: overview.goals.weight_goal || null,
                    fat_goal: overview.goals.fat_goal || null,
                    deadline: overview.goals.deadline ? overview.goals.deadline.split('T')[0] : null
                };
            }

            const today = this.calculator.getTodayDateStr(this.clock);
            this.view.byId('new-date').value = today;
            this.view.fillGoalForm(this.state.goals, this.calculator);

            const pills = ['—', this.bm.t('pill.measurements', { count: 0 })];
            if (this.state.measurements.length) {
                const latestDate = this.state.measurements[this.state.measurements.length - 1].date;
                pills[0] = this.calculator.formatDateToDisplay(latestDate);
                pills[1] = this.bm.t('pill.measurements', { count: this.state.measurements.length });
            }
            this.bm.setPills(pills);

            this.renderAll();
        } catch (error) {
            console.error('Failed to load weight data:', error);
        }
    }

    async addMeasurement() {
        const form = this.view.readForm();

        if (!form.date || !form.weight) {
            this.view.showStatus('error', this.bm.t('status.dateWeightRequired'), this.config.statusHideMs);
            return;
        }

        const formattedDate = this.calculator.formatDateToAPI(form.date);
        if (!formattedDate) {
            this.view.showStatus('error', this.bm.t('status.invalidDate'), this.config.statusHideMs);
            return;
        }

        const payload = {
            date: formattedDate,
            weight: parseFloat(form.weight)
        };
        if (form.fat) payload.fat = parseFloat(form.fat);
        if (form.water) payload.water = parseFloat(form.water);

        try {
            await this.repository.saveMeasurement(payload);
            this.view.showStatus('success', this.bm.t('status.measurementAdded'), this.config.statusHideMs);
            this.view.clearForm(this.calculator, this.clock);
            await this.loadData();
        } catch (error) {
            this.view.showStatus('error', this.bm.t('status.addError'), this.config.statusHideMs);
        }
    }

    openDeleteModal() {
        if (this.state.measurements.length === 0) {
            this.view.showStatus('error', this.bm.t('status.noDataToDelete'), this.config.statusHideMs);
            return;
        }
        this.view.openDeleteModal(this.state.measurements, this.calculator, async (date) => {
            this.view.closeDeleteModal();
            const displayDate = this.calculator.formatDateToDisplay(date);

            const confirmed = await this.bm.confirm(
                this.bm.t('confirm.delete', { date: displayDate }),
                { confirmText: this.bm.t('confirm.yes'), cancelText: this.bm.t('confirm.no'), danger: true }
            );

            if (confirmed) {
                try {
                    await this.repository.removeMeasurement(date);
                    this.view.showStatus('success', this.bm.t('status.measurementDeleted'), this.config.statusHideMs);
                    await this.loadData();
                } catch (error) {
                    this.view.showStatus('error', this.bm.t('status.deleteError'), this.config.statusHideMs);
                }
            }
        });
    }

    async saveGoals() {
        const goals = this.view.readGoalForm(this.calculator);
        try {
            await this.repository.saveGoals(goals);
            this.state.goals = goals;
            this.view.showStatus('success', this.bm.t('status.goalsSaved'), this.config.statusHideMs);
            this.renderGoals();
        } catch (error) {
            this.view.showStatus('error', this.bm.t('status.saveError'), this.config.statusHideMs);
        }
    }

    changeChartPeriod() {
        this.state.chartPeriod = this.view.byId('chart-period').value;
        this.renderCharts();
    }

    calculateCustomRange() {
        const f = this.view.byId('d-from').value;
        const t = this.view.byId('d-to').value;

        if (!f || !t) {
            this.view.byId('custom-result').replaceChildren(this.view.el('div', 'empty', this.bm.t('status.chooseBothDates')));
            return;
        }
        if (f > t) {
            this.view.byId('custom-result').replaceChildren(this.view.el('div', 'empty', this.bm.t('status.startBeforeEnd')));
            return;
        }

        const ch = this.stats.rangeChange(f, t, this.state.measurements);
        this.view.renderCustomResult(ch, this.calculator);
    }

    renderAll() {
        this.renderHero();
        this.renderCharts();
        this.renderPeriodTable();
        this.renderGoals();
        this.renderIdeal();
        this.renderRecords();
    }

    renderHero() {
        const latest = this.state.measurements.length ? this.state.measurements[this.state.measurements.length - 1] : null;
        this.view.renderHero(latest, this.state.user, this.calculator);
    }

    renderCharts() {
        this.charts.render(this.state.measurements, this.state.chartPeriod, (d) => this.calculator.formatDateToDisplay(d));
    }

    renderPeriodTable() {
        const ch = this.stats.periodChange(this.state.activeMonths, this.state.measurements);
        this.view.renderPeriodTable(ch, this.calculator);
    }

    renderGoals() {
        this.view.renderGoals(this.state.goals, this.state.measurements, this.calculator, this.clock);
    }

    renderIdeal() {
        this.view.renderIdeal(this.state.user, this.state.measurements, this.calculator);
    }

    renderRecords() {
        this.view.renderRecords(this.state.measurements, this.calculator);
    }
}