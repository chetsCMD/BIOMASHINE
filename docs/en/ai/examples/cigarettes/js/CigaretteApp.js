import { CigaretteStore } from './CigaretteStore.js';
import { DayCounter } from './DayCounter.js';

export class CigaretteApp {
    constructor(bm, doc, ChartClass) {
        this.bm = bm;
        this.doc = doc;
        this.ChartClass = ChartClass;
        this.store = new CigaretteStore(bm.storage);
        this.chart = null;
        this.entries = [];
        this.goal = 10;
    }

    async start() {
        this.doc.getElementById('add-btn').addEventListener('click', () => this.add());
        this.doc.getElementById('goal-input').addEventListener('change', (event) => this.changeGoal(event.target.value));
        this.bm.onTheme(() => this.renderChart());
        await this.reload();
    }

    async reload() {
        this.goal = await this.store.getGoal();
        this.entries = await this.store.listEntries();
        this.doc.getElementById('goal-input').value = this.goal;
        this.render();
    }

    async add() {
        await this.store.addEntry(this.bm.clock.timestamp());
        await this.reload();
    }

    async changeGoal(value) {
        const goal = Math.max(0, Math.round(Number(value)) || 0);
        await this.store.saveGoal(goal);
        await this.reload();
    }

    async remove(id) {
        if (await this.bm.confirm(this.bm.t('journal.confirmDelete'), { confirmText: this.bm.t('common.delete'), danger: true })) {
            await this.store.removeEntry(id);
            await this.reload();
        }
    }

    render() {
        const week = DayCounter.lastDays(this.entries, 7, this.bm.clock.now());
        const today = week[week.length - 1].count;
        const total = week.reduce((sum, day) => sum + day.count, 0);
        this.renderStats([
            [this.bm.t('stat.today'), `${today} / ${this.goal}`],
            [this.bm.t('stat.week'), total],
            [this.bm.t('stat.average'), (total / 7).toFixed(1)]
        ]);
        this.renderJournal();
        this.renderChart();
        this.bm.setPills([this.bm.t('pill.entries', { count: this.entries.length })]);
    }

    renderStats(items) {
        this.doc.getElementById('stats').replaceChildren(
            ...items.map(([label, value]) => {
                const card = this.doc.createElement('div');
                card.className = 'bm-stat';
                const title = this.doc.createElement('div');
                title.className = 'bm-stat-label';
                title.textContent = label;
                const number = this.doc.createElement('div');
                number.className = 'bm-stat-value';
                number.textContent = value;
                card.append(title, number);
                return card;
            })
        );
    }

    renderJournal() {
        const journal = this.doc.getElementById('journal');
        if (this.entries.length === 0) {
            const empty = this.doc.createElement('div');
            empty.className = 'bm-empty';
            empty.textContent = this.bm.t('journal.empty');
            journal.replaceChildren(empty);
            return;
        }
        journal.replaceChildren(
            ...[...this.entries].reverse().slice(0, 10).map((entry) => {
                const item = this.doc.createElement('div');
                item.className = 'bm-list-item';
                const time = this.doc.createElement('span');
                time.textContent = new Date(entry.data.at).toLocaleString(this.bm.locale);
                const button = this.doc.createElement('button');
                button.className = 'bm-btn secondary';
                button.textContent = this.bm.t('common.delete');
                button.addEventListener('click', () => this.remove(entry.id));
                item.append(time, button);
                return item;
            })
        );
    }

    renderChart() {
        const week = DayCounter.lastDays(this.entries, 7, this.bm.clock.now());
        const colors = this.bm.theme.chart;
        const accent = getComputedStyle(this.doc.documentElement).getPropertyValue('--wh').trim();
        if (this.chart) {
            this.chart.destroy();
        }
        this.chart = new this.ChartClass(this.doc.getElementById('week-chart').getContext('2d'), {
            type: 'bar',
            data: {
                labels: week.map((day) => day.key.slice(5)),
                datasets: [{ label: this.bm.t('chart.label'), data: week.map((day) => day.count), backgroundColor: accent }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: colors.text } } },
                scales: {
                    x: { ticks: { color: colors.text }, grid: { color: colors.grid } },
                    y: { beginAtZero: true, ticks: { color: colors.text, precision: 0 }, grid: { color: colors.grid } }
                }
            }
        });
    }
}
