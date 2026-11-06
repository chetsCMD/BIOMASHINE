export class NutritionCharts {
    constructor({ ChartClass, config }) {
        this.ChartClass = ChartClass;
        this.config = config;
        this.charts = { today: null, stats: null, selected: null };
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

    macroCalories(protein, fat, carbs) {
        const macros = this.config.macros;
        return {
            proteinCal: protein * macros.protein.caloriesPerGram,
            fatCal: fat * macros.fat.caloriesPerGram,
            carbsCal: carbs * macros.carbs.caloriesPerGram
        };
    }

    render(key, canvas, protein, fat, carbs) {
        if (!canvas || !this.ChartClass) {
            return;
        }
        this.destroy(key);
        if (!protein && !fat && !carbs) {
            return;
        }
        const { proteinCal, fatCal, carbsCal } = this.macroCalories(protein, fat, carbs);
        const macros = this.config.macros;
        const tooltip = this.config.tooltip;
        this.charts[key] = new this.ChartClass(canvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [proteinCal, fatCal, carbsCal],
                    backgroundColor: [macros.protein.color, macros.fat.color, macros.carbs.color],
                    borderColor: this.config.donut.borderColor,
                    borderWidth: this.config.donut.borderWidth,
                    hoverBorderColor: this.config.donut.borderColor
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                cutout: this.config.donut.cutout,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: tooltip.backgroundColor,
                        borderColor: tooltip.borderColor,
                        borderWidth: tooltip.borderWidth,
                        titleColor: tooltip.titleColor,
                        bodyColor: tooltip.bodyColor,
                        titleFont: { family: 'JetBrains Mono', size: 10 },
                        bodyFont: { family: 'JetBrains Mono', size: 12 },
                        padding: 10,
                        callbacks: {
                            label: (context) => {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percent = Math.round((context.parsed / total) * 100);
                                return ` ${percent}%`;
                            }
                        }
                    }
                }
            }
        });
    }
}