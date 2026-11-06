export class WeightView {
    constructor(doc, t) {
        this.doc = doc;
        this.t = t;
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

    renderHero(latest, user, calculator) {
        const hero = this.byId('hero');
        if (!latest || !user) {
            hero.replaceChildren(this.el('div', 'empty', this.t('empty.noData')));
            return;
        }

        const bmi = calculator.calcBMI(latest.weight, user.height);
        const bmiL = calculator.bmiLabel(bmi);
        const fatL = calculator.fatLabel(latest.fat, user.age);
        const watL = calculator.waterLabel(latest.water);

        const cards = [
            {
                labelKey: 'metric.weight',
                val: calculator.fmt(latest.weight),
                unitKey: 'unit.kg',
                badge: null,
                sub: this.t('hero.bmiSub', { bmi: calculator.fmt(bmi), label: this.t(bmiL.labelKey) }),
                active: true
            },
            {
                labelKey: 'metric.fatPercent',
                val: latest.fat ? calculator.fmt(latest.fat) : '—',
                unitKey: 'unit.percent',
                badge: latest.fat ? fatL : null,
                sub: this.t('hero.age', { age: user.age })
            },
            {
                labelKey: 'metric.waterPercent',
                val: latest.water ? calculator.fmt(latest.water) : '—',
                unitKey: 'unit.percent',
                badge: latest.water ? watL : null,
                sub: this.t('hero.waterNorm')
            },
            {
                labelKey: 'metric.bmi',
                val: calculator.fmt(bmi),
                unitKey: null,
                badge: bmiL,
                sub: this.t('hero.heightWeight', { height: user.height, weight: latest.weight })
            },
        ];

        hero.replaceChildren(...cards.map(c => {
            const card = this.el('div', 'hcard');
            const topBar = this.el('div', `hcard-top-bar${c.active ? ' active' : ''}`);

            const valDiv = this.el('div', 'hcard-val');
            valDiv.textContent = c.val;
            valDiv.append(this.el('span', 'unit', c.unitKey ? this.t(c.unitKey) : ''));

            let badgeDiv = null;
            if (c.badge) {
                badgeDiv = this.el('div');
                badgeDiv.append(this.el('span', `hcard-badge ${c.badge.q}`, this.t(c.badge.labelKey)));
            } else {
                badgeDiv = this.el('div');
                badgeDiv.style.height = '24px';
            }

            card.append(
                topBar,
                this.el('div', 'hcard-label', this.t(c.labelKey)),
                valDiv,
                badgeDiv,
                this.el('div', 'hcard-sub', c.sub)
            );
            return card;
        }));
    }

    createChangeTable(ch, calculator) {
        if (!ch) return this.el('div', 'empty', this.t('empty.notEnoughData'));

        const table = this.el('table', 'ctable');

        const createRow = (labelKey, valText, unitKey, isBold = false) => {
            const tr = this.el('tr');
            if (isBold) tr.style.borderTop = '1px solid var(--br2)';

            const td1 = this.el('td', '', this.t(labelKey));
            if (isBold) td1.style.paddingTop = '12px';

            const td2 = this.el('td');
            if (isBold) td2.style.paddingTop = '12px';

            const span = this.el('span', 'cdelta zer', valText);
            td2.append(span, this.el('span', '', ` ${this.t(unitKey)}`));
            td2.lastChild.style.color = 'var(--tdd)';

            tr.append(td1, td2);
            return tr;
        };

        const createDeltaRow = (labelKey, val, unitKey) => {
            const tr = this.el('tr');

            const td1 = this.el('td');
            td1.textContent = this.t(labelKey);
            if (ch.from && labelKey === 'metric.weight') {
                const br = this.el('br');
                const small = this.el('small', '', this.t('change.since', { date: calculator.formatDateToDisplay(ch.from) }));
                small.style.color = 'var(--tdd)';
                small.style.fontSize = '9px';
                td1.append(br, small);
            }

            const td2 = this.el('td');
            if (val === null || val === undefined) {
                td2.append(this.el('span', 'cdelta zer', '—'));
            } else {
                const n = parseFloat(val);
                const sign = n > 0 ? '+' : '';
                const cls = n === 0 ? 'zer' : (n < 0 ? 'neg' : 'pos');
                td2.append(this.el('span', `cdelta ${cls}`, `${sign}${val}`));
            }
            td2.append(this.el('span', '', ` ${this.t(unitKey)}`));
            td2.lastChild.style.color = 'var(--tdd)';

            tr.append(td1, td2);
            return tr;
        };

        table.append(
            createDeltaRow('metric.weight', ch.dWeight, 'unit.kg'),
            createDeltaRow('metric.fat', ch.dFat, 'unit.percent'),
            createDeltaRow('metric.water', ch.dWater, 'unit.percent'),
            createRow('metric.avgWeight', ch.avgWeight, 'unit.kg', true),
            createRow('metric.avgFat', ch.avgFat, 'unit.percent'),
            createRow('metric.avgWater', ch.avgWater, 'unit.percent')
        );

        return table;
    }

    renderPeriodTable(ch, calculator) {
        const container = this.byId('period-table');
        container.replaceChildren(this.createChangeTable(ch, calculator));
    }

    renderCustomResult(ch, calculator) {
        const container = this.byId('custom-result');
        const table = this.createChangeTable(ch, calculator);
        if (ch) {
            const dateInfo = this.el('div', '', `${calculator.formatDateToDisplay(ch.from)} — ${calculator.formatDateToDisplay(ch.to)}`);
            dateInfo.style.fontSize = '9px';
            dateInfo.style.color = 'var(--tdd)';
            dateInfo.style.marginTop = '8px';
            container.replaceChildren(table, dateInfo);
        } else {
            container.replaceChildren(table);
        }
    }

    renderGoals(goals, measurements, calculator, clock) {
        const container = this.byId('goals-content');
        if (!measurements.length) {
            container.replaceChildren(this.el('div', 'empty', this.t('empty.noData')));
            return;
        }
        const latest = measurements[measurements.length - 1];
        const nodes = [];

        if (goals.weight_goal) {
            const diff = (latest.weight - goals.weight_goal).toFixed(1);
            const sorted = [...measurements].sort((a, b) => new Date(a.date) - new Date(b.date));
            const start = sorted[0].weight;
            const total = Math.abs(start - goals.weight_goal);
            const done = Math.min(100, Math.max(0, total > 0 ? (1 - Math.abs(latest.weight - goals.weight_goal) / total) * 100 : 100));
            const sign = parseFloat(diff) > 0 ? '−' : '+';
            const absDiff = Math.abs(parseFloat(diff)).toFixed(1);
            const days = goals.deadline ? calculator.daysUntil(goals.deadline, clock) : null;

            const block = this.el('div', 'goal-block');
            const row1 = this.el('div', 'goal-row1');
            const deadlineText = goals.deadline
                ? (days > 0
                    ? this.t('goal.deadlineDays', { date: calculator.formatDateToDisplay(goals.deadline), days })
                    : this.t('goal.deadlineExpired', { date: calculator.formatDateToDisplay(goals.deadline) }))
                : this.t('goal.noDeadline');
            row1.append(
                this.el('span', 'goal-metric-l', this.t('metric.weight')),
                this.el('span', 'goal-deadline-l', deadlineText)
            );

            const nums = this.el('div', 'goal-nums');
            const curSpan = this.el('span', 'goal-cur', calculator.fmt(latest.weight));
            curSpan.append(this.el('span', 'u', ` ${this.t('unit.kg')}`));
            nums.append(
                curSpan,
                this.el('span', 'goal-arrow', '→'),
                this.el('span', 'goal-tgt', this.t('goal.valueKg', { value: calculator.fmt(goals.weight_goal) })),
                this.el('span', 'goal-diff-v', this.t('goal.diffWeight', { sign, diff: absDiff }))
            );

            const pbar = this.el('div', 'pbar');
            const fill = this.el('div', 'pbar-fill');
            fill.style.width = `${done.toFixed(0)}%`;
            pbar.append(fill);

            const pbarLabel = this.el('div', 'pbar-label');
            pbarLabel.append(
                this.el('span', '', this.t('goal.progress', { percent: done.toFixed(0) })),
                this.el('span', '', this.t('goal.targetWeight', { value: calculator.fmt(goals.weight_goal) }))
            );

            block.append(row1, nums, pbar, pbarLabel);
            nodes.push(block);
        }

        if (goals.fat_goal && latest.fat) {
            const diff = (latest.fat - goals.fat_goal).toFixed(1);
            const sorted = [...measurements].sort((a, b) => new Date(a.date) - new Date(b.date));
            const start = sorted[0].fat || sorted[0].fat;
            const total = Math.abs(start - goals.fat_goal);
            const done = Math.min(100, Math.max(0, total > 0 ? (1 - Math.abs(latest.fat - goals.fat_goal) / total) * 100 : 100));
            const sign = parseFloat(diff) > 0 ? '−' : '+';
            const absDiff = Math.abs(parseFloat(diff)).toFixed(1);

            const block = this.el('div', 'goal-block');
            const row1 = this.el('div', 'goal-row1');
            row1.append(
                this.el('span', 'goal-metric-l', this.t('metric.fatPercent')),
                this.el('span', 'goal-deadline-l', goals.deadline ? calculator.formatDateToDisplay(goals.deadline) : this.t('goal.noDeadline'))
            );

            const nums = this.el('div', 'goal-nums');
            const curSpan = this.el('span', 'goal-cur', calculator.fmt(latest.fat));
            curSpan.append(this.el('span', 'u', ` ${this.t('unit.percent')}`));
            nums.append(
                curSpan,
                this.el('span', 'goal-arrow', '→'),
                this.el('span', 'goal-tgt', this.t('goal.valuePercent', { value: calculator.fmt(goals.fat_goal) })),
                this.el('span', 'goal-diff-v', this.t('goal.diffFat', { sign, diff: absDiff }))
            );

            const pbar = this.el('div', 'pbar');
            const fill = this.el('div', 'pbar-fill');
            fill.style.width = `${done.toFixed(0)}%`;
            pbar.append(fill);

            const pbarLabel = this.el('div', 'pbar-label');
            pbarLabel.append(
                this.el('span', '', this.t('goal.progress', { percent: done.toFixed(0) })),
                this.el('span', '', this.t('goal.targetFat', { value: calculator.fmt(goals.fat_goal) }))
            );

            block.append(row1, nums, pbar, pbarLabel);
            nodes.push(block);
        }

        if (nodes.length === 0) {
            nodes.push(this.el('div', 'empty', this.t('goals.none')));
        }

        container.replaceChildren(...nodes);
    }

    renderIdeal(user, measurements, calculator) {
        this.byId('height-label').textContent = user.height || '—';
        const container = this.byId('ideal-table');

        if (!user || !user.height) {
            container.replaceChildren(this.el('div', 'empty', this.t('ideal.noHeight')));
            return;
        }

        const iw = calculator.idealWeights(user.height);
        const cur = measurements.length ? measurements[measurements.length - 1].weight : null;

        const rows = iw.map(f => {
            const tr = this.el('tr');

            const td1 = this.el('td');
            td1.append(
                this.el('div', 'f-name', this.t(f.nameKey)),
                this.el('div', 'f-desc', this.t(f.descKey))
            );

            const td2 = this.el('td');
            const valDiv = this.el('div', 'f-val');
            valDiv.textContent = calculator.fmt(f.val);
            valDiv.append(this.el('span', 'u', ` ${this.t('unit.kg')}`));
            td2.append(valDiv);

            if (cur != null) {
                const d = (cur - f.val).toFixed(1);
                const pf = parseFloat(d) >= 0 ? '+' : '';
                td2.append(this.el('span', 'f-diff', this.t('ideal.current', { diff: `${pf}${d}` })));
            }

            tr.append(td1, td2);
            return tr;
        });

        container.replaceChildren(...rows);
    }

    renderRecords(measurements, calculator) {
        const container = this.byId('records-grid');
        if (!measurements.length) {
            container.replaceChildren(this.el('div', 'empty', this.t('empty.noData')));
            return;
        }

        const metrics = [
            { key: 'weight', labelKey: 'metric.weight', unitKey: 'unit.kg' },
            { key: 'fat', labelKey: 'metric.fatPercent', unitKey: 'unit.percent' },
            { key: 'water', labelKey: 'metric.waterPercent', unitKey: 'unit.percent' },
        ];

        container.replaceChildren(...metrics.map(m => {
            const validVals = measurements.filter(d => d[m.key] !== null && d[m.key] !== undefined).map(d => d[m.key]);

            const col = this.el('div', 'rec-col');
            col.append(this.el('div', 'rec-col-head', this.t(m.labelKey)));

            if (validVals.length === 0) {
                const row = this.el('div', 'rec-row');
                row.append(this.el('div', 'rec-type', this.t('empty.noData')));
                col.append(row);
                return col;
            }

            const mn = Math.min(...validVals);
            const mx = Math.max(...validVals);
            const minE = measurements.find(d => d[m.key] === mn);
            const maxE = measurements.find(d => d[m.key] === mx);

            const createRecordRow = (labelKey, val, entry) => {
                const row = this.el('div', 'rec-row');
                const valDiv = this.el('div', 'rec-val');
                valDiv.textContent = calculator.fmt(val);
                valDiv.append(this.el('span', 'u', ` ${this.t(m.unitKey)}`));
                row.append(
                    this.el('div', 'rec-type', this.t(labelKey)),
                    valDiv,
                    this.el('div', 'rec-date', entry ? calculator.formatDateToDisplay(entry.date) : '—')
                );
                return row;
            };

            col.append(
                createRecordRow('records.min', mn, minE),
                createRecordRow('records.max', mx, maxE)
            );
            return col;
        }));
    }

    openDeleteModal(measurements, calculator, onSelect) {
        const modal = this.byId('delete-modal');
        const tbody = this.byId('delete-table-body');

        const sorted = [...measurements].sort((a, b) => new Date(b.date) - new Date(a.date));

        const rows = sorted.map(m => {
            const tr = this.el('tr');
            tr.append(
                this.el('td', '', calculator.formatDateToDisplay(m.date)),
                this.el('td', '', calculator.fmt(m.weight)),
                this.el('td', '', m.fat ? calculator.fmt(m.fat) : '—'),
                this.el('td', '', m.water ? calculator.fmt(m.water) : '—')
            );

            const btnTd = this.el('td');
            const btn = this.el('button', 'delete-row-btn', this.t('common.delete'));
            btn.addEventListener('click', () => {
                onSelect(m.date);
            });
            btnTd.append(btn);
            tr.append(btnTd);
            return tr;
        });

        tbody.replaceChildren(...rows);
        modal.classList.add('active');
    }

    closeDeleteModal() {
        this.byId('delete-modal').classList.remove('active');
    }

    readForm() {
        return {
            date: this.byId('new-date').value,
            weight: this.byId('new-weight').value,
            fat: this.byId('new-fat').value,
            water: this.byId('new-water').value
        };
    }

    clearForm(calculator, clock) {
        this.byId('new-date').value = calculator.getTodayDateStr(clock);
        this.byId('new-weight').value = '';
        this.byId('new-fat').value = '';
        this.byId('new-water').value = '';
    }

    fillGoalForm(goals, calculator) {
        this.byId('goal-weight').value = goals.weight_goal || '';
        this.byId('goal-fat').value = goals.fat_goal || '';
        this.byId('goal-deadline').value = goals.deadline ? calculator.formatDateToDisplay(goals.deadline) : '';
    }

    readGoalForm(calculator) {
        const deadlineInput = this.byId('goal-deadline').value;
        const deadline = deadlineInput ? calculator.formatDateToAPI(deadlineInput) : null;

        return {
            weight_goal: this.byId('goal-weight').value ? parseFloat(this.byId('goal-weight').value) : null,
            fat_goal: this.byId('goal-fat').value ? parseFloat(this.byId('goal-fat').value) : null,
            deadline: deadline
        };
    }
}