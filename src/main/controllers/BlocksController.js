const fs = require('fs');
const BaseController = require('../core/BaseController');

class BlocksController extends BaseController {
    constructor(blocks, system, userDir) {
        super();
        this.blocks = blocks;
        this.system = system;
        this.userDir = userDir;
    }

    get prefix() {
        return 'blocks';
    }

    routes() {
        return {
            list: () => this.blocks.list(),
            rescan: () => this.blocks.list(),
            errors: () => this.blocks.errors(),
            openFolder: () => {
                if (this.userDir) {
                    fs.mkdirSync(this.userDir, { recursive: true });
                }
                return this.system.openFolder(this.userDir);
            }
        };
    }
}

module.exports = BlocksController;
