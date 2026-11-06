import { ReactionStats } from './ReactionStats.js';

export class ReactionCharts {
    constructor({ progressCanvas, histogramCanvas, palette, settings, ChartClass, t }) {
        this.t = t;
        this.progressCanvas = progressCanvas;
        this.histogramCanvas = histogramCanvas;
        this.palette = palette;
        this.settings = settings;
        this.ChartClass = ChartClass;
        this.progress = null;
        this.histogram = null;
    }

    scales(chartTheme, xExtra = {}) {
        const tick = { color: chartTheme.text };
        const grid = { color: chartTheme.grid };
        return {
            x: { ticks: { ...tick, ...xExtra }, grid },
            y: { ticks: tick, grid }
        };
    }

    baseOptions(chartTheme, xExtra) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: chartTheme.text } } },
            scales: this.scales(chartTheme, xExtra)
        };
    }

    destroy(name) {
        if (this[name]) {
            this[name].destroy();
            this[name] = null;
        }
    }

    render(tests, formatDate, chartTheme) {
        this.destroy('progress');
        this.destroy('histogram');
        if (tests.length === 0) {
            return;
        }
        const ordered = [...tests].sort((a, b) => a.sortKey - b.sortKey);
        const averages = ordered.map((test) => test.average);
        this.progress = new this.ChartClass(this.progressCanvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: ordered.map((test) => formatDate(test.date)),
                datasets: [
                    {
                        label: this.t('chart.progressLabel'),
                        data: averages,
                        borderColor: this.palette.progress.line,
                        backgroundColor: this.palette.progress.fill,
                        fill: true,
                        tension: 0.3,
                        pointRadius: 4,
                        pointBackgroundColor: this.palette.progress.line
                    }
                ]
            },
            options: this.baseOptions(chartTheme, { maxRotation: 45, autoSkip: true, maxTicksLimit: this.settings.chartMaxTicks })
        });
        const bins = ReactionStats.histogram(averages, this.settings.maxHistogramBins);
        if (!bins) {
            return;
        }
        this.histogram = new this.ChartClass(this.histogramCanvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: bins.labels,
                datasets: [
                    {
                        label: this.t('chart.countLabel'),
                        data: bins.counts,
                        backgroundColor: this.palette.histogram.fill,
                        borderColor: this.palette.histogram.line,
                        borderWidth: 1
                    }
                ]
            },
            options: this.baseOptions(chartTheme)
        });
    }
}
