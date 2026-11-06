import { SleepStats } from './SleepStats.js';
import { SleepRepository } from './SleepRepository.js';
import { SleepView } from './SleepView.js';
import { SleepCharts } from './SleepCharts.js';
import { ModuleClock } from './ModuleClock.js';

export class SleepModule {
    constructor(bm, doc) {
        this.bm = bm;
        this.doc = doc;
        this.state = {
            sleepLogs: [],
            noSleepDays: [],
            idealSchedule: { bedtime: null, waketime: null },
            searchDate: null,
            dayMap: new Map(),
            efficiencyData: new Map()
        };
    }

    async start() {
        this.config = await this.bm.config('sleep');
        this.clock = new ModuleClock(this.bm);
        this.stats = new SleepStats(this.config, this.bm.locale);
        this.repository = new SleepRepository(this.bm);
        this.view = new SleepView(this.doc, this.stats, (key, params) => this.bm.t(key, params));
        this.charts = new SleepCharts({
            canvas: this.view.byId('donut-chart'),
            ChartClass: typeof window !== 'undefined' ? window.Chart : null,
            t: (key, params) => this.bm.t(key, params)
        });
        this.bindEvents();
        this.bm.onTheme(() => this.charts.rerender());
        await this.load();
    }

    bindEvents() {
        this.view.byId('fill-date-btn').addEventListener('click', () => this.handleFillDate());
        this.view.byId('add-sleep-btn').addEventListener('click', () => this.handleAddSleep());
        this.view.byId('save-schedule-btn').addEventListener('click', () => this.handleSaveSchedule());
        this.view.byId('reset-schedule-btn').addEventListener('click', () => this.handleResetSchedule());
        this.view.byId('add-no-sleep-btn').addEventListener('click', () => this.handleAddNoSleep());
        this.view.byId('remove-no-sleep-btn').addEventListener('click', () => this.handleRemoveNoSleep());
        this.view.byId('search-btn').addEventListener('click', () => this.handleSearch());
        this.view.byId('reset-search-btn').addEventListener('click', () => this.handleResetSearch());
    }

    hasSchedule() {
        return Boolean(this.state.idealSchedule.bedtime && this.state.idealSchedule.waketime);
    }

    async load() {
        let logs;
        let schedule;
        let noSleep;
        try {
            [logs, schedule, noSleep] = await Promise.all([
                this.repository.listLogs(),
                this.repository.getSchedule(),
                this.repository.listNoSleep()
            ]);
        } catch (error) {
            return;
        }
        this.state.sleepLogs = logs;
        this.state.idealSchedule = { bedtime: schedule.ideal_bedtime, waketime: schedule.ideal_waketime };
        this.state.noSleepDays = noSleep;
        this.view.fillScheduleInputs(this.state.idealSchedule);
        this.renderAll();
        const unique = this.stats.uniqueDayCount(this.state.sleepLogs, this.state.noSleepDays);
        this.bm.setPills([this.clock.now().toLocaleDateString(this.bm.locale), this.bm.t('pill.days', { count: unique })]);
    }

    renderAll() {
        const hasSchedule = this.hasSchedule();
        const dayMap = this.stats.buildDayMap(this.state.sleepLogs, this.state.noSleepDays);
        const efficiencyData = this.stats.efficiencyMap(dayMap);
        this.state.dayMap = dayMap;
        this.state.efficiencyData = efficiencyData;

        this.view.renderStats(this.stats.summary(dayMap, this.state.idealSchedule), hasSchedule);

        const calendarResult = this.stats.calendar(
            dayMap,
            this.state.noSleepDays,
            this.state.idealSchedule,
            this.clock.todayMidnight()
        );
        this.view.renderCalendar(calendarResult, hasSchedule);
        this.charts.render(this.stats.donutData(calendarResult.counts));

        this.view.renderStreaks(
            this.stats.streaks(dayMap, this.state.noSleepDays, this.state.idealSchedule),
            hasSchedule
        );
        this.view.renderAnalysis(this.stats.analysis(this.state.sleepLogs), hasSchedule);
        this.view.renderRecords(
            this.stats.records(this.state.sleepLogs, this.state.noSleepDays, dayMap, efficiencyData)
        );
        this.view.renderWeekTable(
            this.stats.weekDays(this.state.sleepLogs, this.state.idealSchedule, efficiencyData),
            (id) => this.handleDeleteLog(id)
        );
        this.view.renderWeekdayStats(this.stats.weekdayStats(dayMap));
        this.renderLogs();
    }

    renderLogs() {
        const filtered = this.stats.filterByDate(this.state.sleepLogs, this.state.searchDate);
        const sorted = this.stats.logsSortedByStart(filtered);
        this.view.renderLogs(
            sorted,
            this.state.efficiencyData,
            this.state.idealSchedule,
            (id) => this.handleDeleteLog(id)
        );
    }

    handleFillDate() {
        this.view.fillSleepForm(this.clock.today());
    }

    async handleAddSleep() {
        const { start, end } = this.view.readSleepForm();
        const hideMs = this.config.statusHideMs;
        if (!start || !end) {
            this.view.showStatus('error', this.bm.t('status.fillBoth'), hideMs);
            return;
        }
        if (new Date(end) <= new Date(start)) {
            this.view.showStatus('error', this.bm.t('status.endBeforeStart'), hideMs);
            return;
        }
        try {
            await this.repository.addLog({ start, end });
        } catch (error) {
            this.view.showStatus('error', this.bm.t('status.error'), hideMs);
            return;
        }
        this.view.clearSleepForm();
        await this.load();
        this.view.showStatus('success', this.bm.t('status.sleepAdded'), hideMs);
    }

    async handleSaveSchedule() {
        const { bedtime, waketime } = this.view.readScheduleForm();
        const hideMs = this.config.statusHideMs;
        if (!bedtime || !waketime) {
            this.view.showStatus('error', this.bm.t('status.fillBoth'), hideMs);
            return;
        }
        try {
            await this.repository.saveSchedule({ bedtime, waketime });
        } catch (error) {
            this.view.showStatus('error', this.bm.t('status.error'), hideMs);
            return;
        }
        await this.load();
        this.view.showStatus('success', this.bm.t('status.scheduleSaved'), hideMs);
    }

    async handleResetSchedule() {
        const hideMs = this.config.statusHideMs;
        try {
            await this.repository.resetSchedule();
        } catch (error) {
            this.view.showStatus('error', this.bm.t('status.error'), hideMs);
            return;
        }
        this.state.idealSchedule = { bedtime: null, waketime: null };
        this.view.clearScheduleInputs();
        await this.load();
        this.view.showStatus('success', this.bm.t('status.scheduleReset'), hideMs);
    }

    async handleAddNoSleep() {
        const date = this.view.readNoSleepDate();
        const hideMs = this.config.statusHideMs;
        if (!date) {
            this.view.showStatus('error', this.bm.t('status.pickDate'), hideMs);
            return;
        }
        try {
            await this.repository.addNoSleep(date);
        } catch (error) {
            this.view.showStatus('error', error.message || this.bm.t('status.error'), hideMs);
            return;
        }
        await this.load();
        this.view.showStatus('success', this.bm.t('status.noSleepAdded'), hideMs);
    }

    async handleRemoveNoSleep() {
        const date = this.view.readNoSleepDate();
        const hideMs = this.config.statusHideMs;
        if (!date) {
            this.view.showStatus('error', this.bm.t('status.pickDate'), hideMs);
            return;
        }
        try {
            await this.repository.removeNoSleep(date);
        } catch (error) {
            this.view.showStatus('error', this.bm.t('status.removeError'), hideMs);
            return;
        }
        await this.load();
        this.view.showStatus('success', this.bm.t('status.noSleepRemoved'), hideMs);
    }

    handleSearch() {
        const date = this.view.readSearchDate();
        if (!date) {
            return;
        }
        this.state.searchDate = date;
        this.renderLogs();
    }

    handleResetSearch() {
        this.state.searchDate = null;
        this.view.clearSearchDate();
        this.renderLogs();
    }

    async handleDeleteLog(id) {
        try {
            await this.repository.removeLog(id);
        } catch (error) {
            return;
        }
        await this.load();
    }
}