import { KbjuCalculator } from './KbjuCalculator.js';
import { KbjuRepository } from './KbjuRepository.js';
import { KbjuView } from './KbjuView.js';

export class KbjuModule {
    constructor(bm, doc) {
        this.bm = bm;
        this.doc = doc;
        this.state = { weight: null, height: null, age: null, trainings: null };
    }

    formatDate(value) {
        if (!value) {
            return '—';
        }
        const parts = String(value).split('T')[0].split('-').map(Number);
        if (parts.length !== 3 || parts.some(Number.isNaN)) {
            return String(value);
        }
        return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString(this.bm.locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    async start() {
        this.config = await this.bm.config('kbju');
        this.calculator = new KbjuCalculator(this.config);
        this.repository = new KbjuRepository(this.bm);
        this.view = new KbjuView(this.doc, (key, params) => this.bm.t(key, params));
        this.view.byId('save-params-btn').addEventListener('click', () => this.saveParams());
        this.view.byId('tep-toggle').addEventListener('change', () => this.recalculate());
        await this.load();
    }

    async load() {
        const { user, measurements } = await this.repository.overview();
        this.state.height = user.height || null;
        this.state.age = user.age || null;
        this.state.trainings = user.trainings_count === undefined ? null : user.trainings_count;
        this.view.fillParams(user);
        const latest = measurements[measurements.length - 1];
        this.state.weight = latest ? latest.weight : null;
        this.bm.setPills([this.formatDate(latest ? latest.date : null), this.bm.t('pill.measurements', { count: measurements.length })]);
        this.recalculate();
    }

    thermicEffect() {
        return this.view.byId('tep-toggle').checked;
    }

    recalculate() {
        const result = this.calculator.calculate({ ...this.state, thermicEffect: this.thermicEffect() });
        this.view.showMissing(this.calculator.missing(this.state));
        if (result) {
            this.view.renderResult(result);
        } else if (this.state.weight) {
            this.view.renderNutrients(this.calculator.nutrients(this.state.weight, this.thermicEffect()));
        }
    }

    async saveParams() {
        const params = this.view.readParams();
        const hideMs = this.config.statusHideMs;
        if (Object.values(params).some((value) => Number.isNaN(value))) {
            this.view.showStatus('error', this.bm.t('status.fillAll'), hideMs);
            return;
        }
        try {
            await this.repository.saveParams(params);
        } catch (error) {
            this.view.showStatus('error', this.bm.t(error.status ? 'status.saveError' : 'status.connectionError'), hideMs);
            return;
        }
        Object.assign(this.state, { height: params.height, age: params.age, trainings: params.trainings });
        this.recalculate();
        this.view.showStatus('success', this.bm.t('status.saved'), hideMs);
    }
}
