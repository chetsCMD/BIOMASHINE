import { TrainingViewBase } from './TrainingViewBase.js';

export class TrainingChartsView extends TrainingViewBase {
    constructor(doc, calculator, stats, config, ChartClass, t) {
        super(doc, t);
        this.calculator = calculator;
        this.stats = stats;
        this.config = config;
        this.ChartClass = ChartClass;
        this.chart = null;
    }

    fillExerciseSelect(names) {
        const select = this.byId('progress-exercise-select');
        const current = select.value;
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

    readSelection() {
        return {
            exerciseName: this.byId('progress-exercise-select').value,
            period: this.byId('progress-period').value
        };
    }

    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }

    showEmpty(text) {
        this.destroy();
        this.byId('progress-stats').textContent = text;
    }

    render({ workouts, chartTheme }) {
        this.destroy();
        const { exerciseName, period } = this.readSelection();

        if (!exerciseName) {
            this.byId('progress-stats').textContent = this.t('progress.selectExercise');
            return;
        }

        const data = this.stats.progressSeries(workouts, exerciseName, period);
        if (data.length === 0) {
            this.byId('progress-stats').textContent = this.t('progress.noData');
            return;
        }

        const summary = this.stats.progressSummary(data);
        this.byId('progress-stats').textContent = this.t('progress.summary', {
            total: summary.total,
            firstWeight: summary.first.weight,
            lastWeight: summary.last.weight,
            weightChange: `${summary.weightChange >= 0 ? '+' : ''}${summary.weightChange.toFixed(1)}`,
            firstReps: summary.first.reps,
            lastReps: summary.last.reps,
            repsChange: `${summary.repsChange >= 0 ? '+' : ''}${summary.repsChange}`
        });

        const config = this.config.chart;
        const ctx = this.byId('progress-chart').getContext('2d');
        this.chart = new this.ChartClass(ctx, {
            type: 'line',
            data: {
                labels: data.map((entry) => this.calculator.formatDate(entry.date)),
                datasets: [
                    {
                        label: this.t(config.datasets.weight.labelKey),
                        data: data.map((entry) => entry.weight),
                        borderColor: config.datasets.weight.borderColor,
                        backgroundColor: config.datasets.weight.backgroundColor,
                        fill: true,
                        tension: config.tension,
                        pointRadius: config.pointRadius
                    },
                    {
                        label: this.t(config.datasets.reps.labelKey),
                        data: data.map((entry) => entry.reps),
                        borderColor: config.datasets.reps.borderColor,
                        backgroundColor: config.datasets.reps.backgroundColor,
                        fill: true,
                        tension: config.tension,
                        pointRadius: config.pointRadius
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: chartTheme.text } } },
                scales: {
                    x: {
                        ticks: {
                            color: chartTheme.text,
                            maxRotation: config.maxRotation,
                            autoSkip: true,
                            maxTicksLimit: config.maxTicksLimit
                        },
                        grid: { color: chartTheme.grid }
                    },
                    y: {
                        ticks: { color: chartTheme.text },
                        grid: { color: chartTheme.grid }
                    }
                }
            }
        });
    }
}