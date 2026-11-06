import { ModuleClock } from './ModuleClock.js';
import { ReactionCharts } from './ReactionCharts.js';
import { ReactionRepository } from './ReactionRepository.js';
import { ReactionStats } from './ReactionStats.js';
import { ReactionTest } from './ReactionTest.js';
import { ReactionView } from './ReactionView.js';

export class ReactionModule {
    constructor(bm, doc) {
        this.bm = bm;
        this.doc = doc;
        this.tests = [];
        this.saving = false;
        this.clock = new ModuleClock(bm);
    }

    formatDate(value) {
        if (!value) {
            return '';
        }
        return new Date(String(value).replace(' ', 'T')).toLocaleString(this.bm.locale, {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    async start() {
        const [settings, charts] = await Promise.all([this.bm.config('reaction'), this.bm.config('charts')]);
        this.view = new ReactionView(this.doc, (key, params) => this.bm.t(key, params));
        this.repository = new ReactionRepository(this.bm);
        this.charts = new ReactionCharts({
            progressCanvas: this.doc.getElementById('progress-chart'),
            histogramCanvas: this.doc.getElementById('histogram-chart'),
            palette: charts.reaction,
            settings,
            ChartClass: window.Chart,
            t: (key, params) => this.bm.t(key, params)
        });
        this.settings = settings;
        this.test = new ReactionTest({
            config: settings,
            listener: {
                onState: (state) => this.view.setBox(state),
                onReset: () => this.view.hideResult(),
                onFinish: (outcome) => this.finish(outcome)
            }
        });
        this.bindControls();
        this.bm.onTheme(() => this.renderCharts());
        await this.reload();
    }

    bindControls() {
        this.doc.getElementById('reaction-box').addEventListener('click', () => this.test.press());
        this.doc.getElementById('start-test-btn').addEventListener('click', () => this.test.start());
        this.doc.getElementById('reset-test-btn').addEventListener('click', () => this.test.abort());
    }

    async finish({ values, average, complete }) {
        this.view.showResult(values, average);
        if (complete) {
            await this.save(values, average);
        }
    }

    async save(values, average) {
        if (this.saving) {
            return;
        }
        this.saving = true;
        this.view.setSaveStatus('', this.bm.t('save.saving'));
        try {
            await this.repository.add(values, average);
            this.view.setSaveStatus('success', this.bm.t('save.saved'));
            await this.reload();
        } catch (error) {
            this.view.setSaveStatus('error', this.bm.t('save.error', { message: error.message }));
        }
        this.saving = false;
    }

    async reload() {
        this.tests = (await this.repository.list()).map((test) => ({
            ...test,
            sortKey: new Date(String(test.date).replace(' ', 'T')).getTime()
        }));
        this.bm.setPills([this.clock.today(), this.bm.t('pill.tests', { count: this.tests.length })]);
        this.render();
    }

    render() {
        const summary = ReactionStats.summarize(this.tests.map((test) => test.average));
        this.view.renderStats(this.tests.length, summary);
        this.view.renderHistory(this.tests, (value) => this.formatDate(value), (id) => this.remove(id));
        this.renderCharts();
    }

    renderCharts() {
        this.charts.render(this.tests, (value) => this.formatDate(value), this.bm.theme.chart);
    }

    async remove(id) {
        if (!(await this.bm.confirm(this.bm.t('history.confirmDelete'), { confirmText: this.bm.t('common.delete'), danger: true }))) {
            return;
        }
        await this.repository.remove(id);
        await this.reload();
    }
}
