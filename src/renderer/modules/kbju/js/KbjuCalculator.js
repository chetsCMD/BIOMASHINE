export class KbjuCalculator {
    constructor(config) {
        this.config = config;
    }

    activityFor(trainings) {
        return this.config.activityLevels.find((level) => level.maxTrainings === null || trainings <= level.maxTrainings);
    }

    bmr(weight, height, age) {
        const factors = this.config.bmr;
        return Math.ceil(factors.weight * weight + factors.height * height - factors.age * age + factors.constant);
    }

    calories(bmr, level) {
        const { loss, maintain, gain } = level.multipliers;
        return { loss: Math.ceil(bmr * loss), maintain: Math.ceil(bmr * maintain), gain: Math.ceil(bmr * gain) };
    }

    nutrients(weight, thermicEffect) {
        return Object.entries(this.config.nutrients).map(([key, nutrient]) => {
            const factor = thermicEffect ? nutrient.thermicFactor : 1;
            const min = weight * nutrient.perKgMin * factor;
            const max = weight * nutrient.perKgMax * factor;
            return {
                key,
                titleKey: nutrient.titleKey,
                icon: nutrient.icon,
                min: Math.ceil(min),
                max: Math.ceil(max),
                average: Math.round((min + max) / 2),
                norm: { min: nutrient.perKgMin, max: nutrient.perKgMax }
            };
        });
    }

    missing({ weight, height, age, trainings }) {
        const absent = (value) => value === null || value === undefined || value === '' || Number.isNaN(value);
        const lacking = [];
        if (!weight) {
            lacking.push('missing.weight');
        }
        if (!height) {
            lacking.push('missing.height');
        }
        if (!age) {
            lacking.push('missing.age');
        }
        if (absent(trainings)) {
            lacking.push('missing.trainings');
        }
        return lacking;
    }

    calculate({ weight, height, age, trainings, thermicEffect }) {
        if (!weight || !height || !age || trainings === null || trainings === undefined) {
            return null;
        }
        const bmr = this.bmr(weight, height, age);
        const level = this.activityFor(trainings);
        return {
            bmr,
            activity: { trainings, titleKey: level.titleKey },
            calories: this.calories(bmr, level),
            nutrients: this.nutrients(weight, thermicEffect)
        };
    }
}
