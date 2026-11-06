export class SleepStats {
    constructor(config, locale) {
        this.config = config;
        this.locale = locale;
    }

    durationThresholds() {
        return this.config.durationThresholds;
    }

    idealThresholds() {
        return this.config.idealWindow;
    }

    idealMinDuration() {
        return this.config.idealMinDuration;
    }

    efficiencyThresholds() {
        return this.config.efficiency;
    }

    consistencyThresholds() {
        return this.config.consistency;
    }

    toDateKey(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    dateKeyFromISO(iso) {
        return this.toDateKey(new Date(iso));
    }

    parseDateKey(key) {
        const parts = key.split('-');
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }

    calcDuration(startISO, endISO) {
        return (new Date(endISO) - new Date(startISO)) / (1000 * 60 * 60);
    }

    durationParts(hours) {
        let hrs = Math.floor(hours);
        let mins = Math.round((hours - hrs) * 60);
        if (mins === 60) {
            hrs++;
            mins = 0;
        }
        return { hours: hrs, minutes: mins };
    }

    formatTimeHM(iso) {
        return new Date(iso).toLocaleTimeString(this.locale, { hour: '2-digit', minute: '2-digit' });
    }

    formatTimeHMFromDate(date) {
        return date.toLocaleTimeString(this.locale, { hour: '2-digit', minute: '2-digit' });
    }

    formatDateRu(iso) {
        return new Date(iso).toLocaleDateString(this.locale);
    }

    formatDateRuFromDate(date) {
        return date.toLocaleDateString(this.locale);
    }

    parseTimeToMinutes(value) {
        const parts = String(value).split(':');
        return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }

    isIdealSleep(log, schedule) {
        if (!schedule.bedtime || !schedule.waketime) {
            return false;
        }
        const start = new Date(log.start_time);
        const end = new Date(log.end_time);
        const startMin = start.getHours() * 60 + start.getMinutes();
        const endMin = end.getHours() * 60 + end.getMinutes();
        const idealBed = this.parseTimeToMinutes(schedule.bedtime);
        const idealWake = this.parseTimeToMinutes(schedule.waketime);
        const thresholds = this.idealThresholds();
        let bedDiff = Math.abs(startMin - idealBed);
        if (bedDiff > thresholds.wrapThreshold) {
            bedDiff = thresholds.wrapMinutes - bedDiff;
        }
        let wakeDiff = Math.abs(endMin - idealWake);
        if (wakeDiff > thresholds.wrapThreshold) {
            wakeDiff = thresholds.wrapMinutes - wakeDiff;
        }
        return bedDiff <= thresholds.bedMinutes && wakeDiff <= thresholds.wakeMinutes;
    }

    colorClassForDuration(duration) {
        const thresholds = this.durationThresholds();
        if (duration >= thresholds.good) {
            return 'good';
        }
        if (duration >= thresholds.warning) {
            return 'warning';
        }
        return 'bad';
    }

    buildDayMap(logs, noSleepDays) {
        const map = new Map();
        for (const log of logs) {
            const key = this.dateKeyFromISO(log.start_time);
            const duration = this.calcDuration(log.start_time, log.end_time);
            if (!map.has(key)) {
                map.set(key, { totalDuration: 0, sessions: [] });
            }
            const dayData = map.get(key);
            dayData.totalDuration += duration;
            dayData.sessions.push(log);
        }
        for (const day of noSleepDays) {
            if (!map.has(day)) {
                map.set(day, { totalDuration: 0, sessions: [] });
            } else {
                const dayData = map.get(day);
                dayData.totalDuration = 0;
                dayData.sessions = [];
            }
        }
        return map;
    }

    dayClassAndTitle(key, dayMap, noSleepDays, schedule) {
        const dayData = dayMap.get(key);
        if (!dayData) {
            return { cls: 'miss', titleType: 'miss', date: key };
        }
        if (noSleepDays.includes(key)) {
            return { cls: 'no-sleep', titleType: 'noSleep', date: key };
        }
        const totalDuration = dayData.totalDuration;
        let isIdeal = false;
        for (const session of dayData.sessions) {
            if (this.isIdealSleep(session, schedule)) {
                isIdeal = true;
                break;
            }
        }
        const idealDay = isIdeal && totalDuration >= this.idealMinDuration();
        const cls = idealDay ? 'ideal' : this.colorClassForDuration(totalDuration);
        return {
            cls,
            titleType: idealDay ? 'ideal' : 'total',
            date: key,
            totalDuration,
            sessions: dayData.sessions
        };
    }

    uniqueDayCount(logs, noSleepDays) {
        const allKeys = new Set();
        for (const log of logs) {
            allKeys.add(this.dateKeyFromISO(log.start_time));
        }
        for (const day of noSleepDays) {
            allKeys.add(day);
        }
        return allKeys.size;
    }

    summary(dayMap, schedule) {
        const days = dayMap.size;
        if (days === 0) {
            return { days: 0, avgDuration: null, matchCount: 0, avgDeviation: null };
        }
        let totalDur = 0;
        let match = 0;
        let totalDev = 0;
        let countWithSleep = 0;
        for (const [, data] of dayMap) {
            if (data.totalDuration > 0) {
                totalDur += data.totalDuration;
                countWithSleep++;
            }
            let hasIdeal = false;
            for (const session of data.sessions) {
                if (this.isIdealSleep(session, schedule)) {
                    hasIdeal = true;
                    break;
                }
            }
            if (hasIdeal && data.totalDuration >= this.idealMinDuration()) {
                match++;
            }
            if (schedule.bedtime && schedule.waketime) {
                const idealBed = this.parseTimeToMinutes(schedule.bedtime);
                const idealWake = this.parseTimeToMinutes(schedule.waketime);
                const idealMin = (idealWake - idealBed + 1440) % 1440;
                const idealHours = idealMin / 60;
                totalDev += Math.abs(data.totalDuration - idealHours);
            }
        }
        return {
            days,
            avgDuration: countWithSleep > 0 ? totalDur / countWithSleep : null,
            matchCount: match,
            avgDeviation: schedule.bedtime && schedule.waketime && days > 0 ? totalDev / days : 0
        };
    }

    calendar(dayMap, noSleepDays, schedule, today) {
        if (dayMap.size === 0) {
            return {
                days: [],
                counts: { ideal: 0, good: 0, warning: 0, bad: 0, noSleep: 0, miss: 0 }
            };
        }
        const end = new Date(today);
        end.setHours(0, 0, 0, 0);
        let firstDate = null;
        for (const key of dayMap.keys()) {
            const d = this.parseDateKey(key);
            if (!firstDate || d < firstDate) {
                firstDate = d;
            }
        }
        const startLimit = new Date(end);
        startLimit.setDate(end.getDate() - this.config.calendarHorizonDays);
        const start = new Date(firstDate > startLimit ? firstDate : startLimit);
        const days = [];
        const cursor = new Date(start);
        while (cursor <= end) {
            days.push(new Date(cursor));
            cursor.setDate(cursor.getDate() + 1);
        }
        const counts = { ideal: 0, good: 0, warning: 0, bad: 0, noSleep: 0, miss: 0 };
        const items = days.map((d) => {
            const key = this.toDateKey(d);
            const info = this.dayClassAndTitle(key, dayMap, noSleepDays, schedule);
            if (info.cls === 'ideal') {
                counts.ideal++;
            } else if (info.cls === 'good') {
                counts.good++;
            } else if (info.cls === 'warning') {
                counts.warning++;
            } else if (info.cls === 'bad') {
                counts.bad++;
            } else if (info.cls === 'no-sleep') {
                counts.noSleep++;
            } else {
                counts.miss++;
            }
            return { key, cls: info.cls, titleData: info };
        });
        return { days: items, counts };
    }

    streaks(dayMap, noSleepDays, schedule) {
        const allKeys = Array.from(dayMap.keys()).sort();
        if (allKeys.length === 0) {
            return { ideal: 0, good: 0, warning: 0, bad: 0, records: 0, current: 0, maxGap: 0 };
        }
        const firstDate = this.parseDateKey(allKeys[0]);
        const lastDate = this.parseDateKey(allKeys[allKeys.length - 1]);
        const allDates = [];
        const cursor = new Date(firstDate);
        while (cursor <= lastDate) {
            allDates.push(this.toDateKey(cursor));
            cursor.setDate(cursor.getDate() + 1);
        }
        let maxIdeal = 0;
        let curIdeal = 0;
        let maxGood = 0;
        let curGood = 0;
        let maxWarn = 0;
        let curWarn = 0;
        let maxBad = 0;
        let curBad = 0;
        let maxRecordStreak = 0;
        let curRecordStreak = 0;
        let maxGap = 0;
        let curGap = 0;
        for (const key of allDates) {
            const { cls } = this.dayClassAndTitle(key, dayMap, noSleepDays, schedule);
            const hasData = cls !== 'miss';
            if (hasData) {
                curGap = 0;
                curRecordStreak++;
                if (curRecordStreak > maxRecordStreak) {
                    maxRecordStreak = curRecordStreak;
                }
            } else {
                curGap++;
                if (curGap > maxGap) {
                    maxGap = curGap;
                }
                curRecordStreak = 0;
            }
            if (cls === 'ideal') {
                curIdeal++;
                curGood = 0;
                curWarn = 0;
                curBad = 0;
            } else if (cls === 'good') {
                curGood++;
                curIdeal = 0;
                curWarn = 0;
                curBad = 0;
            } else if (cls === 'warning') {
                curWarn++;
                curIdeal = 0;
                curGood = 0;
                curBad = 0;
            } else if (cls === 'bad' || cls === 'no-sleep') {
                curBad++;
                curIdeal = 0;
                curGood = 0;
                curWarn = 0;
            } else {
                curIdeal = 0;
                curGood = 0;
                curWarn = 0;
                curBad = 0;
            }
            if (curIdeal > maxIdeal) {
                maxIdeal = curIdeal;
            }
            if (curGood > maxGood) {
                maxGood = curGood;
            }
            if (curWarn > maxWarn) {
                maxWarn = curWarn;
            }
            if (curBad > maxBad) {
                maxBad = curBad;
            }
        }
        return {
            ideal: maxIdeal,
            good: maxGood,
            warning: maxWarn,
            bad: maxBad,
            records: maxRecordStreak,
            current: curRecordStreak,
            maxGap
        };
    }

    analysis(logs) {
        if (logs.length === 0) {
            return { avgBedtime: null, avgWaketime: null, consistencyLevel: null };
        }
        let totalBed = 0;
        let totalWake = 0;
        const beds = [];
        const wakes = [];
        for (const log of logs) {
            const s = new Date(log.start_time);
            const e = new Date(log.end_time);
            const bm = s.getHours() * 60 + s.getMinutes();
            const wm = e.getHours() * 60 + e.getMinutes();
            totalBed += bm;
            totalWake += wm;
            beds.push(bm);
            wakes.push(wm);
        }
        const avgBed = totalBed / logs.length;
        const avgWake = totalWake / logs.length;
        const bh = Math.floor(avgBed / 60);
        const bMin = Math.round(avgBed % 60);
        const wh = Math.floor(avgWake / 60);
        const wMin = Math.round(avgWake % 60);
        let bedVar = 0;
        let wakeVar = 0;
        for (const b of beds) {
            bedVar += Math.pow(b - avgBed, 2);
        }
        for (const w of wakes) {
            wakeVar += Math.pow(w - avgWake, 2);
        }
        bedVar = Math.sqrt(bedVar / logs.length);
        wakeVar = Math.sqrt(wakeVar / logs.length);
        const thresholds = this.consistencyThresholds();
        const score = 100 - Math.min(100, ((bedVar + wakeVar) / thresholds.maxDeviationMinutes) * 100);
        const level = score > thresholds.highThreshold
            ? 'high'
            : (score > thresholds.mediumThreshold ? 'medium' : 'low');
        return {
            avgBedtime: `${String(bh).padStart(2, '0')}:${String(bMin).padStart(2, '0')}`,
            avgWaketime: `${String(wh).padStart(2, '0')}:${String(wMin).padStart(2, '0')}`,
            consistencyLevel: level
        };
    }

    efficiencyMap(dayMap) {
        const sortedDays = Array.from(dayMap.keys()).sort();
        const result = new Map();
        for (let i = 0; i < sortedDays.length; i++) {
            const key = sortedDays[i];
            const dayData = dayMap.get(key);
            if (dayData.sessions.length === 0) {
                result.set(key, null);
                continue;
            }
            const firstStart = new Date(Math.min(...dayData.sessions.map((s) => new Date(s.start_time))));
            let prevDayKey = null;
            for (let j = i - 1; j >= 0; j--) {
                const prevKey = sortedDays[j];
                const prevData = dayMap.get(prevKey);
                if (prevData.sessions.length > 0) {
                    prevDayKey = prevKey;
                    break;
                }
            }
            if (prevDayKey === null) {
                result.set(key, null);
                continue;
            }
            const prevData = dayMap.get(prevDayKey);
            const prevEnd = new Date(Math.max(...prevData.sessions.map((s) => new Date(s.end_time))));
            const diffMinutes = (firstStart - prevEnd) / (1000 * 60);
            if (diffMinutes <= 0 || diffMinutes < this.efficiencyThresholds().gapMinutes) {
                result.set(key, null);
                continue;
            }
            const totalMinutes = dayData.totalDuration * 60;
            result.set(key, totalMinutes / diffMinutes);
        }
        return result;
    }

    efficiencyBadge(ratio) {
        if (ratio === null || ratio === undefined) {
            return { cls: 'none', value: null };
        }
        const thresholds = this.efficiencyThresholds();
        if (ratio >= thresholds.goodRatio) {
            return { cls: 'good', value: Math.round(ratio * 100) };
        }
        if (ratio >= thresholds.warningRatio) {
            return { cls: 'warning', value: Math.round(ratio * 100) };
        }
        return { cls: 'bad', value: Math.round(ratio * 100) };
    }

    records(logs, noSleepDays, dayMap, efficiencyData) {
        if (logs.length === 0 && noSleepDays.length === 0) {
            return {
                isEmpty: true,
                longestSingleDuration: 0,
                longestSingleDate: '',
                longestInterruptedDuration: null,
                longestInterruptedDate: '',
                totalHours: 0,
                totalHoursPercent: null,
                maxWakeHours: 0,
                maxWakeDate: '',
                maxEfficiency: 0,
                maxEfficiencyDate: ''
            };
        }
        let maxSingleDuration = 0;
        let maxSingleDate = '';
        for (const log of logs) {
            const dur = this.calcDuration(log.start_time, log.end_time);
            if (dur > maxSingleDuration) {
                maxSingleDuration = dur;
                maxSingleDate = this.dateKeyFromISO(log.start_time);
            }
        }
        const dailyDurations = [];
        for (const [key, data] of dayMap) {
            if (data.sessions.length > 0) {
                dailyDurations.push({ key, duration: data.totalDuration });
            }
        }
        let longestInterruptedDuration = null;
        let longestInterruptedDate = '';
        if (dailyDurations.length > 0) {
            let maxEntry = dailyDurations[0];
            for (const entry of dailyDurations) {
                if (entry.duration >= maxEntry.duration) {
                    maxEntry = entry;
                }
            }
            longestInterruptedDuration = maxEntry.duration;
            longestInterruptedDate = maxEntry.key;
        }
        const total = dailyDurations.reduce((sum, e) => sum + e.duration, 0);
        const allDates = Array.from(dayMap.keys()).sort();
        let totalHoursPercent = null;
        if (allDates.length > 0) {
            const firstDate = this.parseDateKey(allDates[0]);
            const lastDate = this.parseDateKey(allDates[allDates.length - 1]);
            const diffDays = (lastDate - firstDate) / (1000 * 60 * 60 * 24) + 1;
            const totalHoursObserv = diffDays * 24;
            const percent = totalHoursObserv > 0 ? (total / totalHoursObserv) * 100 : 0;
            totalHoursPercent = percent.toFixed(2);
        }
        const allSessions = logs.slice().sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
        let maxWakeHours = 0;
        let maxWakeDate = '';
        for (let i = 1; i < allSessions.length; i++) {
            const prevEnd = new Date(allSessions[i - 1].end_time);
            const currStart = new Date(allSessions[i].start_time);
            const diff = (currStart - prevEnd) / (1000 * 60 * 60);
            if (diff > maxWakeHours) {
                maxWakeHours = diff;
                maxWakeDate = this.dateKeyFromISO(allSessions[i].start_time);
            }
        }
        let maxEff = 0;
        let maxEffDate = '';
        for (const [key, eff] of efficiencyData) {
            if (eff !== null && eff > maxEff) {
                maxEff = eff;
                maxEffDate = key;
            }
        }
        return {
            isEmpty: false,
            longestSingleDuration: maxSingleDuration,
            longestSingleDate: maxSingleDate,
            longestInterruptedDuration,
            longestInterruptedDate,
            totalHours: total,
            totalHoursPercent,
            maxWakeHours,
            maxWakeDate,
            maxEfficiency: maxEff,
            maxEfficiencyDate: maxEffDate
        };
    }

    weekDays(logs, schedule, efficiencyData) {
        const sorted = logs.slice().sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
        const uniqueDays = new Map();
        for (const log of sorted) {
            const key = this.dateKeyFromISO(log.start_time);
            if (!uniqueDays.has(key)) {
                uniqueDays.set(key, []);
            }
            uniqueDays.get(key).push(log);
        }
        const sortedDays = Array.from(uniqueDays.keys()).sort((a, b) => new Date(b) - new Date(a));
        const weekDays = sortedDays.slice(0, this.config.weekTableDays);
        return weekDays.map((key) => {
            const sessions = uniqueDays.get(key);
            const totalDuration = sessions.reduce((sum, s) => sum + this.calcDuration(s.start_time, s.end_time), 0);
            const hasIdeal = sessions.some((s) => this.isIdealSleep(s, schedule));
            const isMatch = hasIdeal && totalDuration >= this.idealMinDuration();
            const matchClass = isMatch ? (schedule.bedtime ? 'perfect' : 'good') : 'bad';
            let matchKey;
            if (isMatch) {
                matchKey = schedule.bedtime ? 'week.match.ideal' : 'week.match.norm';
            } else {
                matchKey = schedule.bedtime ? 'week.match.deviation' : 'week.match.none';
            }
            const eff = efficiencyData.get(key) || null;
            const badge = this.efficiencyBadge(eff);
            return {
                key,
                dateObj: this.parseDateKey(key),
                sessions,
                totalDuration,
                matchClass,
                matchKey,
                efficiency: eff,
                badge
            };
        });
    }

    weekdayStats(dayMap) {
        const buckets = this.config.weekdays.map(() => ({ durations: [], total: 0 }));
        for (const [key, data] of dayMap) {
            const date = this.parseDateKey(key);
            const dow = date.getDay();
            if (data.totalDuration > 0) {
                buckets[dow].durations.push(data.totalDuration);
            }
            buckets[dow].total += data.totalDuration;
        }
        return buckets.map((bucket, index) => {
            const list = bucket.durations;
            const avg = list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0;
            return { labelKey: this.config.weekdays[index].labelKey, avg, total: bucket.total };
        });
    }

    donutData(counts) {
        const labelKeys = this.config.chart.labels.map((label) => label.labelKey);
        const colors = this.config.chart.colors;
        const original = [counts.ideal, counts.good, counts.warning, counts.bad, counts.noSleep];
        const backgroundColor = [colors.ideal, colors.good, colors.warning, colors.bad, colors.noSleep];
        const total = original.reduce((a, b) => a + b, 0);
        const data = total === 0 ? [1, 0, 0, 0, 0] : original;
        return { labelKeys, data, backgroundColor, cutout: this.config.chart.cutout };
    }

    filterByDate(logs, dateKey) {
        if (!dateKey) {
            return logs;
        }
        return logs.filter((log) => this.dateKeyFromISO(log.start_time) === dateKey);
    }

    logsSortedByStart(logs) {
        return logs.slice().sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
    }
}