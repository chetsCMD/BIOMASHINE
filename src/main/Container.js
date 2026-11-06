const path = require('path');
const ConfigService = require('./core/ConfigService');
const Database = require('./core/Database');
const Migrator = require('./core/Migrator');
const IpcRouter = require('./core/IpcRouter');
const SettingsRepository = require('./repositories/SettingsRepository');
const ProfileRepository = require('./repositories/ProfileRepository');
const MeasurementRepository = require('./repositories/MeasurementRepository');
const SleepRepository = require('./repositories/SleepRepository');
const NutritionRepository = require('./repositories/NutritionRepository');
const RunningRepository = require('./repositories/RunningRepository');
const WorkoutRepository = require('./repositories/WorkoutRepository');
const ReactionTestRepository = require('./repositories/ReactionTestRepository');
const MoodRepository = require('./repositories/MoodRepository');
const AuthService = require('./services/AuthService');
const SettingsService = require('./services/SettingsService');
const SeedService = require('./services/SeedService');
const ModuleRegistry = require('./services/ModuleRegistry');
const ModuleService = require('./services/ModuleService');
const AssetResolver = require('./core/AssetResolver');
const ExportService = require('./services/ExportService');
const AuthController = require('./controllers/AuthController');
const SettingsController = require('./controllers/SettingsController');
const ProfileController = require('./controllers/ProfileController');
const MeasurementController = require('./controllers/MeasurementController');
const SleepController = require('./controllers/SleepController');
const NutritionController = require('./controllers/NutritionController');
const RunningController = require('./controllers/RunningController');
const WorkoutController = require('./controllers/WorkoutController');
const ReactionController = require('./controllers/ReactionController');
const MoodController = require('./controllers/MoodController');
const ExportController = require('./controllers/ExportController');
const ModulesController = require('./controllers/ModulesController');
const ConfigController = require('./controllers/ConfigController');
const ThemeCatalog = require('./services/ThemeCatalog');
const LocaleService = require('./services/LocaleService');
const I18nController = require('./controllers/I18nController');
const AboutController = require('./controllers/AboutController');
const ClockService = require('./services/ClockService');
const ClockController = require('./controllers/ClockController');
const WindowController = require('./controllers/WindowController');
const StorageController = require('./controllers/StorageController');
const ModuleStorageRepository = require('./repositories/ModuleStorageRepository');

class Container {
    constructor({ dbPath, dataDir, configDir, overridesDir, migrationsDir, rendererRoot, userModulesDir, userLocalesDir, system, appVersion, now }) {
        this.options = { dbPath, dataDir, configDir, overridesDir, migrationsDir, rendererRoot, userModulesDir, userLocalesDir, system, appVersion, now };
    }

    build() {
        const { dbPath, dataDir, configDir, overridesDir, migrationsDir, rendererRoot, userModulesDir, userLocalesDir, system, appVersion, now } = this.options;
        this.config = new ConfigService(configDir, overridesDir);
        const filePath = dbPath || path.join(dataDir, this.config.get('app.database.fileName'));
        this.database = new Database(filePath).open();
        new Migrator(this.database, migrationsDir).run();

        const db = this.database;
        this.settingsRepository = new SettingsRepository(db);
        this.clock = new ClockService(this.settingsRepository, now, this.config.get('app.timezones.aliases'));
        db.useClock(this.clock);
        const profile = new ProfileRepository(db);
        const measurements = new MeasurementRepository(db);
        const sleep = new SleepRepository(db);
        const nutrition = new NutritionRepository(db);
        const running = new RunningRepository(db);
        const workouts = new WorkoutRepository(db);
        const reactionTests = new ReactionTestRepository(db);
        const mood = new MoodRepository(db);
        const moduleStorage = new ModuleStorageRepository(db);

        new SeedService(this.config, profile).run();

        this.auth = new AuthService(this.settingsRepository, this.config);
        this.themeCatalog = new ThemeCatalog(this.config);
        this.exporter = new ExportService(db, this.config, appVersion);

        const protocol = this.config.get('app.protocol');
        const modulesDir = path.join(rendererRoot, this.config.get('app.modules.directory'));
        const roots = [{ dir: modulesDir, source: 'system' }];
        if (userModulesDir) {
            roots.push({ dir: userModulesDir, source: 'user' });
        }
        this.registry = new ModuleRegistry(roots, this.config).scan();
        this.assets = new AssetResolver({ appRoot: rendererRoot, appHost: protocol.appHost, registry: this.registry });
        this.locales = new LocaleService({ config: this.config, registry: this.registry, rendererRoot, userLocalesDir: userLocalesDir || path.join(rendererRoot, '__no_user_locales__') });
        this.settingsService = new SettingsService(this.settingsRepository, this.config, system, this.themeCatalog, this.locales, this.clock);
        this.settingsService.ensureLanguage(system.systemLocale ? system.systemLocale() : null);
        this.moduleService = new ModuleService(this.registry, this.settingsRepository, protocol.scheme, this.locales, () => this.settingsService.getAll().language);

        this.router = new IpcRouter(this.auth, this.config);
        [
            new AuthController(this.auth),
            new SettingsController(this.settingsService),
            new ProfileController(profile, measurements),
            new MeasurementController(measurements),
            new SleepController(sleep),
            new NutritionController(nutrition),
            new RunningController(running),
            new WorkoutController(workouts),
            new ReactionController(reactionTests),
            new MoodController(mood),
            new ExportController(this.exporter, system, this.config),
            new ModulesController(this.moduleService, system, userModulesDir),
            new StorageController(moduleStorage, this.registry, this.config),
            new ConfigController(this.config, this.themeCatalog, system, overridesDir),
            new I18nController(this.locales, this.settingsService, system, userLocalesDir),
            new WindowController(system),
            new ClockController(this.clock),
            new AboutController(system, appVersion)
        ].forEach((controller) => this.router.register(controller));

        return this;
    }

    close() {
        if (this.database) {
            this.database.close();
        }
    }
}

module.exports = Container;
