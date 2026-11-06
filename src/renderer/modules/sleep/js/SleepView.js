export class SleepView {
    constructor(doc, stats, t) {
        this.doc = doc;
        this.stats = stats;
        this.t = t;
        this.statusTimer = null;
    }

    byId(id) {
        return this.doc.getElementById(id);
    }

    el(tag, className, text) {
        const node = this.doc.createElement(tag);
        if (className) {
            node.className = className;
        }
        if (text !== undefined) {
            node.textContent = text;
        }
        return node;
    }

    appendWithBr(parent, nodes) {
        nodes.forEach((node, index) => {
            if (index > 0) {
                parent.append(this.doc.createElement('br'));
            }
            parent.append(node);
        });
    }

    formatDuration(hours) {
        const parts = this.stats.durationParts(hours);
        return this.t('duration.hm', { hours: parts.hours, minutes: parts.minutes });
    }

    titleText(info) {
        if (info.titleType === 'miss') {
            return this.t('calendar.title.miss', { date: info.date });
        }
        if (info.titleType === 'noSleep') {
            return this.t('calendar.title.noSleep', { date: info.date });
        }
        const sessionStr = info.sessions.map((s) => {
            const dur = this.stats.calcDuration(s.start_time, s.end_time);
            return `${this.stats.formatTimeHM(s.start_time)}-${this.stats.formatTimeHM(s.end_time)} (${this.formatDuration(dur)})`;
        }).join(', ');
        const key = info.titleType === 'ideal' ? 'calendar.title.totalIdeal' : 'calendar.title.total';
        return this.t(key, {
            date: info.date,
            duration: this.formatDuration(info.totalDuration),
            sessions: sessionStr
        });
    }

    showStatus(kind, text, hideAfterMs) {
        const box = this.byId('add-data-status');
        box.style.display = 'block';
        box.className = `add-data-status ${kind}`;
        box.textContent = text;
        clearTimeout(this.statusTimer);
        this.statusTimer = setTimeout(() => {
            box.style.display = 'none';
        }, hideAfterMs);
    }

    hideClosest(id) {
        const el = this.byId(id);
        if (el && el.parentNode) {
            el.parentNode.style.display = 'none';
        }
    }

    showClosest(id) {
        const el = this.byId(id);
        if (el && el.parentNode) {
            el.parentNode.style.display = '';
        }
    }

    fillScheduleInputs(schedule) {
        this.byId('ideal-bedtime').value = schedule.bedtime || '';
        this.byId('ideal-waketime').value = schedule.waketime || '';
    }

    clearScheduleInputs() {
        this.byId('ideal-bedtime').value = '';
        this.byId('ideal-waketime').value = '';
    }

    fillSleepForm(dateKey) {
        const value = `${dateKey}T00:00`;
        this.byId('sleep-start').value = value;
        this.byId('sleep-end').value = value;
    }

    clearSleepForm() {
        this.byId('sleep-start').value = '';
        this.byId('sleep-end').value = '';
    }

    readSleepForm() {
        return {
            start: this.byId('sleep-start').value,
            end: this.byId('sleep-end').value
        };
    }

    readScheduleForm() {
        return {
            bedtime: this.byId('ideal-bedtime').value,
            waketime: this.byId('ideal-waketime').value
        };
    }

    readNoSleepDate() {
        return this.byId('no-sleep-date').value;
    }

    readSearchDate() {
        return this.byId('search-date').value;
    }

    clearSearchDate() {
        this.byId('search-date').value = '';
    }

    renderStats(summary, hasSchedule) {
        if (summary.days === 0) {
            this.byId('total-days').textContent = '0';
            this.byId('avg-duration').textContent = '0';
            this.byId('match-count').textContent = '0';
            this.byId('avg-deviation').textContent = '0';
        } else {
            this.byId('total-days').textContent = summary.days;
            this.byId('avg-duration').textContent = summary.avgDuration === null
                ? '0'
                : this.formatDuration(summary.avgDuration);
            this.byId('match-count').textContent = summary.matchCount;
            this.byId('avg-deviation').textContent = summary.avgDeviation === null
                ? '0'
                : this.formatDuration(summary.avgDeviation);
        }
        if (hasSchedule) {
            this.showClosest('match-count');
            this.showClosest('avg-deviation');
        } else {
            this.hideClosest('match-count');
            this.hideClosest('avg-deviation');
        }
    }

    renderCalendar(calendarResult, hasSchedule) {
        const grid = this.byId('calendar-grid');
        grid.replaceChildren();
        if (calendarResult.days.length === 0) {
            grid.append(this.el('div', 'empty', this.t('calendar.noData')));
            this.byId('stat-ideal').textContent = '0';
            this.byId('stat-good').textContent = '0';
            this.byId('stat-warning').textContent = '0';
            this.byId('stat-bad').textContent = '0';
            this.byId('stat-no-sleep').textContent = '0';
            this.byId('stat-miss').textContent = '0';
        } else {
            const cells = calendarResult.days.map((day) => {
                const className = day.cls === 'miss' ? 'calendar-day' : `calendar-day ${day.cls}`;
                const div = this.el('div', className);
                div.title = this.titleText(day.titleData);
                return div;
            });
            grid.replaceChildren(...cells);
            this.byId('stat-ideal').textContent = calendarResult.counts.ideal;
            this.byId('stat-good').textContent = calendarResult.counts.good;
            this.byId('stat-warning').textContent = calendarResult.counts.warning;
            this.byId('stat-bad').textContent = calendarResult.counts.bad;
            this.byId('stat-no-sleep').textContent = calendarResult.counts.noSleep;
            this.byId('stat-miss').textContent = calendarResult.counts.miss;
        }
        if (hasSchedule) {
            this.showClosest('stat-ideal');
        } else {
            this.hideClosest('stat-ideal');
        }
    }

    renderStreaks(streaks, hasSchedule) {
        this.byId('streak-ideal').textContent = streaks.ideal;
        this.byId('streak-good').textContent = streaks.good;
        this.byId('streak-warning').textContent = streaks.warning;
        this.byId('streak-bad').textContent = streaks.bad;
        this.byId('streak-records').textContent = streaks.records;
        this.byId('current-streak').textContent = streaks.current;
        this.byId('max-gap').textContent = streaks.maxGap;
        if (hasSchedule) {
            this.showClosest('streak-ideal');
        } else {
            this.hideClosest('streak-ideal');
        }
    }

    renderAnalysis(analysis, hasSchedule) {
        this.byId('avg-bedtime').textContent = analysis.avgBedtime === null ? '—' : analysis.avgBedtime;
        this.byId('avg-waketime').textContent = analysis.avgWaketime === null ? '—' : analysis.avgWaketime;
        if (analysis.consistencyLevel === null || !hasSchedule) {
            this.byId('consistency').textContent = '—';
        } else {
            const key = analysis.consistencyLevel === 'high'
                ? 'analysis.level.high'
                : (analysis.consistencyLevel === 'medium' ? 'analysis.level.medium' : 'analysis.level.low');
            this.byId('consistency').textContent = this.t(key);
        }
    }

    renderRecords(records) {
        if (records.isEmpty) {
            this.byId('longest-single-sleep').textContent = '0';
            this.byId('longest-sleep').textContent = '0';
            this.byId('total-hours').textContent = '0';
            this.byId('total-hours-percent').textContent = '';
            this.byId('longest-single-date').textContent = '';
            this.byId('longest-date').textContent = '';
            this.byId('max-wake').textContent = '0';
            this.byId('max-wake-date').textContent = '';
            this.byId('max-efficiency').textContent = '0';
            this.byId('max-efficiency-date').textContent = '';
            return;
        }
        this.byId('longest-single-sleep').textContent = this.formatDuration(records.longestSingleDuration);
        this.byId('longest-single-date').textContent = records.longestSingleDate
            ? `(${records.longestSingleDate})`
            : '';
        this.byId('longest-sleep').textContent = records.longestInterruptedDuration === null
            ? '0'
            : this.formatDuration(records.longestInterruptedDuration);
        this.byId('longest-date').textContent = records.longestInterruptedDate
            ? `(${records.longestInterruptedDate})`
            : '';
        this.byId('total-hours').textContent = this.formatDuration(records.totalHours);
        this.byId('total-hours-percent').textContent = records.totalHoursPercent === null
            ? ''
            : this.t('records.percentOfTime', { percent: records.totalHoursPercent });
        this.byId('max-wake').textContent = this.formatDuration(records.maxWakeHours);
        this.byId('max-wake-date').textContent = records.maxWakeDate
            ? `(${records.maxWakeDate})`
            : '';
        this.byId('max-efficiency').textContent = records.maxEfficiency
            ? (records.maxEfficiency * 100).toFixed(0)
            : '0';
        this.byId('max-efficiency-date').textContent = records.maxEfficiencyDate
            ? `(${records.maxEfficiencyDate})`
            : '';
    }

    renderWeekTable(weekDays, onDelete) {
        const tbody = this.byId('week-table-body');
        tbody.replaceChildren();
        if (weekDays.length === 0) {
            const row = this.doc.createElement('tr');
            const cell = this.el('td', 'empty', this.t('calendar.noData'));
            cell.setAttribute('colspan', '7');
            row.append(cell);
            tbody.append(row);
            return;
        }
        const rows = weekDays.map((day) => {
            const row = this.doc.createElement('tr');
            const dateCell = this.doc.createElement('td');
            dateCell.append(this.stats.formatDateRuFromDate(day.dateObj));
            const sessionInfo = this.doc.createElement('small');
            sessionInfo.className = 'week-cell-sub';
            const sessionLines = day.sessions.map((s) => {
                const dur = this.stats.calcDuration(s.start_time, s.end_time);
                return `${this.stats.formatTimeHM(s.start_time)}→${this.stats.formatTimeHM(s.end_time)} (${this.formatDuration(dur)})`;
            });
            const sessionTexts = sessionLines.map((line) => {
                const span = this.doc.createElement('span');
                span.textContent = line;
                return span;
            });
            this.appendWithBr(sessionInfo, sessionTexts);
            dateCell.append(this.doc.createElement('br'), sessionInfo);
            row.append(dateCell);

            const starts = day.sessions.map((s) => this.stats.formatTimeHM(s.start_time));
            const startCell = this.doc.createElement('td');
            this.appendWithBr(startCell, starts.map((text) => {
                const span = this.doc.createElement('span');
                span.textContent = text;
                return span;
            }));
            row.append(startCell);

            const ends = day.sessions.map((s) => this.stats.formatTimeHM(s.end_time));
            const endCell = this.doc.createElement('td');
            this.appendWithBr(endCell, ends.map((text) => {
                const span = this.doc.createElement('span');
                span.textContent = text;
                return span;
            }));
            row.append(endCell);

            const durCell = this.doc.createElement('td');
            const durStrong = this.doc.createElement('strong');
            durStrong.textContent = this.formatDuration(day.totalDuration);
            const durSub = this.doc.createElement('small');
            durSub.textContent = this.t('week.sessions', { count: day.sessions.length });
            durCell.append(durStrong, this.doc.createElement('br'), durSub);
            row.append(durCell);

            const matchCell = this.doc.createElement('td');
            matchCell.append(this.el('span', `match-badge ${day.matchClass}`, this.t(day.matchKey)));
            row.append(matchCell);

            const effCell = this.doc.createElement('td');
            effCell.append(this.el('span', `eff-badge ${day.badge.cls}`,
                day.badge.value === null ? '—' : this.t('efficiency.percent', { percent: day.badge.value })));
            row.append(effCell);

            const btnCell = this.doc.createElement('td');
            day.sessions.forEach((session) => {
                const btn = this.el('button', 'delete-sleep-btn delete-sleep-btn--stacked',
                    this.t('week.deleteSession', { time: this.stats.formatTimeHM(session.start_time) }));
                btn.addEventListener('click', () => onDelete(session.id));
                btnCell.append(btn);
            });
            row.append(btnCell);

            return row;
        });
        tbody.replaceChildren(...rows);
    }

    renderLogs(logs, efficiencyMap, schedule, onDelete) {
        const container = this.byId('logs-container');
        container.replaceChildren();
        if (logs.length === 0) {
            container.append(this.el('div', 'empty', this.t('logs.empty')));
            return;
        }
        const items = logs.map((log) => {
            const item = this.el('div', 'sleep-log-item');

            const left = this.doc.createElement('div');
            const strong = this.doc.createElement('strong');
            strong.textContent = this.stats.formatDateRu(log.start_time);
            left.append(strong, this.doc.createElement('br'));
            left.append(`${this.stats.formatTimeHM(log.start_time)} → ${this.stats.formatTimeHM(log.end_time)}`);
            left.append(this.doc.createElement('br'));
            const dur = this.stats.calcDuration(log.start_time, log.end_time);
            left.append(this.t('logs.durationLine', { duration: this.formatDuration(dur) }));

            const right = this.el('div', 'sleep-log-actions');
            const ideal = this.stats.isIdealSleep(log, schedule);
            if (ideal && schedule.bedtime) {
                right.append(this.el('span', 'match-badge perfect', this.t('logs.ideal')));
            }
            const key = this.stats.dateKeyFromISO(log.start_time);
            const eff = efficiencyMap.get(key) || null;
            const badge = this.stats.efficiencyBadge(eff);
            right.append(this.el('span', `eff-badge ${badge.cls}`,
                badge.value === null ? '—' : this.t('efficiency.percent', { percent: badge.value })));
            const delBtn = this.el('button', 'delete-sleep-btn', this.t('common.delete'));
            delBtn.addEventListener('click', () => onDelete(log.id));
            right.append(delBtn);

            item.append(left, right);
            return item;
        });
        container.replaceChildren(...items);
    }

    renderWeekdayStats(weekdayStats) {
        const container = this.byId('weekday-stats');
        const cards = weekdayStats.map((item) => {
            const card = this.el('div', 'weekday-card');
            card.append(this.el('div', 'weekday-name', this.t(item.labelKey)));
            const hours = this.el('div', 'weekday-hours');
            hours.append(`${item.avg.toFixed(1)} `);
            const unit = this.el('span', 'u', this.t('unit.hour'));
            hours.append(unit);
            card.append(hours);
            card.append(this.el('div', 'weekday-total', this.t('weekday.total', { hours: item.total.toFixed(1) })));
            return card;
        });
        container.replaceChildren(...cards);
    }
}