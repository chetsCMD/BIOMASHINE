import { ModuleClock } from './ModuleClock.js';
import { NutritionCalculator } from './NutritionCalculator.js';
import { NutritionRepository } from './NutritionRepository.js';
import { NutritionCharts } from './NutritionCharts.js';
import { NutritionView } from './NutritionView.js';

export class NutritionModule {
    constructor(bm, doc, ChartClass) {
        this.bm = bm;
        this.doc = doc;
        this.ChartClass = ChartClass;
        this.clock = new ModuleClock(bm);
        this.state = {
            meals: [],
            currentWeekOffset: 0,
            selectedDayDate: null
        };
    }

    async start() {
        this.config = await this.bm.config('nutrition');
        this.calculator = new NutritionCalculator(this.config);
        this.repository = new NutritionRepository(this.bm);
        this.charts = new NutritionCharts({ ChartClass: this.ChartClass, config: this.config });
        this.view = new NutritionView(this.doc, this.config, this.charts, this.clock, (key, params) => this.bm.t(key, params));
        this.view.setHandlers({
            onDeleteMeal: (id) => this.deleteMeal(id),
            onSelectDay: (dateStr) => this.selectDay(dateStr),
            onChangeWeek: (delta) => this.changeWeek(delta),
            onGoToTodayWeek: () => this.goToTodayWeek(),
            onJumpToDate: (dateStr) => this.jumpToDate(dateStr)
        });
        this.bindEvents();
        this.bm.onTheme(() => this.render());
        await this.loadData();
        this.render();
    }

    bindEvents() {
        this.view.byId('add-food-btn').addEventListener('click', () => this.addFood());
        this.view.byId('add-food-form').addEventListener('keydown', (event) => {
            if (event.key !== 'Enter') {
                return;
            }
            const target = event.target;
            if (!target || target.tagName !== 'INPUT' || target.type === 'date') {
                return;
            }
            event.preventDefault();
            this.addFood();
        });
    }

    async loadData() {
        try {
            const records = await this.repository.list();
            this.state.meals = records.map((record) => this.mapMeal(record));
        } catch (error) {
            this.state.meals = [];
        }
        this.view.setTodayDate(this.clock.todayDisplay());
    }

    mapMeal(record) {
        return {
            id: record.id,
            date: this.clock.formatDisplay(record.date),
            name: record.name,
            weight: parseFloat(record.weight),
            calories: parseFloat(record.calories),
            protein: parseFloat(record.protein),
            fat: parseFloat(record.fat),
            carbs: parseFloat(record.carbs)
        };
    }

    render() {
        this.charts.destroyAll();
        this.view.renderAll(this.state, this.calculator);
        this.updatePills();
    }

    updatePills() {
        const uniqueDays = new Set(this.state.meals.map((meal) => meal.date)).size;
        this.bm.setPills([this.clock.todayDisplay(), this.bm.t('pill.days', { count: uniqueDays })]);
    }

    async addFood() {
        const form = this.view.readForm();
        if (!form.date || !form.name || !form.weight) {
            this.view.showStatus(this.bm.t('status.fillRequired'), 'error');
            return;
        }
        const portion = (!form.perPortion || form.perPortion <= 0) ? this.config.defaultPortion : form.perPortion;
        let nutrition;
        if (!Number.isNaN(form.calories) && !Number.isNaN(form.protein) && !Number.isNaN(form.fat) && !Number.isNaN(form.carbs)) {
            nutrition = this.calculator.calculateNutrition(form.weight, portion, form.calories, form.protein, form.fat, form.carbs);
        } else if (!Number.isNaN(form.calories)) {
            nutrition = {
                calories: Math.round(form.calories * (form.weight / portion) * 10) / 10,
                protein: 0,
                fat: 0,
                carbs: 0
            };
        } else {
            nutrition = { calories: 0, protein: 0, fat: 0, carbs: 0 };
        }
        const apiDate = this.clock.formatApi(form.date);
        try {
            const result = await this.repository.add({
                date: apiDate,
                name: form.name,
                weight: form.weight,
                calories: nutrition.calories,
                protein: nutrition.protein,
                fat: nutrition.fat,
                carbs: nutrition.carbs
            });
            this.state.meals.push({
                id: result.id,
                date: form.date,
                name: form.name,
                weight: form.weight,
                calories: nutrition.calories,
                protein: nutrition.protein,
                fat: nutrition.fat,
                carbs: nutrition.carbs
            });
            this.view.resetForm();
            if (this.state.selectedDayDate) {
                const selected = this.clock.parseDate(this.state.selectedDayDate);
                const today = this.clock.parseDate(this.clock.todayDisplay());
                if (selected.toDateString() !== today.toDateString()) {
                    this.state.selectedDayDate = null;
                }
            }
            this.render();
        } catch (error) {
            this.view.showStatus(this.bm.t(error.status ? 'status.addError' : 'status.connectionError'), 'error');
        }
    }

    async deleteMeal(mealId) {
        try {
            await this.repository.remove(mealId);
            this.state.meals = this.state.meals.filter((meal) => meal.id !== mealId);
            this.render();
        } catch (error) {
            this.view.showStatus(this.bm.t('status.connectionError'), 'error');
        }
    }

    selectDay(dateStr) {
        if (this.state.selectedDayDate === dateStr) {
            this.state.selectedDayDate = null;
        } else {
            this.state.selectedDayDate = dateStr;
        }
        this.render();
    }

    changeWeek(delta) {
        this.state.currentWeekOffset += delta;
        this.state.selectedDayDate = null;
        this.render();
    }

    goToTodayWeek() {
        this.state.currentWeekOffset = 0;
        this.state.selectedDayDate = null;
        this.render();
    }

    jumpToDate(dateStr) {
        if (!dateStr) {
            return;
        }
        this.state.currentWeekOffset = this.clock.weekOffsetForDate(dateStr);
        this.state.selectedDayDate = null;
        this.render();
    }
}