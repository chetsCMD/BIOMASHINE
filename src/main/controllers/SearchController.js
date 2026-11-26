const BaseController = require('../core/BaseController');

class SearchController extends BaseController {
    constructor(search) {
        super();
        this.search = search;
    }

    get prefix() {
        return 'search';
    }

    routes() {
        return { query: ({ text }) => this.search.query(text), snapshot: ({ module, lines }) => this.search.saveSnapshot(module, lines) };
    }
}

module.exports = SearchController;
