export class SleepCharts {
    constructor({ canvas, ChartClass, t, data }) {
        this.canvas = canvas;
        this.ChartClass = ChartClass;
        this.t = t;
        this.data = data || null;
        this.instance = null;
    }

    destroy() {
        if (this.instance) {
            this.instance.destroy();
            this.instance = null;
        }
    }

    render(donutData) {
        this.destroy();
        if (!donutData || !this.ChartClass) {
            return;
        }
        this.data = donutData;
        const ctx = this.canvas.getContext('2d');
        this.instance = new this.ChartClass(ctx, {
            type: 'doughnut',
            data: {
                labels: donutData.labelKeys.map((key) => this.t(key)),
                datasets: [
                    {
                        data: donutData.data,
                        backgroundColor: donutData.backgroundColor,
                        borderWidth: 0,
                        cutout: donutData.cutout
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const p = Math.round((context.raw / total) * 100);
                                return this.t('donut.tooltip', { count: context.raw, percent: p });
                            }
                        }
                    }
                }
            }
        });
    }

    rerender() {
        this.render(this.data);
    }
}