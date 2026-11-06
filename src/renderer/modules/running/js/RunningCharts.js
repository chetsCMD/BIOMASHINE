export class RunningCharts {
    constructor({ doc, ChartClass, palette, t, formatWeekday }) {
        this.doc = doc;
        this.ChartClass = ChartClass;
        this.palette = palette;
        this.t = t;
        this.formatWeekday = formatWeekday;
        this.charts = {
            weekDistance: null,
            weekTime: null,
            allDistance: null,
            allTime: null
        };
    }

    byId(id) {
        return this.doc.getElementById(id);
    }

    baseOptions(chartTheme, xExtra = {}) {
        const tick = { color: chartTheme.text };
        const grid = { color: chartTheme.grid };
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: chartTheme.text } } },
            scales: {
                y: { grid, ticks: tick },
                x: { ticks: { ...tick, ...xExtra } }
            }
        };
    }

    destroy(key) {
        if (this.charts[key]) {
            this.charts[key].destroy();
            this.charts[key] = null;
        }
    }

    destroyAll() {
        Object.keys(this.charts).forEach((key) => this.destroy(key));
    }

    renderWeek(weekTotals, chartTheme) {
        this.destroy('weekDistance');
        this.destroy('weekTime');
        const labels = weekTotals.map((d) => this.formatWeekday(d.dateStr));
        const distances = weekTotals.map((d) => d.distance);
        const times = weekTotals.map((d) => d.timeSeconds / 60);

        this.charts.weekDistance = new this.ChartClass(this.byId('distance-chart').getContext('2d'), {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: this.t('unit.km'),
                    data: distances,
                    backgroundColor: this.palette.distanceFill,
                    borderColor: this.palette.distanceColor,
                    borderWidth: 1
                }]
            },
            options: this.baseOptions(chartTheme)
        });

        this.charts.weekTime = new this.ChartClass(this.byId('time-chart').getContext('2d'), {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: this.t('unit.min'),
                    data: times,
                    backgroundColor: this.palette.timeFill,
                    borderColor: this.palette.timeColor,
                    borderWidth: 1
                }]
            },
            options: this.baseOptions(chartTheme)
        });
    }

    renderAllTime(sortedRuns, formatDate, chartTheme) {
        this.destroy('allDistance');
        this.destroy('allTime');
        if (sortedRuns.length === 0) {
            return;
        }
        const labels = sortedRuns.map((r) => formatDate(r.date));
        const distances = sortedRuns.map((r) => r.distance);
        const times = sortedRuns.map((r) => r.time_seconds / 60);
        const xExtra = {
            maxRotation: 45,
            autoSkip: true,
            maxTicksLimit: this.palette.maxTicksLimit
        };

        this.charts.allDistance = new this.ChartClass(this.byId('all-distance-chart').getContext('2d'), {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: this.t('unit.km'),
                    data: distances,
                    borderColor: this.palette.distanceColor,
                    backgroundColor: this.palette.distanceFillLine,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 3,
                    pointBackgroundColor: this.palette.distanceColor
                }]
            },
            options: this.baseOptions(chartTheme, xExtra)
        });

        this.charts.allTime = new this.ChartClass(this.byId('all-time-chart').getContext('2d'), {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: this.t('unit.min'),
                    data: times,
                    borderColor: this.palette.timeColor,
                    backgroundColor: this.palette.timeFillLine,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 3,
                    pointBackgroundColor: this.palette.timeColor
                }]
            },
            options: this.baseOptions(chartTheme, xExtra)
        });
    }
}