const path = require('path');
const ConfigService = require('./core/ConfigService');
const Database = require('./core/Database');
const Migrator = require('./core/Migrator');
const IpcRouter = require('./core/IpcRouter');
const OperationLog = require('./core/OperationLog');
const Values = require('./core/Values');
const SettingsRepository = require('./repositories/SettingsRepository');
const ProfileRepository = require('./repositories/ProfileRepository');
const MeasurementRepository = require('./repositories/MeasurementRepository');
const SleepRepository = require('./repositories/SleepRepository');
const NutritionRepository = require('./repositories/NutritionRepository');
const RunningRepository = require('./repositories/RunningRepository');
const WorkoutRepository = require('./repositories/WorkoutRepository');
const ReactionTestRepository = require('./repositories/ReactionTestRepository');
const MoodRepository = require('./repositories/MoodRepository');
const ModuleStorageRepository = require('./repositories/ModuleStorageRepository');
const NotificationRepository = require('./repositories/NotificationRepository');
const AuthService = require('./services/AuthService');
const SettingsService = require('./services/SettingsService');
const SeedService = require('./services/SeedService');
const ModuleRegistry = require('./services/ModuleRegistry');
const ModuleService = require('./services/ModuleService');
const AssetResolver = require('./core/AssetResolver');
const ExportService = require('./services/ExportService');
const ThemeCatalog = require('./services/ThemeCatalog');
const LocaleService = require('./services/LocaleService');
const ClockService = require('./services/ClockService');
const NotificationService = require('./services/NotificationService');
const MessageService = require('./services/MessageService');
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
const I18nController = require('./controllers/I18nController');
const AboutController = require('./controllers/AboutController');
const ClockController = require('./controllers/ClockController');
const WindowController = require('./controllers/WindowController');
const StorageController = require('./controllers/StorageController');
const NotificationController = require('./controllers/NotificationController');
const TrashController = require('./controllers/TrashController');
const ShortcutService = require('./ShortcutService');
const ShortcutController = require('./controllers/ShortcutController');

class Container {
    constructor({ dbPath, dataDir, configDir, overridesDir, migrationsDir, rendererRoot, userModulesDir, userLocalesDir, mainLocalesDir, system, appVersion, now }) {
        this.options = { dbPath, dataDir, configDir, overridesDir, migrationsDir, rendererRoot, userModulesDir, userLocalesDir, mainLocalesDir, system, appVersion, now };
    }

    build() {
        const { dbPath, dataDir, configDir, overridesDir, migrationsDir, rendererRoot, userModulesDir, userLocalesDir, system, appVersion, now } = this.options;
        this.config = new ConfigService(configDir, overridesDir);
        const filePath = dbPath || path.join(dataDir, this.config.get('app.database.fileName'));
        this.database = new Database(filePath).open();
        new Migrator(this.database, migrationsDir).run();

        const db = this.database;
        this.settingsRepository = new SettingsRepository(db);
        this.shortcuts = new ShortcutService({
            defaults: this.config.get('app.shortcuts'),
            settings: this.settingsRepository
        });
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
        const notificationRepository = new NotificationRepository(db);

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
        this.registry = new ModuleRegistry(roots, this.config, (a, b) => Values.compare(a, b)).scan();
        this.assets = new AssetResolver({ appRoot: rendererRoot, appHost: protocol.appHost, registry: this.registry });
        const localesDir = this.options.mainLocalesDir === undefined ? path.join(__dirname, 'locales') : this.options.mainLocalesDir;
        this.locales = new LocaleService({
            config: this.config,
            registry: this.registry,
            rendererRoot,
            userLocalesDir: userLocalesDir || path.join(rendererRoot, '__no_user_locales__'),
            mainLocalesDir: localesDir
        });
        this.settingsService = new SettingsService(this.settingsRepository, this.config, system, this.themeCatalog, this.locales, this.clock);
        this.settingsService.ensureLanguage(system.systemLocale ? system.systemLocale() : null);
        this.settingsService.applyLocale();
        this.messages = new MessageService({
            locales: this.locales,
            language: () => this.settingsService.getAll().language
        });
        this.moduleService = new ModuleService(this.registry, this.settingsRepository, protocol.scheme, this.locales, () => this.settingsService.getAll().language, this.config);
        this.notificationsRepository = notificationRepository;
        this.notifications = new NotificationService({
            repository: notificationRepository,
            clock: this.clock,
            settings: this.settingsRepository,
            registry: this.registry,
            system
        });

        let operationsMap = {};
        try {
            operationsMap = this.config.get('operations', {}) || {};
        } catch (error) {
            operationsMap = {};
        }
        this.operationLog = new OperationLog(db, {
            max: this.config.get('app.trash.max', 10),
            operations: operationsMap
        }).install();

        this.router = new IpcRouter(this.auth, this.config, this.operationLog, this.messages);
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
            new ModulesController(this.moduleService, system, userModulesDir, this.messages),
            new StorageController(moduleStorage, this.registry, this.config),
            new ConfigController(this.config, this.themeCatalog, system, overridesDir, this.messages),
            new I18nController(this.locales, this.settingsService, system, userLocalesDir, this.messages),
            new WindowController(system),
            new ClockController(this.clock),
            new AboutController(system, appVersion),
            new ShortcutController(this.shortcuts),
            new NotificationController(this.notifications),
            new TrashController(this.operationLog)
        ].forEach((controller) => this.router.register(controller));

        this.notifications.start();

        return this;
    }

    close() {
        if (this.notifications) {
            this.notifications.stop();
        }
        if (this.database) {
            this.database.close();
        }
    }
}

module.exports = Container;