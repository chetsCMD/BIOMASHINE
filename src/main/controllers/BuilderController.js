const BaseController = require('../core/BaseController');

class BuilderController extends BaseController {
    constructor(builder, system) {
        super();
        this.builder = builder;
        this.system = system;
    }

    get prefix() {
        return 'builder';
    }

    routes() {
        return {
            list: () => this.builder.list(),
            load: ({ id }) => this.builder.load(id),
            save: (payload) => this.builder.save(payload),
            remove: ({ id }) => this.builder.remove(id),
            export: ({ id }) => this.system.saveFile(`${id}.bmmodule`, JSON.stringify(this.builder.exportBundle(id), null, 2)),
            inspect: ({ data }) => this.builder.inspectBundle(data),
            import: ({ data }) => this.builder.importBundle(data)
        };
    }
}

module.exports = BuilderController;
