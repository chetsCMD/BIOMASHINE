const BaseController = require('../core/BaseController');
const AppError = require('../core/AppError');
const LayoutService = require('../services/LayoutService');

class LayoutController extends BaseController {
    constructor(layout, registry) {
        super();
        this.layout = layout;
        this.registry = registry;
    }

    get prefix() {
        return 'layout';
    }

    scope(payload) {
        const scope = payload ? payload.scope : undefined;
        if (typeof scope !== 'string' || !LayoutService.SCOPE.test(scope)) {
            throw AppError.badRequest('layout.invalidScope');
        }
        if (scope.startsWith('module:')) {
            const id = scope.slice('module:'.length);
            const found = this.registry.get(id);
            if (!found || found.kind !== 'page') {
                throw AppError.notFound('layout.unknownModule', { id });
            }
        }
        return scope;
    }

    routes() {
        return {
            get: (payload) => ({ layout: this.layout.get(this.scope(payload)) }),
            save: (payload) => ({ layout: this.layout.save(this.scope(payload), payload.layout) }),
            reset: (payload) => {
                this.layout.reset(this.scope(payload));
                return { layout: null };
            }
        };
    }
}

module.exports = LayoutController;
