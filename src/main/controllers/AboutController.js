const BaseController = require('../core/BaseController');
const AppError = require('../core/AppError');
const Attribution = require('../core/Attribution');

class AboutController extends BaseController {
    constructor(system, appVersion) {
        super();
        this.system = system;
        this.appVersion = appVersion;
    }

    get prefix() {
        return 'about';
    }

    routes() {
        return {
            info: () => ({ author: Attribution.author, version: this.appVersion, links: Object.keys(Attribution.links) }),
            open: async ({ link }) => {
                if (typeof link !== 'string' || !Object.prototype.hasOwnProperty.call(Attribution.links, link)) {
                    throw AppError.badRequest('about.unknownLink');
                }
                await this.system.openExternal(Attribution.links[link]);
            }
        };
    }
}

module.exports = AboutController;