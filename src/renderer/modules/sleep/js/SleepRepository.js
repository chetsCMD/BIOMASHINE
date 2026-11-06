export class SleepRepository {
    constructor(bm) {
        this.bm = bm;
    }

    listLogs() {
        return this.bm.invoke('sleep:listLogs');
    }

    addLog({ start, end }) {
        return this.bm.invoke('sleep:addLog', { start_time: start, end_time: end });
    }

    removeLog(id) {
        return this.bm.invoke('sleep:removeLog', { id });
    }

    getSchedule() {
        return this.bm.invoke('sleep:getSchedule');
    }

    saveSchedule({ bedtime, waketime }) {
        return this.bm.invoke('sleep:saveSchedule', { ideal_bedtime: bedtime, ideal_waketime: waketime });
    }

    resetSchedule() {
        return this.bm.invoke('sleep:resetSchedule');
    }

    listNoSleep() {
        return this.bm.invoke('sleep:listNoSleep');
    }

    addNoSleep(date) {
        return this.bm.invoke('sleep:addNoSleep', { date });
    }

    removeNoSleep(date) {
        return this.bm.invoke('sleep:removeNoSleep', { date });
    }
}