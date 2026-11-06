const BaseController = require('../core/BaseController');

class ExportController extends BaseController {
    constructor(exporter, system, config) {
        super();
        this.exporter = exporter;
        this.system = system;
        this.baseName = config.get('app.export.fileName');
    }

    get prefix() {
        return 'export';
    }

    stamp() {
        return new Date().toISOString().slice(0, 10);
    }

    routes() {
        return {
            json: () => this.system.saveFile(`${this.baseName}-${this.stamp()}.json`, JSON.stringify(this.exporter.toJson(), null, 2)),
            csv: () => this.system.saveFolder(`${this.baseName}-${this.stamp()}`, this.exporter.toCsv())
        };
    }
}

module.exports = ExportController;
