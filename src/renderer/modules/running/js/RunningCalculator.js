export class RunningCalculator {
    formatTimeToString(totalSeconds) {
        const seconds = Number(totalSeconds) || 0;
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const rest = seconds % 60;
        if (hours > 0) {
            return { key: 'time.hm', params: { hours, minutes } };
        }
        return { key: 'time.ms', params: { minutes, seconds: rest } };
    }

    parseTimeToSeconds(timeStr) {
        if (!timeStr) return 0;
        const parts = String(timeStr).split(':');
        if (parts.length === 2) {
            return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
        }
        if (parts.length === 3) {
            return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
        }
        return 0;
    }

    totals(runs) {
        const list = Array.isArray(runs) ? runs : [];
        let totalTime = 0;
        let totalDistance = 0;
        let totalCalories = 0;
        let maxTime = 0;
        let maxDistance = 0;
        let totalStartSpeed = 0;
        let totalMaxSpeed = 0;
        let totalIncline = 0;
        let startSpeedCount = 0;
        let maxSpeedCount = 0;
        let inclineCount = 0;
        let maxMaxSpeed = 0;
        let maxIncline = 0;

        for (const run of list) {
            totalTime += run.time_seconds;
            totalDistance += run.distance;
            if (run.calories) totalCalories += run.calories;
            if (run.time_seconds > maxTime) maxTime = run.time_seconds;
            if (run.distance > maxDistance) maxDistance = run.distance;
            if (run.start_speed !== null && run.start_speed !== undefined) {
                totalStartSpeed += run.start_speed;
                startSpeedCount++;
            }
            if (run.max_speed !== null && run.max_speed !== undefined) {
                totalMaxSpeed += run.max_speed;
                maxSpeedCount++;
                if (run.max_speed > maxMaxSpeed) maxMaxSpeed = run.max_speed;
            }
            if (run.incline !== null && run.incline !== undefined) {
                totalIncline += run.incline;
                inclineCount++;
                if (run.incline > maxIncline) maxIncline = run.incline;
            }
        }

        const runsWithCalories = list.filter((r) => r.calories).length;
        const avgCalories = list.length > 0 && totalCalories > 0 ? totalCalories / runsWithCalories : 0;
        const avgStartSpeed = startSpeedCount > 0 ? totalStartSpeed / startSpeedCount : 0;
        const avgMaxSpeed = maxSpeedCount > 0 ? totalMaxSpeed / maxSpeedCount : 0;
        const avgIncline = inclineCount > 0 ? totalIncline / inclineCount : 0;
        const avgDistance = list.length > 0 ? totalDistance / list.length : 0;

        return {
            totalTime,
            totalDistance,
            totalCalories,
            maxTime,
            maxDistance,
            avgCalories,
            avgStartSpeed,
            avgMaxSpeed,
            avgIncline,
            avgDistance,
            maxMaxSpeed,
            maxIncline,
            count: list.length
        };
    }

    goalProgress(goal, runs, today, field) {
        const list = Array.isArray(runs) ? runs : [];
        if (!goal || !goal.target || !goal.deadline) {
            return { current: 0, progress: 0 };
        }
        const inPeriod = list.filter((r) => r.date >= today && r.date <= goal.deadline);
        const total = inPeriod.reduce((sum, r) => {
            if (field === 'calories') return sum + (r.calories || 0);
            return sum + r[field];
        }, 0);
        const progress = Math.min(100, (total / goal.target) * 100);
        return { current: total, progress };
    }

    totalDistance(runs) {
        const list = Array.isArray(runs) ? runs : [];
        return list.reduce((sum, r) => sum + r.distance, 0);
    }

    achievements(list, totalDistance) {
        const source = Array.isArray(list) ? list : [];
        const keys = {
            marathon: { nameKey: 'achievement.marathon.name', descriptionKey: 'achievement.marathon.description' },
            saratov_moscow: { nameKey: 'achievement.saratov_moscow.name', descriptionKey: 'achievement.saratov_moscow.description' }
        };
        return source.map((ach) => {
            const entry = keys[ach.id] || { nameKey: null, descriptionKey: null };
            return {
                id: ach.id,
                nameKey: entry.nameKey,
                descriptionKey: entry.descriptionKey,
                required: ach.required,
                progress: totalDistance,
                unlocked: totalDistance >= ach.required
            };
        });
    }

    weekTotals(runs, days) {
        const list = Array.isArray(runs) ? runs : [];
        const week = Array.isArray(days) ? days : [];
        return week.map((day) => {
            const dayRuns = list.filter((r) => r.date === day.dateStr);
            return {
                dateStr: day.dateStr,
                dayNumber: day.dayNumber,
                distance: dayRuns.reduce((sum, r) => sum + r.distance, 0),
                timeSeconds: dayRuns.reduce((sum, r) => sum + r.time_seconds, 0),
                hasData: dayRuns.length > 0
            };
        });
    }

    sortedByDateDesc(runs) {
        return [...(Array.isArray(runs) ? runs : [])].sort((a, b) => b.date.localeCompare(a.date));
    }

    sortedByDateAsc(runs) {
        return [...(Array.isArray(runs) ? runs : [])].sort((a, b) => a.date.localeCompare(b.date));
    }
}