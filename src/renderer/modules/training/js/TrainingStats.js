export class TrainingStats {
    constructor(calculator, t) {
        this.calculator = calculator;
        this.t = t;
    }

    weekRange(todayStr) {
        const today = new Date(`${todayStr}T00:00:00`);
        const start = new Date(today);
        start.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        return { startStr: this.calculator.dateKey(start), endStr: this.calculator.dateKey(end) };
    }

    weekStats(workouts, weeklyTarget, todayStr) {
        const { startStr, endStr } = this.weekRange(todayStr);
        const weekWorkouts = workouts.filter((workout) => workout.date >= startStr && workout.date <= endStr);
        const count = weekWorkouts.length;
        let totalTime = 0;
        for (const workout of weekWorkouts) {
            totalTime += this.calculator.workoutMinutes(workout);
        }
        const avgTime = count > 0 ? totalTime / count : 0;
        const target = weeklyTarget || 0;
        const progress = target > 0 ? Math.min(100, (count / target) * 100) : 0;
        return {
            count,
            totalTime: totalTime.toFixed(1),
            avgTime: avgTime.toFixed(1),
            progress,
            progressLabel: target > 0 ? `${Math.round(progress)}%` : '—',
            goalText: target > 0 ? `${count} / ${target}` : this.t('week.goalNotSet'),
            goalBarWidth: progress
        };
    }

    calendarIndicator(goals, workouts, dateStr) {
        const exerciseGoals = goals.exercise_goals || [];
        if (exerciseGoals.length === 0) {
            return 'none';
        }
        let allDone = true;
        let anyDone = false;
        for (const goal of exerciseGoals) {
            const done = this.calculator.dayRepsForExercise(workouts, goal.exercise_name, dateStr);
            const target = goal.target_reps || 0;
            if (done >= target) {
                anyDone = true;
            } else {
                allDone = false;
            }
        }
        if (allDone && anyDone) {
            return 'done';
        }
        if (anyDone) {
            return 'partial';
        }
        return 'fail';
    }

    goalStatus(doneReps, targetReps) {
        if (doneReps >= targetReps) {
            return { text: this.t('goal.done'), statusClass: 'done', barClass: 'done', progress: 100 };
        }
        if (doneReps > 0) {
            const progress = targetReps > 0 ? Math.min(100, (doneReps / targetReps) * 100) : 0;
            return {
                text: this.t('goal.partial', { percent: Math.round(progress) }),
                statusClass: 'partial',
                barClass: 'partial',
                progress
            };
        }
        return { text: this.t('goal.notStarted'), statusClass: 'zero', barClass: 'low', progress: 0 };
    }

    dayGoalStatus(doneReps, targetReps) {
        const remaining = Math.max(0, targetReps - doneReps);
        if (doneReps >= targetReps) {
            return { text: this.t('goal.done'), statusClass: 'done', remaining };
        }
        if (doneReps > 0) {
            return { text: this.t('goal.remaining', { remaining }), statusClass: 'partial', remaining };
        }
        return { text: this.t('goal.notStarted'), statusClass: 'fail', remaining };
    }

    progressSeries(workouts, exerciseName, period) {
        const data = [];
        for (const workout of workouts) {
            for (const exercise of workout.exercises || []) {
                if (exercise.exercise_name === exerciseName) {
                    data.push({
                        date: workout.date,
                        weight: exercise.weight || 0,
                        reps: exercise.reps || 0,
                        sets: exercise.sets
                    });
                }
            }
        }
        data.sort((a, b) => a.date.localeCompare(b.date));
        if (period !== 'all') {
            const limit = parseInt(period, 10);
            if (!Number.isNaN(limit)) {
                return data.slice(-limit);
            }
        }
        return data;
    }

    progressSummary(data) {
        const first = data[0];
        const last = data[data.length - 1];
        const weightChange = last.weight - first.weight;
        const repsChange = last.reps - first.reps;
        return { total: data.length, first, last, weightChange, repsChange };
    }

    allExercises(workouts) {
        const names = new Set();
        for (const workout of workouts) {
            for (const exercise of workout.exercises || []) {
                names.add(exercise.exercise_name);
            }
        }
        return names;
    }
}