export class TrainingCalculator {
    constructor(t, locale) {
        this.t = t;
        this.locale = locale;
    }

    formatDate(value) {
        if (!value) {
            return '';
        }
        const parts = String(value).split('T')[0].split('-').map(Number);
        if (parts.length !== 3 || parts.some(Number.isNaN)) {
            return String(value);
        }
        return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString(this.locale, {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    formatTime(value) {
        if (!value) {
            return '';
        }
        return String(value).substring(0, 5);
    }

    dateKey(date) {
        const d = new Date(date);
        const pad = (value) => String(value).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }

    monthGrid(year, month) {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
        const daysInMonth = lastDay.getDate();
        const days = [];
        for (let day = 1; day <= daysInMonth; day++) {
            days.push({ day, dateStr: this.dateKey(new Date(year, month, day)) });
        }
        return { startDay, days };
    }

    monthLabel(year, month) {
        return new Date(year, month, 1).toLocaleString(this.locale, { month: 'long', year: 'numeric' });
    }

    dayRepsForExercise(workouts, exerciseName, dateStr) {
        let totalReps = 0;
        for (const workout of workouts) {
            if (workout.date !== dateStr) {
                continue;
            }
            for (const exercise of workout.exercises || []) {
                if (exercise.exercise_name === exerciseName) {
                    totalReps += exercise.reps || 0;
                }
            }
        }
        return totalReps;
    }

    parseExercises(rows) {
        const exercises = [];
        for (const row of rows) {
            const name = (row.name || '').trim();
            const sets = parseInt(row.sets, 10);
            const reps = parseInt(row.reps, 10);
            const weight = parseFloat(row.weight);
            const note = (row.note || '').trim();
            if (name && sets > 0 && reps > 0) {
                exercises.push({
                    exercise_name: name,
                    sets,
                    reps,
                    weight: Number.isNaN(weight) ? null : weight,
                    note: note || null
                });
            }
        }
        return exercises;
    }

    workoutMinutes(workout) {
        if (!workout.start_time || !workout.end_time) {
            return 0;
        }
        const start = String(workout.start_time).split(':');
        const end = String(workout.end_time).split(':');
        const startMin = parseInt(start[0], 10) * 60 + parseInt(start[1], 10);
        const endMin = parseInt(end[0], 10) * 60 + parseInt(end[1], 10);
        const diff = (endMin - startMin) / 60;
        return diff > 0 ? diff : 0;
    }

    exerciseText(exercises) {
        return (exercises || [])
            .map((exercise) => {
                const unit = this.t('unit.kg');
                const weight = exercise.weight ? ` ${exercise.weight}${unit}` : '';
                return `${exercise.exercise_name} (${exercise.sets}×${exercise.reps}${weight})`;
            })
            .join(', ');
    }

    typeLabel(type) {
        return type === 'home' ? this.t('type.home') : this.t('type.gym');
    }

    timeRange(workout) {
        if (!workout.start_time || !workout.end_time) {
            return '';
        }
        return `${this.formatTime(workout.start_time)}-${this.formatTime(workout.end_time)}`;
    }

    filterHistory(workouts, { type, period, from, to }, todayStr) {
        let filtered = [...workouts];
        if (type !== 'all') {
            filtered = filtered.filter((workout) => workout.type === type);
        }
        if (period === 'week') {
            const start = new Date(`${todayStr}T00:00:00`);
            start.setDate(start.getDate() - 7);
            const startStr = this.dateKey(start);
            filtered = filtered.filter((workout) => workout.date >= startStr);
        } else if (period === 'month') {
            const start = new Date(`${todayStr}T00:00:00`);
            start.setMonth(start.getMonth() - 1);
            const startStr = this.dateKey(start);
            filtered = filtered.filter((workout) => workout.date >= startStr);
        }
        if (from) {
            filtered = filtered.filter((workout) => workout.date >= from);
        }
        if (to) {
            filtered = filtered.filter((workout) => workout.date <= to);
        }
        return filtered;
    }
}