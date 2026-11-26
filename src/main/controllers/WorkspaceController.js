const fs = require('fs');
const BaseController = require('../core/BaseController');
const AppError = require('../core/AppError');

class WorkspaceController extends BaseController {
    constructor(registry, runningId, database, system) {
        super();
        this.registry = registry;
        this.runningId = runningId;
        this.database = database;
        this.system = system;
    }

    get prefix() {
        return 'workspace';
    }

    known(id) {
        const entry = this.registry.get(id);
        if (!entry) {
            throw AppError.notFound('workspace.unknown', { id: String(id) });
        }
        return entry;
    }

    size(entry) {
        try {
            return fs.statSync(this.registry.pathOf(entry)).size;
        } catch (error) {
            return 0;
        }
    }

    routes() {
        return {
            list: () => {
                const data = this.registry.ensure();
                return { running: this.runningId, active: data.active, profiles: data.profiles.map((entry) => ({ ...entry, size: this.size(entry) })) };
            },
            create: async ({ name, from }) => {
                const source = from ? this.known(from) : null;
                const entry = this.registry.create(name);
                try {
                    if (source && source.id === this.runningId) {
                        await this.database.connection.backup(this.registry.pathOf(entry));
                    } else if (source) {
                        fs.copyFileSync(this.registry.pathOf(source), this.registry.pathOf(entry));
                    }
                } catch (error) {
                    this.registry.remove(entry.id);
                    throw error;
                }
                return { id: entry.id };
            },
            rename: ({ id, name }) => {
                this.known(id);
                this.registry.rename(id, name);
            },
            remove: ({ id }) => {
                this.known(id);
                if (id === this.runningId || id === this.registry.ensure().active) {
                    throw AppError.badRequest('workspace.inUse');
                }
                this.registry.remove(id);
            },
            switch: ({ id }) => {
                this.known(id);
                this.registry.setActive(id);
                if (id !== this.runningId) {
                    this.system.relaunch();
                }
                return { relaunching: id !== this.runningId };
            }
        };
    }
}

module.exports = WorkspaceController;
