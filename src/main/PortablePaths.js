const path = require('path');

class PortablePaths {
    constructor(config) {
        this.dataDirectoryName = config.portable.dataDirectoryName;
        this.directoryEnvironment = config.portable.directoryEnvironment;
        this.fileEnvironment = config.portable.fileEnvironment;
    }

    resolve(environment) {
        for (const name of this.directoryEnvironment) {
            if (environment[name]) {
                return path.join(environment[name], this.dataDirectoryName);
            }
        }
        for (const name of this.fileEnvironment) {
            if (environment[name]) {
                return path.join(path.dirname(environment[name]), this.dataDirectoryName);
            }
        }
        return null;
    }
}

module.exports = PortablePaths;
