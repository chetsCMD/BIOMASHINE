export class NutritionView {
    constructor(doc, config, charts, clock, t) {
        this.doc = doc;
        this.config = config;
        this.charts = charts;
        this.clock = clock;
        this.t = t;
        this.handlers = {};
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

    setHandlers(handlers) {
        this.handlers = handlers;
    }

    setTodayDate(displayDate) {
        this.byId('food-date').value = displayDate;
    }

    readForm() {
        return {
            date: this.byId('food-date').value,
            name: this.byId('food-name').value,
            weight: parseFloat(this.byId('food-weight').value),
            calories: parseFloat(this.byId('food-calories').value),
            protein: parseFloat(this.byId('food-protein').value),
            fat: parseFloat(this.byId('food-fat').value),
            carbs: parseFloat(this.byId('food-carbs').value),
            perPortion: parseFloat(this.byId('food-per-portion').value)
        };
    }

    resetForm() {
        this.byId('food-date').value = this.clock.todayDisplay();
        this.byId('food-name').value = '';
        this.byId('food-weight').value = '';
        this.byId('food-calories').value = '';
        this.byId('food-protein').value = '';
        this.byId('food-fat').value = '';
        this.byId('food-carbs').value = '';
        this.byId('food-per-portion').value = '100';
    }

    showStatus(text, kind) {
        const box = this.byId('food-status');
        box.className = `food-status ${kind}`;
        box.textContent = text;
        clearTimeout(this.statusTimer);
        this.statusTimer = setTimeout(() => {
            box.className = 'food-status';
            box.textContent = '';
        }, this.config.statusHideMs);
    }

    getMealsForDate(meals, dateStr) {
        return meals.filter((meal) => meal.date === dateStr);
    }

    renderAll(state, calculator) {
        this.renderToday(state, calculator);
        this.renderStats(state, calculator);
        this.renderHistory(state, calculator);
    }

    renderToday(state, calculator) {
        const todayStr = this.clock.todayDisplay();
        this.byId('today-date-header').textContent = todayStr;

        const todayMeals = this.getMealsForDate(state.meals, todayStr);
        const stats = calculator.getTotalStats(todayMeals);

        const mealsList = this.byId('today-meals-list');
        mealsList.replaceChildren();
        if (todayMeals.length === 0) {
            mealsList.append(this.el('div', 'empty', this.t('today.empty')));
        } else {
            todayMeals.forEach((meal) => mealsList.append(this.buildMealItem(meal)));
        }

        this.byId('today-calories').textContent = String(stats.calories);
        this.byId('today-count').textContent = String(stats.count);
        this.byId('today-protein').textContent = String(stats.protein);
        this.byId('today-fat').textContent = String(stats.fat);
        this.byId('today-carbs').textContent = String(stats.carbs);
        this.byId('today-center').textContent = String(stats.calories);
        this.byId('today-legend-protein').textContent = String(stats.protein);
        this.byId('today-legend-fat').textContent = String(stats.fat);
        this.byId('today-legend-carbs').textContent = String(stats.carbs);

        this.charts.render('today', this.byId('today-chart'), stats.protein, stats.fat, stats.carbs);
    }

    renderStats(state, calculator) {
        const allStats = calculator.getAllTimeStats(state.meals);
        this.byId('stats-days').textContent = String(allStats.daysCount);
        this.byId('stats-entries').textContent = String(allStats.totalEntries);
        this.byId('stats-calories').textContent = String(allStats.totalCalories);
        const weight = calculator.formatWeight(allStats.totalWeight);
        let weightUnit;
        if (weight.unitKey === 'unit.g') {
            weightUnit = this.t('unit.g');
        } else if (weight.unitKey === 'unit.kg') {
            weightUnit = this.t('unit.kg');
        } else {
            weightUnit = this.t('unit.t');
        }
        this.byId('stats-weight').textContent = `${weight.value} ${weightUnit}`;
        this.byId('stats-protein').textContent = String(allStats.totalProtein);
        this.byId('stats-fat').textContent = String(allStats.totalFat);
        this.byId('stats-carbs').textContent = String(allStats.totalCarbs);
        this.byId('stats-average').textContent = String(calculator.averageCalories(allStats));
        this.byId('stats-center').textContent = String(Math.round(allStats.totalCalories));

        this.charts.render('stats', this.byId('stats-chart'), allStats.totalProtein, allStats.totalFat, allStats.totalCarbs);
    }

    renderHistory(state, calculator) {
        const panel = this.byId('history-panel');
        panel.replaceChildren();

        panel.append(this.el('div', 'panel-title', this.t('history.title')));

        const { monday, sunday } = this.clock.getWeekRange(state.currentWeekOffset);
        panel.append(this.buildWeekNav(this.clock.formatDateObject(monday), this.clock.formatDateObject(sunday)));

        const weekDays = this.clock.getWeekDays(monday);
        const todayStr = this.clock.todayDisplay();
        const weekGrid = this.el('div', 'week-grid');

        weekDays.forEach((day) => {
            const dayMeals = this.getMealsForDate(state.meals, day.dateStr);
            const dayStats = calculator.getTotalStats(dayMeals);
            const hasData = dayMeals.length > 0;
            const isToday = day.dateStr === todayStr;
            const isSelected = day.dateStr === state.selectedDayDate;
            weekGrid.append(this.buildWeekDay(day, dayStats, isToday, isSelected, hasData));
        });
        panel.append(weekGrid);

        const contentDiv = this.el('div');
        panel.append(contentDiv);
        if (state.selectedDayDate) {
            this.renderSelectedDay(contentDiv, state.selectedDayDate, state.meals, calculator);
        } else {
            contentDiv.append(this.el('div', 'empty history-hint', this.t('history.selectDay')));
        }
    }

    buildWeekNav(monStr, sunStr) {
        const nav = this.el('div', 'week-navigation');

        const prevBtn = this.el('button', 'week-nav-btn', '←');
        prevBtn.addEventListener('click', () => this.handlers.onChangeWeek(-1));

        const nextBtn = this.el('button', 'week-nav-btn', '→');
        nextBtn.addEventListener('click', () => this.handlers.onChangeWeek(1));

        const todayBtn = this.el('button', 'week-today-btn', this.t('history.today'));
        todayBtn.addEventListener('click', () => this.handlers.onGoToTodayWeek());

        const picker = this.doc.createElement('input');
        picker.type = 'date';
        picker.className = 'date-picker-input';
        picker.title = this.t('history.jumpToDate');
        picker.addEventListener('change', () => this.handlers.onJumpToDate(picker.value));

        nav.append(
            prevBtn,
            this.el('span', 'week-label', `${monStr} — ${sunStr}`),
            nextBtn,
            todayBtn,
            picker
        );
        return nav;
    }

    buildWeekDay(day, dayStats, isToday, isSelected, hasData) {
        const wrapper = this.el('div');
        wrapper.append(this.el('div', 'week-day-header', day.dayName));

        const classes = ['week-day'];
        if (isToday) {
            classes.push('today');
        }
        if (isSelected) {
            classes.push('selected');
        }
        if (hasData && !isToday && !isSelected) {
            classes.push('has-data');
        }

        const cell = this.el('div', classes.join(' '));
        cell.append(this.el('div', 'week-day-number', String(day.dayNumber)));
        if (hasData) {
            cell.append(this.el('div', 'week-day-calories', this.t('week.calories', { calories: dayStats.calories })));
        } else {
            cell.append(this.el('div', 'week-day-no-data', this.t('week.noData')));
        }
        cell.addEventListener('click', () => this.handlers.onSelectDay(day.dateStr));

        wrapper.append(cell);
        return wrapper;
    }

    buildMealItem(meal) {
        const item = this.el('div', 'meal-item');
        item.append(
            this.el('div', 'meal-name', meal.name),
            this.el('div', 'meal-detail', this.t('meal.weight', { weight: meal.weight })),
            this.el('div', 'meal-detail', this.t('meal.macros', { protein: meal.protein, fat: meal.fat, carbs: meal.carbs })),
            this.el('div', 'meal-calories', this.t('meal.calories', { calories: meal.calories }))
        );
        const deleteBtn = this.el('button', 'meal-delete', '✕');
        deleteBtn.addEventListener('click', () => this.handlers.onDeleteMeal(meal.id));
        item.append(deleteBtn);
        return item;
    }

    renderSelectedDay(container, dateStr, meals, calculator) {
        const selectedMeals = this.getMealsForDate(meals, dateStr);
        const stats = calculator.getTotalStats(selectedMeals);

        const wrapper = this.el('div', 'selected-day-wrapper');
        const block = this.el('div', 'today-block selected-day-block');

        const mealsCard = this.el('div', 'panel-card panel-card-compact');
        mealsCard.append(this.el('div', 'panel-title', this.t('today.meals')));
        const mealsList = this.el('div');
        if (selectedMeals.length === 0) {
            mealsList.append(this.el('div', 'empty', this.t('selected.empty')));
        } else {
            selectedMeals.forEach((meal) => mealsList.append(this.buildMealItem(meal)));
        }
        mealsCard.append(mealsList);

        const statsCard = this.el('div', 'panel-card panel-card-compact');
        const header = this.el('div', 'panel-header');
        header.append(
            this.el('div', 'panel-header-title', this.t('selected.macrosTitle')),
            this.el('div', 'panel-header-date', dateStr)
        );
        statsCard.append(header);
        const statsContainer = this.el('div');
        statsCard.append(statsContainer);

        block.append(mealsCard, statsCard);
        wrapper.append(block);
        container.append(wrapper);

        this.renderSelectedStatsBlock(statsContainer, stats);
    }

    renderSelectedStatsBlock(container, stats) {
        container.replaceChildren();

        const layout = this.el('div', 'today-stats-layout');

        const macrosCol = this.el('div');
        const macrosGrid = this.el('div', 'today-macros');
        macrosGrid.append(
            this.macroItem(this.t('macro.calories'), stats.calories, this.t('unit.kcal')),
            this.macroItem(this.t('today.countLabel'), stats.count, this.t('unit.pcs')),
            this.macroItem(this.t('macro.protein'), stats.protein, this.t('unit.g')),
            this.macroItem(this.t('macro.fat'), stats.fat, this.t('unit.g')),
            this.macroItem(this.t('macro.carbs'), stats.carbs, this.t('unit.g'))
        );
        macrosCol.append(macrosGrid);

        const chartCol = this.el('div');
        const wrap = this.el('div', 'chart-donut-wrap');

        const donutContainer = this.el('div', 'chart-donut-container');
        const canvas = this.doc.createElement('canvas');
        donutContainer.append(canvas);
        const center = this.el('div', 'chart-donut-center');
        center.append(
            this.el('div', 'chart-donut-calories', String(stats.calories)),
            this.el('div', 'chart-donut-label', this.t('unit.kcal'))
        );
        donutContainer.append(center);

        const legend = this.el('div', 'chart-legend');
        legend.append(
            this.legendItem('protein', this.t('selected.legendProtein', { value: stats.protein })),
            this.legendItem('fat', this.t('selected.legendFat', { value: stats.fat })),
            this.legendItem('carbs', this.t('selected.legendCarbs', { value: stats.carbs }))
        );

        wrap.append(donutContainer, legend);
        chartCol.append(wrap);

        layout.append(macrosCol, chartCol);
        container.append(layout);

        this.charts.render('selected', canvas, stats.protein, stats.fat, stats.carbs);
    }

    macroItem(label, value, unit) {
        const item = this.el('div', 'today-macro-item');
        item.append(this.el('div', 'today-macro-label', label));
        const valueEl = this.el('div', 'today-macro-value', String(value));
        valueEl.append(this.el('span', 'today-macro-unit', ` ${unit}`));
        item.append(valueEl);
        return item;
    }

    legendItem(type, text) {
        const item = this.el('div', 'chart-legend-item');
        item.append(this.el('div', `chart-legend-dot ${type}`));
        item.append(this.el('span', null, text));
        return item;
    }
}