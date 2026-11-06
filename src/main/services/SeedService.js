class SeedService {
    constructor(config, profile) {
        this.config = config;
        this.profile = profile;
    }

    run() {
        this.profile.ensure(this.config.get('health.profileDefaults'));
    }
}

module.exports = SeedService;
