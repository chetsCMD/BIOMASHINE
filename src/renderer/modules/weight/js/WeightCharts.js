export class WeightCharts {
    constructor({ container, settings, palette, ChartClass, bm, clock, doc, t }) {
        this.container = container;
        this.settings = settings;
        this.palette = palette;
        this.ChartClass = ChartClass;
        this.bm = bm;
        this.clock = clock;
        this.doc = doc;
        this.t = t;
        this.instances = {};
    }

    destroy() {
        Object.keys(this.instances).forEach(key => {
            if (this.instances[key]) {
                this.instances[key].destroy();
                this.instances[key] = null;
            }
        });
        this.container.replaceChildren();
    }

    filterByPeriod(measurements, period) {
        if (period === 'all') return measurements;
        const now = this.clock.now();
        now.setHours(0, 0, 0, 0);
        const cutoff = new Date(now);
        if (period === 'week') cutoff.setDate(now.getDate() - 7);
        else if (period === 'month') cutoff.setMonth(now.getMonth() - 1);
        else if (period === '3months') cutoff.setMonth(now.getMonth() - 3);
        else if (period === 'year') cutoff.setFullYear(now.getFullYear() - 1);
        else return measurements;
        return measurements.filter(m => new Date(m.date) >= cutoff);
    }

    el(tag, className, text) {
        const node = this.doc.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    render(measurements, period, formatDate) {
        this.destroy();
        if (!measurements.length) {
            this.container.append(this.el('div', 'empty', this.t('empty.noData')));
            return;
        }

        const filtered = this.filterByPeriod(measurements, period);
        if (filtered.length === 0) {
            this.container.append(this.el('div', 'empty', this.t('empty.noDataPeriod')));
            return;
        }

        const sorted = [...filtered].sort((a, b) => new Date(a.date) - new Date(b.date));
        const theme = this.bm.theme.chart;

        Object.keys(this.palette).forEach(key => {
            const m = this.palette[key];
            const vals = sorted.map(d => d[key] !== undefined && d[key] !== null ? d[key] : null).filter(v => v !== null);

            if (vals.length === 0) {
                const card = this.el('div', 'chart-card');
                const head = this.el('div', 'chart-head');
                head.append(this.el('span', 'chart-name', this.t(m.labelKey)));
                card.append(head, this.el('div', 'empty', this.t('empty.noData')));
                this.container.append(card);
                return;
            }

            const cur = sorted[sorted.length - 1][key];
            const mn = Math.min(...vals);
            const mx = Math.max(...vals);

            const card = this.el('div', 'chart-card');
            const head = this.el('div', 'chart-head');
            head.append(this.el('span', 'chart-name', this.t(m.labelKey)));

            if (cur !== null && cur !== undefined) {
                const curSpan = this.el('span', 'chart-cur');
                curSpan.textContent = Number(cur).toFixed(1);
                const unitSpan = this.el('span', 'u', ` ${this.t(m.unitKey)}`);
                curSpan.append(unitSpan);
                head.append(curSpan);
            }

            const meta = this.el('div', 'chart-meta');
            if (sorted.length > 1 && vals.length > 1) {
                const firstVal = sorted[0][key];
                const lastVal = sorted[sorted.length - 1][key];
                if (firstVal !== null && lastVal !== null) {
                    const diff = (lastVal - firstVal).toFixed(1);
                    const sign = parseFloat(diff) >= 0 ? '+' : '';

                    const createStat = (label, val) => {
                        const stat = this.el('div', 'chart-stat');
                        stat.append(
                            this.el('div', 'chart-stat-l', label),
                            this.el('div', 'chart-stat-v', val)
                        );
                        return stat;
                    };

                    meta.append(
                        createStat(this.t('chart.min'), `${Number(mn).toFixed(1)} ${this.t(m.unitKey)}`),
                        createStat(this.t('chart.max'), `${Number(mx).toFixed(1)} ${this.t(m.unitKey)}`),
                        createStat(this.t('chart.total'), `${sign}${diff} ${this.t(m.unitKey)}`)
                    );
                }
            }

            const wrap = this.el('div', 'chart-wrap');
            wrap.style.height = `${this.settings.height}px`;
            const canvas = this.el('canvas');
            wrap.append(canvas);

            card.append(head, meta, wrap);
            this.container.append(card);

            const ctx = canvas.getContext('2d');
            let backgroundColor = m.color;
            if (ctx && typeof ctx.createLinearGradient === 'function') {
                const gradient = ctx.createLinearGradient(0, 0, 0, 200);
                const rgb = m.color === '#ffffff' ? '255,255,255' : m.color === '#aaaaaa' ? '170,170,170' : '102,102,102';
                gradient.addColorStop(0, `rgba(${rgb},.15)`);
                gradient.addColorStop(1, `rgba(${rgb},0)`);
                backgroundColor = gradient;
            }

            const labels = sorted.map(d => formatDate(d.date));
            const displayVals = sorted.map(d => d[key]);
            const unit = this.t(m.unitKey);

            this.instances[key] = new this.ChartClass(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        data: displayVals,
                        borderColor: m.color,
                        borderWidth: this.settings.borderWidth,
                        pointRadius: sorted.length > this.settings.maxPointRadiusThreshold ? 0 : this.settings.pointRadius,
                        pointBackgroundColor: m.color,
                        pointBorderColor: this.settings.pointBorderColor,
                        pointBorderWidth: this.settings.pointBorderWidth,
                        tension: this.settings.tension,
                        fill: true,
                        backgroundColor: backgroundColor,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: this.settings.animationDuration },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: '#1a1a1a',
                            borderColor: '#333',
                            borderWidth: 1,
                            titleColor: theme.text,
                            bodyColor: '#f2f2f2',
                            titleFont: { family: 'JetBrains Mono', size: 10 },
                            bodyFont: { family: 'JetBrains Mono', size: 12 },
                            padding: 10,
                            callbacks: {
                                label: (ctx2) => ` ${Number(ctx2.parsed.y).toFixed(1)} ${unit}`
                            }
                        }
                    },
                    scales: {
                        x: {
                            ticks: { color: theme.text, font: { family: 'JetBrains Mono', size: 9 }, maxRotation: 45, autoSkip: true, maxTicksLimit: this.settings.maxTicksX },
                            grid: { color: theme.grid }
                        },
                        y: {
                            display: true,
                            position: 'right',
                            grid: { color: theme.grid, lineWidth: 1 },
                            border: { display: false },
                            ticks: {
                                color: theme.text,
                                font: { family: 'JetBrains Mono', size: 9 },
                                maxTicksLimit: this.settings.maxTicksY,
                                callback: v => `${Number(v).toFixed(0)}${unit}`
                            }
                        }
                    }
                }
            });
        });
    }
}