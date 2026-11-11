const AppError = require('../core/AppError');

class NotificationService {
    static DISABLED_KEY = 'notifications.disabled';

    constructor({ repository, clock, settings, registry, system }) {
        this.repository = repository;
        this.clock = clock;
        this.settings = settings;
        this.registry = registry;
        this.system = system;
        this.timer = null;
    }

    disabledSet() {
        const stored = this.settings.get(NotificationService.DISABLED_KEY);
        return new Set(Array.isArray(stored) ? stored : []);
    }

    isEnabled(module) {
        return !this.disabledSet().has(module);
    }

    hasPermission(module) {
        const entry = this.registry.get(module);
        return Boolean(entry && entry.kind === 'page' && (entry.permissions || []).includes('notifications'));
    }

    start() {
        this.stop();
        this.processDue(true);
        this.reschedule();
    }

    stop() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    wallNow() {
        return NotificationService.parseWall(this.clock.timestamp());
    }

    static parseWall(timestamp) {
        const [datePart, timePart = '00:00:00'] = String(timestamp).split(' ');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hour, minute, second] = timePart.split(':').map(Number);
        return Date.UTC(year, month - 1, day, hour, minute, second || 0);
    }

    static formatWall(ms) {
        const date = new Date(ms);
        const pad = (value) => String(value).padStart(2, '0');
        return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
    }

    nextDaily(fromMs, time) {
        const [hour, minute] = time.split(':').map(Number);
        const from = new Date(fromMs);
        let candidate = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), hour, minute, 0);
        if (candidate <= fromMs) {
            candidate += 24 * 60 * 60 * 1000;
        }
        return candidate;
    }

    nextWeekdays(fromMs, time, weekdays) {
        const [hour, minute] = time.split(':').map(Number);
        const days = new Set(weekdays);
        for (let offset = 0; offset <= 7; offset += 1) {
            const dayMs = fromMs + offset * 24 * 60 * 60 * 1000;
            const day = new Date(dayMs);
            if (!days.has(day.getUTCDay())) {
                continue;
            }
            const candidate = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour, minute, 0);
            if (candidate > fromMs) {
                return candidate;
            }
        }
        return fromMs + 7 * 24 * 60 * 60 * 1000;
    }

    computeNext(row, fromMs) {
        if (row.kind === 'once') {
            return null;
        }
        if (row.repeat_type === 'daily') {
            return this.nextDaily(fromMs, row.repeat_time);
        }
        return this.nextWeekdays(fromMs, row.repeat_time, JSON.parse(row.repeat_weekdays || '[]'));
    }

    moduleTitle(moduleId) {
        const module = this.registry.get(moduleId);
        return module ? module.title : moduleId;
    }

    processDue(grouped) {
        const nowMs = this.wallNow();
        const due = this.repository.dueAt(NotificationService.formatWall(nowMs));
        if (due.length === 0) {
            return;
        }
        const disabled = this.disabledSet();
        const groups = new Map();
        for (const row of due) {
            const enabled = !disabled.has(row.module);
            if (enabled) {
                if (grouped) {
                    if (!groups.has(row.module)) {
                        groups.set(row.module, []);
                    }
                    groups.get(row.module).push(row);
                } else {
                    this.system.showNotification({ title: row.title, body: row.body || '' });
                }
            }
            if (row.kind === 'once') {
                this.repository.removeById(row.id);
            } else {
                const fromMs = Math.max(nowMs, NotificationService.parseWall(row.next_at));
                const nextMs = this.computeNext(row, fromMs);
                this.repository.updateNextAt(row.id, NotificationService.formatWall(nextMs));
            }
        }
        if (grouped) {
            for (const [module, rows] of groups) {
                this.system.showNotification({
                    title: this.moduleTitle(module),
                    body: rows.map((row) => (row.body ? `${row.title}: ${row.body}` : row.title)).join('\n')
                });
            }
        }
    }

    reschedule() {
        this.stop();
        const disabled = this.disabledSet();
        const rows = this.repository.listAll().filter((row) => !disabled.has(row.module));
        if (rows.length === 0) {
            return;
        }
        let nextMs = Infinity;
        for (const row of rows) {
            const ms = NotificationService.parseWall(row.next_at);
            if (ms < nextMs) {
                nextMs = ms;
            }
        }
        if (!Number.isFinite(nextMs)) {
            return;
        }
        const delay = Math.max(0, nextMs - this.wallNow());
        this.timer = setTimeout(() => {
            this.timer = null;
            this.processDue(false);
            this.reschedule();
        }, delay);
        if (typeof this.timer.unref === 'function') {
            this.timer.unref();
        }
    }

    tick() {
        this.processDue(false);
        this.reschedule();
    }

    schedule({ module, title, body, at, repeat }) {
        const nowMs = this.wallNow();
        if (at) {
            const atMs = NotificationService.parseWall(at);
            const id = this.repository.insert({
                module,
                title,
                body: body || null,
                kind: 'once',
                at: NotificationService.formatWall(atMs),
                nextAt: NotificationService.formatWall(atMs)
            });
            this.reschedule();
            return { id };
        }
        const nextMs = repeat.type === 'daily'
            ? this.nextDaily(nowMs, repeat.time)
            : this.nextWeekdays(nowMs, repeat.time, repeat.weekdays);
        const id = this.repository.insert({
            module,
            title,
            body: body || null,
            kind: 'repeat',
            repeatType: repeat.type,
            repeatTime: repeat.time,
            repeatWeekdays: repeat.type === 'weekdays' ? repeat.weekdays : null,
            nextAt: NotificationService.formatWall(nextMs)
        });
        this.reschedule();
        return { id };
    }

    cancel(module, id) {
        const rows = this.repository.listForModule(module);
        if (!rows.some((row) => row.id === Number(id))) {
            throw AppError.notFound('notification.notFound', { id });
        }
        this.repository.removeById(Number(id));
        this.reschedule();
    }

    describe(row) {
        return {
            id: row.id,
            module: row.module,
            title: row.title,
            body: row.body,
            kind: row.kind,
            at: row.at,
            repeat: row.kind === 'repeat'
                ? {
                    type: row.repeat_type,
                    time: row.repeat_time,
                    ...(row.repeat_type === 'weekdays' ? { weekdays: JSON.parse(row.repeat_weekdays || '[]') } : {})
                }
                : null,
            nextAt: row.next_at
        };
    }

    list(module) {
        return this.repository.listForModule(module).map((row) => this.describe(row));
    }

    setEnabled(module, enabled) {
        if (!this.registry.get(module)) {
            throw AppError.notFound('module.notFound', { id: module });
        }
        const disabled = this.disabledSet();
        if (enabled) {
            disabled.delete(module);
        } else {
            disabled.add(module);
        }
        this.settings.set(NotificationService.DISABLED_KEY, [...disabled]);
        this.reschedule();
        return this.modules().find((item) => item.module === module) || null;
    }

    modules() {
        const disabled = this.disabledSet();
        const result = new Map();
        for (const module of this.registry.all()) {
            if (module.kind !== 'page') {
                continue;
            }
            if (!(module.permissions || []).includes('notifications')) {
                continue;
            }
            result.set(module.id, {
                module: module.id,
                enabled: !disabled.has(module.id),
                count: this.repository.countForModule(module.id)
            });
        }
        for (const id of disabled) {
            if (!result.has(id)) {
                result.set(id, {
                    module: id,
                    enabled: false,
                    count: this.repository.countForModule(id)
                });
            }
        }
        for (const row of this.repository.distinctModules()) {
            if (!result.has(row.module)) {
                result.set(row.module, {
                    module: row.module,
                    enabled: !disabled.has(row.module),
                    count: this.repository.countForModule(row.module)
                });
            }
        }
        return [...result.values()];
    }
}

module.exports = NotificationService;