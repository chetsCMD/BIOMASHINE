const fs = require('fs');
const path = require('path');
const { app, ipcMain, Menu } = require('electron');
const Container = require('./Container');
const WorkspaceRegistry = require('./services/WorkspaceRegistry');
const ElectronSystem = require('./ElectronSystem');
const ProtocolHandler = require('./ProtocolHandler');
const PortablePaths = require('./PortablePaths');
const WindowManager = require('./WindowManager');

class Application {
    constructor() {
        this.container = null;
        this.windows = null;
        this.root = path.join(__dirname, '..', '..');
    }

    run() {
        this.usePortableData();
        if (!app.requestSingleInstanceLock()) {
            app.quit();
            return;
        }
        app.on('second-instance', () => this.windows && this.windows.focus());
        app.on('window-all-closed', () => app.quit());
        app.on('before-quit', () => this.container && this.container.close());
        this.container = this.build();
        ProtocolHandler.registerPrivileged(this.container.config.get('app.protocol.scheme'));
        const language = this.container.settingsService.getAll().language;
        app.commandLine.appendSwitch('lang', this.container.locales.localeOf(language));
        app.whenReady().then(() => this.start());
    }

    appConfig() {
        return JSON.parse(fs.readFileSync(path.join(this.root, 'config', 'app.json'), 'utf8'));
    }

    usePortableData() {
        const folder = new PortablePaths(this.appConfig()).resolve(process.env);
        if (folder) {
            fs.mkdirSync(folder, { recursive: true });
            app.setPath('userData', folder);
        }
    }

    argument(name) {
        const prefix = `--${name}=`;
        const inline = process.argv.find((item) => item.startsWith(prefix));
        if (inline) {
            return inline.slice(prefix.length);
        }
        const index = process.argv.indexOf(`--${name}`);
        return index !== -1 ? process.argv[index + 1] : null;
    }

    applyTitle() {
        const entry = this.workspaces.get(this.workspaceId);
        const template = this.appConfig().workspaces.titleTemplate;
        if (entry && entry.name && this.windows) {
            this.windows.fixTitle(template.replace('{app}', app.getName()).replace('{name}', entry.name));
        }
    }

    build() {
        const userData = app.getPath('userData');
        const userModulesDir = path.join(userData, this.appConfig().modules.userDirectory);
        fs.mkdirSync(userModulesDir, { recursive: true });
        const userLocalesDir = path.join(userData, this.appConfig().i18n.directory);
        fs.mkdirSync(userLocalesDir, { recursive: true });
        const overridesDir = path.join(userData, 'config');
        fs.mkdirSync(overridesDir, { recursive: true });
        const config = this.appConfig();
        this.workspaces = new WorkspaceRegistry({ dataDir: userData, settings: config.workspaces, fileName: config.database.fileName });
        this.workspaces.ensure();
        this.workspaceId = this.workspaces.resolve(this.argument('profile'));
        return new Container({
            workspaces: this.workspaces,
            workspaceId: this.workspaceId,
            dbPath: this.workspaces.dbPath(this.workspaceId),
            dataDir: userData,
            configDir: path.join(this.root, 'config'),
            overridesDir,
            migrationsDir: path.join(this.root, 'migrations'),
            rendererRoot: path.join(this.root, 'src', 'renderer'),
            userModulesDir,
            userLocalesDir,
            system: new ElectronSystem(() => (this.windows ? this.windows.window : null), () => this.windows),
            appVersion: app.getVersion()
        }).build();
    }

    start() {
        Menu.setApplicationMenu(null);
        const container = this.container;
        new ProtocolHandler(container.config.get('app.protocol.scheme'), container.assets, container.design, container.config.get('app.protocol.appHost'), container.config.get('app.design.virtualPath')).attach();
        this.windows = new WindowManager({
            config: container.config,
            settings: container.settingsRepository,
            shortcuts: container.shortcuts,
            preloadPath: path.join(this.root, 'src', 'preload', 'preload.js'),
            root: this.root
        });
        container.router.attach(ipcMain);
        container.settingsService.applyStored();
        this.windows.create();
        this.applyTitle();
    }
}

module.exports = Application;
