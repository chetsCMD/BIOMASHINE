export class NutritionCalculator {
    constructor(config) {
        this.config = config;
    }

    calculateNutrition(weight, perPortion, calories, protein, fat, carbs) {
        const portion = (!perPortion || perPortion <= 0) ? this.config.defaultPortion : perPortion;
        const multiplier = weight / portion;
        return {
            calories: Math.round(calories * multiplier * 10) / 10,
            protein: Math.round(protein * multiplier * 10) / 10,
            fat: Math.round(fat * multiplier * 10) / 10,
            carbs: Math.round(carbs * multiplier * 10) / 10
        };
    }

    getTotalStats(mealList) {
        let totalCalories = 0;
        let totalProtein = 0;
        let totalFat = 0;
        let totalCarbs = 0;
        let totalWeight = 0;
        mealList.forEach((meal) => {
            totalCalories += meal.calories;
            totalProtein += meal.protein;
            totalFat += meal.fat;
            totalCarbs += meal.carbs;
            totalWeight += meal.weight;
        });
        return {
            calories: Math.round(totalCalories * 10) / 10,
            protein: Math.round(totalProtein * 10) / 10,
            fat: Math.round(totalFat * 10) / 10,
            carbs: Math.round(totalCarbs * 10) / 10,
            weight: Math.round(totalWeight * 10) / 10,
            count: mealList.length
        };
    }

    getAllTimeStats(meals) {
        const allDates = new Set();
        let totalCalories = 0;
        let totalProtein = 0;
        let totalFat = 0;
        let totalCarbs = 0;
        let totalWeight = 0;
        meals.forEach((meal) => {
            allDates.add(meal.date);
            totalCalories += meal.calories;
            totalProtein += meal.protein;
            totalFat += meal.fat;
            totalCarbs += meal.carbs;
            totalWeight += meal.weight;
        });
        return {
            daysCount: allDates.size,
            totalCalories: Math.round(totalCalories * 10) / 10,
            totalProtein: Math.round(totalProtein * 10) / 10,
            totalFat: Math.round(totalFat * 10) / 10,
            totalCarbs: Math.round(totalCarbs * 10) / 10,
            totalWeight: Math.round(totalWeight * 10) / 10,
            totalEntries: meals.length
        };
    }

    averageCalories(allStats) {
        return allStats.daysCount > 0 ? Math.round(allStats.totalCalories / allStats.daysCount) : 0;
    }

    formatWeight(grams) {
        if (grams < 1000) {
            return { value: grams.toFixed(1), unitKey: 'unit.g' };
        }
        if (grams < 1000000) {
            return { value: (grams / 1000).toFixed(2), unitKey: 'unit.kg' };
        }
        return { value: (grams / 1000000).toFixed(2), unitKey: 'unit.t' };
    }
}