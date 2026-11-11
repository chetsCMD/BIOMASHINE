const fs = require('fs');
const path = require('path');
const Container = require('../src/main/Container');
const I18nTool = require('../scripts/i18n');

const root = path.join(__dirname, '..');

class StubSystem {
    constructor(locale = 'ru-RU') {
        this.locale = locale;
        this.autostart = null;
        this.saved = [];
        this.notifications = [];
    }

    async openExternal(url) {
        this.externalOpened = (this.externalOpened || []).concat(url);
    }

    relaunch() {
        this.relaunched = true;
    }

    windowState() {
        return { fullscreen: Boolean(this.fullscreen) };
    }

    toggleFullscreen() {
        this.fullscreen = !this.fullscreen;
        return this.windowState();
    }

    closeWindow() {
        this.closed = true;
    }

    systemLocale() {
        return this.locale;
    }

    applyAutostart(enabled) {
        this.autostart = enabled;
    }

    async openFolder(folder) {
        this.opened = folder;
        return { opened: true, path: folder, error: null };
    }

    async saveFile(name, content) {
        this.saved.push({ name, content });
        return { saved: true, path: name };
    }

    async saveFolder(name, files) {
        this.saved.push({ name, files });
        return { saved: true, path: name };
    }

    showNotification(payload) {
        this.notifications.push(payload);
        return true;
    }
}

function loadI18n() {
    return JSON.parse(fs.readFileSync(path.join(root, 'config', 'app.json'), 'utf8')).i18n;
}

function resolve(container, ...names) {
    for (const name of names) {
        if (container[name] !== undefined) {
            return container[name];
        }
    }
    throw new Error(`Container не содержит ни одного из: ${names.join(', ')}`);
}

function createApp(options = {}) {
    const system = new StubSystem(options.systemLocale);
    const container = new Container({
        dbPath: ':memory:',
        configDir: options.configDir || path.join(root, 'config'),
        overridesDir: options.overridesDir,
        migrationsDir: path.join(root, 'migrations'),
        rendererRoot: options.rendererRoot || path.join(root, 'src', 'renderer'),
        userModulesDir: options.userModulesDir,
        userLocalesDir: options.userLocalesDir,
        mainLocalesDir: options.mainLocalesDir,
        now: options.now,
        system,
        appVersion: 'test'
    }).build();
    const call = async (channel, payload) => {
        const response = await container.router.dispatch(channel, payload);
        if (!response.ok) {
            const error = new Error(response.error);
            error.status = response.status;
            if (response.code) {
                error.code = response.code;
            }
            throw error;
        }
        return response.data;
    };
    return {
        container,
        call,
        system,
        messages: container.messages,
        shortcuts: container.shortcuts,
        trash: container.operationLog,
        db: container.database
    };
}

function createI18nTool(options = {}) {
    const app = createApp(options);
    const configDir = options.configDir || path.join(root, 'config');
    const tool = new I18nTool({
        config: resolve(app.container, 'configService', 'config', 'configs'),
        registry: resolve(app.container, 'registry', 'moduleRegistry', 'modules'),
        locale: resolve(app.container, 'localeService', 'locale', 'locales'),
        configFile: path.join(configDir, 'app.json'),
        root: options.root || root
    });
    return { ...app, tool };
}

async function rejects(promise, status, message) {
    try {
        await promise;
    } catch (error) {
        if (status !== undefined && error.status !== status) {
            throw new Error(`Ожидался статус ${status}, получен ${error.status}: ${error.message}`);
        }
        if (message !== undefined && !error.message.includes(message)) {
            throw new Error(`Ожидалось сообщение с "${message}", получено "${error.message}"`);
        }
        return error;
    }
    throw new Error('Ожидалась ошибка, но её не было');
}

module.exports = { createApp, createI18nTool, rejects, loadI18n };