export class ReactionView {
    constructor(doc, t) {
        this.doc = doc;
        this.t = t;
        this.box = doc.getElementById('reaction-box');
        this.mainText = doc.getElementById('main-text');
        this.subText = doc.getElementById('sub-text');
        this.result = doc.getElementById('current-result');
        this.stageValues = doc.getElementById('stage-values');
        this.average = doc.getElementById('average-result');
        this.saveStatus = doc.getElementById('save-status');
        this.stats = doc.getElementById('stats-grid');
        this.history = doc.getElementById('history-list');
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

    unitValue(value, className) {
        const fragment = this.doc.createDocumentFragment();
        fragment.append(`${value} `, this.el('span', className, this.t('unit.ms')));
        return fragment;
    }

    setBox({ state, text, sub }) {
        this.box.className = state ? `reaction-box ${state}` : 'reaction-box';
        this.mainText.textContent = this.t(text.key, text.params);
        this.subText.textContent = this.t(sub.key, sub.params);
    }

    hideResult() {
        this.result.style.display = 'none';
        this.saveStatus.style.display = 'none';
    }

    showResult(values, average) {
        this.result.style.display = 'block';
        this.stageValues.replaceChildren(
            ...values.map((value) => {
                const item = this.el('span', 'stage-value');
                item.append(this.unitValue(value, 'ms'));
                return item;
            })
        );
        this.average.replaceChildren(this.unitValue(average, 'ms'));
    }

    setSaveStatus(kind, text) {
        this.saveStatus.style.display = 'block';
        this.saveStatus.className = kind ? `save-status ${kind}` : 'save-status';
        this.saveStatus.textContent = text;
    }

    statCard(label, value, unit) {
        const card = this.el('div', 'stat-card');
        const content = this.el('div', 'stat-card-value');
        content.append(`${value}`);
        if (unit) {
            content.append(' ', this.el('span', 'stat-card-unit', unit));
        }
        card.append(this.el('div', 'stat-card-label', label), content);
        return card;
    }

    renderStats(count, summary) {
        const round = (value) => (summary ? Math.round(value) : '—');
        const unit = summary ? this.t('unit.ms') : '';
        this.stats.replaceChildren(
            this.statCard(this.t('stat.tests'), count),
            this.statCard(this.t('stat.best'), round(summary && summary.best), unit),
            this.statCard(this.t('stat.worst'), round(summary && summary.worst), unit),
            this.statCard(this.t('stat.mean'), round(summary && summary.mean), unit),
            this.statCard(this.t('stat.median'), round(summary && summary.median), unit),
            this.statCard(this.t('stat.deviation'), round(summary && summary.deviation), unit)
        );
    }

    renderHistory(tests, formatDate, onDelete) {
        if (tests.length === 0) {
            this.history.replaceChildren(this.el('div', 'empty', this.t('history.empty')));
            return;
        }
        this.history.replaceChildren(
            ...tests.map((test) => {
                const info = this.el('div', 'info');
                const average = this.el('span', 'avg');
                average.append(this.unitValue(Math.round(test.average), 'ms'));
                info.append(
                    this.el('span', 'date', formatDate(test.date)),
                    this.el('span', 'values', test.values.map((value) => `${value} ${this.t('unit.ms')}`).join(', ')),
                    average
                );
                const remove = this.el('button', 'delete-btn', this.t('common.delete'));
                remove.addEventListener('click', () => onDelete(test.id));
                const item = this.el('div', 'history-item');
                item.append(info, remove);
                return item;
            })
        );
    }
}
