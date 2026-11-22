const BaseController = require('../core/BaseController');
const AppError = require('../core/AppError');

class DesignController extends BaseController {
    constructor(design, registry) {
        super();
        this.design = design;
        this.registry = registry;
    }

    get prefix() {
        return 'design';
    }

    scope(payload) {
        const id = payload && payload.module ? payload.module : null;
        if (id) {
            const found = this.registry.get(id);
            if (!found || found.kind !== 'page') {
                throw AppError.notFound('design.unknownModule', { id });
            }
        }
        return id;
    }

    routes() {
        return {
            get: (payload) => {
                const id = this.scope(payload);
                return {
                    base: id ? this.design.tokens(null) : this.design.baseTokens(),
                    overrides: id ? this.design.moduleOverrides(id) : this.design.overrides(),
                    effective: this.design.effectiveOverrides(id),
                    tokens: this.design.tokens(id)
                };
            },
            set: (payload) => {
                const id = this.scope(payload);
                this.design.setOverrides(id, payload.tokens);
                return { overrides: id ? this.design.moduleOverrides(id) : this.design.overrides(), effective: this.design.effectiveOverrides(id) };
            },
            reset: (payload) => {
                const id = this.scope(payload);
                this.design.resetOverrides(id, payload.names);
                return { effective: this.design.effectiveOverrides(id) };
            },
            groups: () => this.design.groups(),
            export: () => this.design.exportData(),
            import: ({ data }) => this.design.importData(data),
            getCss: (payload) => {
                const id = this.scope(payload);
                return { css: this.design.customCss(id), effective: this.design.effectiveCss(id) };
            },
            setCss: (payload) => {
                const id = this.scope(payload);
                this.design.setCss(id, payload.css);
                return { effective: this.design.effectiveCss(id) };
            },
            resetCss: (payload) => {
                const id = this.scope(payload);
                this.design.resetCss(id);
                return { effective: this.design.effectiveCss(id) };
            }
        };
    }
}

module.exports = DesignController;
