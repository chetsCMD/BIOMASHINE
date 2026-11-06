export class KbjuView {
    static FLAG_PL = 'flag-pl';

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
        node.className = className;
        if (text !== undefined) {
            node.textContent = text;
        }
        return node;
    }

    fillParams(user) {
        const show = (value) => (value === null || value === undefined ? '' : value);
        this.byId('user-height').value = show(user.height);
        this.byId('user-age').value = show(user.age);
        this.byId('user-trainings').value = show(user.trainings_count);
    }

    readParams() {
        return {
            height: parseInt(this.byId('user-height').value, 10),
            age: parseInt(this.byId('user-age').value, 10),
            trainings: parseInt(this.byId('user-trainings').value, 10)
        };
    }

    showStatus(kind, text, hideAfterMs) {
        const box = this.byId('param-status');
        box.style.display = 'block';
        box.className = `param-status ${kind}`;
        box.textContent = text;
        clearTimeout(this.statusTimer);
        this.statusTimer = setTimeout(() => {
            box.style.display = 'none';
        }, hideAfterMs);
    }

    icon(name) {
        const holder = this.el('div', 'nutrient-icon');
        if (name !== KbjuView.FLAG_PL) {
            holder.textContent = name;
            return holder;
        }
        const ns = 'http://www.w3.org/2000/svg';
        const svg = this.doc.createElementNS(ns, 'svg');
        svg.setAttribute('class', 'flag-pl');
        svg.setAttribute('viewBox', '0 0 8 5');
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', this.t('flag.pl'));
        const white = this.doc.createElementNS(ns, 'rect');
        white.setAttribute('width', '8');
        white.setAttribute('height', '2.5');
        white.setAttribute('fill', '#ffffff');
        const red = this.doc.createElementNS(ns, 'rect');
        red.setAttribute('y', '2.5');
        red.setAttribute('width', '8');
        red.setAttribute('height', '2.5');
        red.setAttribute('fill', '#dc143c');
        svg.append(white, red);
        holder.append(svg);
        return holder;
    }

    showMissing(lacking) {
        const box = this.byId('kbju-missing');
        box.className = lacking.length > 0 ? 'kbju-missing visible' : 'kbju-missing';
        box.textContent = lacking.length > 0 ? this.t('missing.message', { list: lacking.map((key) => this.t(key)).join(', ') }) : '';
    }

    renderNutrients(nutrients) {
        this.byId('nutrient-grid').replaceChildren(
            ...nutrients.map((nutrient, index) => {
                const card = this.el('div', 'nutrient-card');
                card.style.animationDelay = `${0.05 + index * 0.07}s`;
                card.append(
                    this.icon(nutrient.icon),
                    this.el('div', 'nutrient-name', this.t(nutrient.titleKey)),
                    this.el('div', 'nutrient-range', this.t('nutrient.range', { min: nutrient.min, max: nutrient.max })),
                    this.el('div', 'nutrient-norm', this.t('nutrient.norm', nutrient.norm)),
                    this.el('div', 'nutrient-avg', this.t('nutrient.average', { value: nutrient.average }))
                );
                return card;
            })
        );
    }

    renderResult(result) {
        this.byId('bmr-value').textContent = result.bmr;
        this.byId('activity-text').textContent = this.t('activity.line', { count: result.activity.trainings, level: this.t(result.activity.titleKey) });
        this.byId('calories-loss').textContent = result.calories.loss;
        this.byId('calories-maintain').textContent = result.calories.maintain;
        this.byId('calories-gain').textContent = result.calories.gain;
        this.renderNutrients(result.nutrients);
    }
}
