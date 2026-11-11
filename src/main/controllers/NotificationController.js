const BaseController = require('../core/BaseController');
const AppError = require('../core/AppError');

class NotificationController extends BaseController {
    constructor(service) {
        super();
        this.service = service;
    }

    get prefix() {
        return 'notifications';
    }

    requirePermission(module) {
        if (typeof module !== 'string' || !module) {
            throw AppError.badRequest('notifications.moduleRequired');
        }
        if (!this.service.hasPermission(module)) {
            throw AppError.forbidden('notifications.permissionDenied');
        }
        return module;
    }

    routes() {
        return {
            schedule: (payload) => {
                const module = this.requirePermission(payload.module);
                const title = typeof payload.title === 'string' ? payload.title.trim() : '';
                if (!title) {
                    throw AppError.badRequest('notifications.titleRequired');
                }
                const body = payload.body === undefined || payload.body === null ? null : String(payload.body);
                if (payload.at !== undefined && payload.at !== null) {
                    const at = String(payload.at).replace('T', ' ');
                    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(at)) {
                        throw AppError.badRequest('notifications.atFormat');
                    }
                    return this.service.schedule({ module, title, body, at });
                }
                const repeat = payload.repeat;
                if (!repeat || typeof repeat !== 'object') {
                    throw AppError.badRequest('notifications.repeatRequired');
                }
                if (repeat.type !== 'daily' && repeat.type !== 'weekdays') {
                    throw AppError.badRequest('notifications.repeatType');
                }
                if (!/^\d{2}:\d{2}$/.test(String(repeat.time || ''))) {
                    throw AppError.badRequest('notifications.repeatTime');
                }
                let weekdays = null;
                if (repeat.type === 'weekdays') {
                    if (!Array.isArray(repeat.weekdays) || repeat.weekdays.length === 0) {
                        throw AppError.badRequest('notifications.weekdaysRequired');
                    }
                    const seen = new Set();
                    for (const value of repeat.weekdays) {
                        if (!Number.isInteger(value) || value < 0 || value > 6) {
                            throw AppError.badRequest('notifications.weekdaysRange');
                        }
                        if (seen.has(value)) {
                            throw AppError.badRequest('notifications.weekdaysDuplicates');
                        }
                        seen.add(value);
                    }
                    weekdays = [...seen].sort((a, b) => a - b);
                }
                return this.service.schedule({
                    module,
                    title,
                    body,
                    repeat: { type: repeat.type, time: repeat.time, weekdays }
                });
            },
            cancel: (payload) => {
                const module = this.requirePermission(payload.module);
                if (!Number.isInteger(payload.id)) {
                    throw AppError.badRequest('notifications.idInteger');
                }
                return this.service.cancel(module, payload.id);
            },
            list: (payload) => {
                const module = this.requirePermission(payload.module);
                return this.service.list(module);
            },
            setEnabled: (payload) => {
                if (typeof payload.module !== 'string' || !payload.module) {
                    throw AppError.badRequest('notifications.moduleRequired');
                }
                if (typeof payload.enabled !== 'boolean') {
                    throw AppError.badRequest('notifications.enabledBoolean');
                }
                return this.service.setEnabled(payload.module, payload.enabled);
            },
            modules: () => this.service.modules()
        };
    }
}

module.exports = NotificationController;