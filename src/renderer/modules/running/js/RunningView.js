export class RunningView {
    constructor(doc, t, formatWeekday) {
        this.doc = doc;
        this.t = t;
        this.formatWeekday = formatWeekday;
        this.statusTimer = null;
    }

    byId(id) {
        return this.doc.getElementById(id);
    }

    el(tag, className, text) {
        const node = this.doc.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    showStatus(kind, text, hideMs) {
        const box = this.byId('run-status');
        box.className = `run-status ${kind}`;
        box.textContent = text;
        clearTimeout(this.statusTimer);
        this.statusTimer = setTimeout(() => {
            box.className = 'run-status';
        }, hideMs);
    }

    fillDefaultDate(today) {
        this.byId('run-date').value = today;
    }

    readAddForm() {
        const caloriesRaw = this.byId('run-calories').value;
        const startSpeedRaw = this.byId('run-start-speed').value;
        const maxSpeedRaw = this.byId('run-max-speed').value;
        const inclineRaw = this.byId('run-incline').value;
        return {
            date: this.byId('run-date').value,
            timeStr: this.byId('run-time').value,
            distance: parseFloat(this.byId('run-distance').value),
            calories: caloriesRaw ? parseFloat(caloriesRaw) : null,
            startSpeed: startSpeedRaw ? parseFloat(startSpeedRaw) : null,
            maxSpeed: maxSpeedRaw ? parseFloat(maxSpeedRaw) : null,
            incline: inclineRaw ? parseFloat(inclineRaw) : null
        };
    }

    clearAddForm(today) {
        this.byId('run-date').value = today;
        this.byId('run-time').value = '';
        this.byId('run-distance').value = '';
        this.byId('run-calories').value = '';
        this.byId('run-start-speed').value = '';
        this.byId('run-max-speed').value = '';
        this.byId('run-incline').value = '';
    }

    statCard(label, value, unit) {
        const card = this.el('div', 'stat-card');
        card.append(this.el('div', 'stat-card-label', label));
        const valueNode = this.el('div', 'stat-card-value', value);
        if (unit) {
            valueNode.append(' ', this.el('span', 'stat-card-unit', unit));
        }
        card.append(valueNode);
        return card;
    }

    renderStats(totals, formatTime) {
        const grid1 = this.el('div', 'stats-grid');
        grid1.append(
            this.statCard(this.t('stat.totalTime'), formatTime(totals.totalTime), ''),
            this.statCard(this.t('stat.totalDistance'), totals.totalDistance.toFixed(2), this.t('unit.km')),
            this.statCard(this.t('stat.maxTime'), formatTime(totals.maxTime), ''),
            this.statCard(this.t('stat.maxDistance'), totals.maxDistance.toFixed(2), this.t('unit.km')),
            this.statCard(this.t('stat.totalCalories'), String(Math.round(totals.totalCalories)), this.t('unit.kcal')),
            this.statCard(this.t('stat.totalRuns'), String(totals.count), this.t('unit.pcs'))
        );
        const block1 = this.el('div', 'stats-block');
        block1.append(this.el('div', 'stats-block-title', this.t('stats.summary')), grid1);

        const grid2 = this.el('div', 'stats-grid');
        grid2.append(
            this.statCard(this.t('stat.avgCalories'), String(Math.round(totals.avgCalories)), this.t('unit.kcal')),
            this.statCard(this.t('stat.avgStartSpeed'), totals.avgStartSpeed.toFixed(1), this.t('unit.kmh')),
            this.statCard(this.t('stat.maxSpeed'), totals.maxMaxSpeed.toFixed(1), this.t('unit.kmh')),
            this.statCard(this.t('stat.avgIncline'), totals.avgIncline.toFixed(1), this.t('unit.percent')),
            this.statCard(this.t('stat.maxIncline'), totals.maxIncline.toFixed(1), this.t('unit.percent')),
            this.statCard(this.t('stat.avgDistance'), totals.avgDistance.toFixed(2), this.t('unit.km'))
        );
        const block2 = this.el('div', 'stats-block');
        block2.append(this.el('div', 'stats-block-title', this.t('stats.averagesAndMax')), grid2);

        this.byId('stats-section').replaceChildren(block1, block2);
    }

    renderGoals(state, formatTime) {
        this.byId('dist-progress').style.width = `${state.distance.progress}%`;
        this.byId('dist-current').textContent = `${state.distance.current.toFixed(2)} ${this.t('unit.km')}`;
        this.byId('dist-target-text').textContent = state.distance.target ? `${state.distance.target.toFixed(2)} ${this.t('unit.km')}` : `— ${this.t('unit.km')}`;

        this.byId('time-progress').style.width = `${state.time.progress}%`;
        this.byId('time-current').textContent = formatTime(state.time.current);
        this.byId('time-target-text').textContent = state.time.target ? formatTime(state.time.target) : '—';

        this.byId('cal-progress').style.width = `${state.calories.progress}%`;
        this.byId('cal-current').textContent = `${Math.round(state.calories.current)} ${this.t('unit.kcal')}`;
        this.byId('cal-target-text').textContent = state.calories.target ? `${Math.round(state.calories.target)} ${this.t('unit.kcal')}` : `— ${this.t('unit.kcal')}`;

        if (state.distance.deadline) this.byId('dist-deadline').value = state.distance.deadline;
        if (state.time.deadline) this.byId('time-deadline').value = state.time.deadline;
        if (state.calories.deadline) this.byId('cal-deadline').value = state.calories.deadline;
        if (state.distance.target) this.byId('dist-target').value = state.distance.target;
        if (state.time.target) this.byId('time-target').value = state.time.target;
        if (state.calories.target) this.byId('cal-target').value = state.calories.target;
    }

    renderWeek(weekTotals, formatTime, todayStr) {
        const nodes = weekTotals.map((day) => {
            const wrapper = this.el('div');
            wrapper.append(this.el('div', 'week-day-header', this.formatWeekday(day.dateStr)));
            const classes = ['week-day'];
            if (day.dateStr === todayStr) classes.push('today');
            if (day.hasData) classes.push('has-data');
            const cell = this.el('div', classes.join(' '));
            cell.append(this.el('div', 'week-day-number', String(day.dayNumber)));
            if (day.hasData) {
                cell.append(this.el('div', 'week-day-distance', `${day.distance.toFixed(2)} ${this.t('unit.km')}`));
                cell.append(this.el('div', 'week-day-time', formatTime(day.timeSeconds)));
            } else {
                cell.append(this.el('div', 'week-day-no-data', this.t('week.noData')));
            }
            wrapper.append(cell);
            return wrapper;
        });
        this.byId('week-grid').replaceChildren(...nodes);
    }

    renderAchievements(achievements) {
        const panel = this.byId('achievements-panel');
        const title = this.el('div', 'panel-title', this.t('achievements.title'));
        if (achievements.length === 0) {
            panel.replaceChildren(title);
            return;
        }
        const grid = this.el('div', 'achievements-grid');
        for (const ach of achievements) {
            const item = this.el('div', `achievement-item${ach.unlocked ? '' : ' locked'}`);
            item.append(this.el('div', 'achievement-icon', ach.unlocked ? '🏆' : '🔒'));
            const info = this.el('div', 'achievement-info');
            info.append(
                this.el('div', 'achievement-name', ach.nameKey ? this.t(ach.nameKey) : ''),
                this.el('div', 'achievement-desc', ach.descriptionKey ? this.t(ach.descriptionKey) : ''),
                this.el('div', 'achievement-progress', `${ach.progress.toFixed(2)} / ${ach.required.toFixed(2)} ${this.t('unit.km')}`)
            );
            item.append(info);
            grid.append(item);
        }
        panel.replaceChildren(title, grid);
    }

    renderList(sorted, formatDate, formatTime, onDelete) {
        const container = this.byId('running-list');
        if (sorted.length === 0) {
            container.replaceChildren(this.el('div', 'empty', this.t('list.empty')));
            return;
        }
        const items = sorted.map((run) => {
            const item = this.el('div', 'running-item');
            item.append(this.el('div', 'running-item-date', formatDate(run.date)));
            const stats = this.el('div', 'running-item-stats');

            const distStat = this.el('span', 'running-item-stat');
            distStat.append(this.el('strong', '', run.distance.toFixed(2)));
            distStat.append(this.el('span', '', ` ${this.t('unit.km')}`));
            stats.append(distStat);

            const timeStat = this.el('span', 'running-item-stat');
            timeStat.append(this.el('strong', '', formatTime(run.time_seconds)));
            stats.append(timeStat);

            if (run.calories) {
                const calStat = this.el('span', 'running-item-stat');
                calStat.append(this.el('strong', '', String(Math.round(run.calories))));
                calStat.append(this.el('span', '', ` ${this.t('unit.kcal')}`));
                stats.append(calStat);
            }
            if (run.start_speed) {
                stats.append(this.el('span', 'running-item-stat', this.t('list.startSpeed', { value: run.start_speed.toFixed(1) })));
            }
            if (run.max_speed) {
                stats.append(this.el('span', 'running-item-stat', this.t('list.maxSpeed', { value: run.max_speed.toFixed(1) })));
            }
            if (run.incline) {
                stats.append(this.el('span', 'running-item-stat', this.t('list.incline', { value: run.incline.toFixed(1) })));
            }

            item.append(stats);
            const deleteBtn = this.el('button', 'delete-btn', this.t('common.delete'));
            deleteBtn.addEventListener('click', () => onDelete(run.id));
            item.append(deleteBtn);
            return item;
        });
        container.replaceChildren(...items);
    }
}