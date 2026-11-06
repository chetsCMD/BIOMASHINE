import { DomTranslator } from '../sdk/DomTranslator.js';
import { Translator } from '../sdk/Translator.js';
import { Dom } from './Dom.js';
import { CommandPalette } from './CommandPalette.js';
import { DialogService } from './DialogService.js';
import { LoginView } from './LoginView.js';
import { ModuleCommands } from './ModuleCommands.js';
import { ModuleHost } from './ModuleHost.js';
import { Navigation } from './Navigation.js';
import { PluginStyles } from './PluginStyles.js';
import { SettingsView } from './SettingsView.js';
import { ThemeManager } from './ThemeManager.js';

export class ShellApp {
    constructor({ document, api }) {
        this.document = document;
        this.api = api;
        this.pages = [];
        this.modules = [];
        this.status = null;
        this.i18n = new Translator();
        this.activeId = null;
        this.bound = false;
        this.locked = false;
        this.ui = {
            app: document.getElementById('app'),
            nav: document.getElementById('nav'),
            pills: document.getElementById('pills'),
            lock: document.getElementById('lock-btn'),
            stage: document.getElementById('stage'),
            settings: document.getElementById('settings-view'),
            login: document.getElementById('login-view'),
            dialogs: document.getElementById('dialog-root'),
            boot: document.getElementById('boot'),
            windowControls: document.getElementById('window-controls'),
            fullscreenButton: document.getElementById('fullscreen-btn'),
            closeButton: document.getElementById('close-btn')
        };
    }

    async loadI18n() {
        this.settings = await this.api.invoke('settings:get');
        this.i18n.load(await this.api.invoke('i18n:bundle', { scope: 'shell' }));
        this.document.documentElement.lang = this.i18n.language;
        DomTranslator.apply(this.document, this.i18n);
    }

    async start() {
        await this.loadI18n();
        this.theme = new ThemeManager(this.api, this.document, this.i18n);
        this.plugins = new PluginStyles(this.document);
        await this.theme.load();
        this.theme.apply(this.settings.theme);
        this.dialogs = new DialogService(this.ui.dialogs, this.i18n);
        this.navigation = new Navigation(this.ui.nav, this.i18n);
        this.loginView = new LoginView(this.ui.login, this.api, this.i18n);
        this.host = new ModuleHost({
            container: this.ui.stage,
            api: this.api,
            theme: this.theme,
            dialogs: this.dialogs,
            i18n: this.i18n,
            onPills: (items) => this.showPills(items)
        });
        this.settingsView = new SettingsView({
            root: this.ui.settings,
            api: this.api,
            theme: this.theme,
            dialogs: this.dialogs,
            i18n: this.i18n,
            onModulesChanged: (list) => this.applyModules(list),
            onSecurityChanged: () => this.refreshStatus(),
            onLanguageChanged: () => this.changeLanguage()
        });
        this.palette = new CommandPalette({
            root: this.ui.dialogs,
            i18n: this.i18n,
            providers: [() => new ModuleCommands(() => this.pages, (route) => this.navigate(route), this.i18n).provide()]
        });
        this.api.onShortcut((name) => this.onShortcut(name));
        this.api.onWindowState((state) => this.showWindowControls(state.fullscreen));
        this.ui.fullscreenButton.addEventListener('click', () => this.api.invoke('window:toggleFullscreen'));
        this.ui.closeButton.addEventListener('click', () => this.api.invoke('window:close'));
        this.showWindowControls((await this.api.invoke('window:state')).fullscreen);
        this.ui.lock.addEventListener('click', () => this.lock());
        await this.unlockIfNeeded();
        await this.enter();
    }

    showWindowControls(fullscreen) {
        this.ui.windowControls.classList.toggle('hidden', !fullscreen);
        this.document.body.classList.toggle('is-fullscreen', fullscreen);
    }

    async changeLanguage() {
        await this.loadI18n();
        this.applyModules(await this.api.invoke('modules:list'));
    }

    navigate(route) {
        window.location.hash = route;
    }

    onShortcut(name) {
        const ready = !this.locked && this.status && (!this.status.protected || this.status.unlocked);
        if (name === 'quickSwitch' && ready && !this.ui.app.classList.contains('hidden')) {
            this.palette.toggle();
        }
    }

    async refreshStatus() {
        this.status = await this.api.invoke('auth:status');
        this.ui.lock.classList.toggle('hidden', !this.status.protected);
    }

    async unlockIfNeeded() {
        await this.refreshStatus();
        if (this.status.protected && !this.status.unlocked) {
            this.ui.boot.classList.add('done');
            await this.loginView.prompt();
            await this.refreshStatus();
        }
    }

    async enter() {
        this.locked = false;
        this.ui.boot.classList.add('done');
        this.ui.app.classList.remove('hidden');
        this.applyModules(await this.api.invoke('modules:list'));
        if (!this.bound) {
            window.addEventListener('hashchange', () => this.route());
            this.bound = true;
        }
        this.route();
    }

    applyModules(list) {
        this.modules = list;
        this.pages = list.filter((module) => module.kind === 'page' && !module.hidden);
        const pluginCss = list.filter((module) => module.kind === 'plugin' && !module.hidden).flatMap((module) => module.cssUrls);
        this.host.setPluginCss(pluginCss);
        this.plugins.apply(pluginCss);
        this.navigation.render(this.pages, this.activeId);
        if (this.activeId && this.activeId !== Navigation.SETTINGS_ID && !this.pages.some((page) => page.id === this.activeId)) {
            this.route();
        }
    }

    route() {
        if (this.locked) {
            return;
        }
        const hash = window.location.hash.slice(1);
        if (hash === Navigation.SETTINGS_ID) {
            this.showSettings();
            return;
        }
        const requested = hash.startsWith('module/') ? this.pages.find((page) => page.id === hash.slice(7)) : null;
        const target = requested || this.pages[0];
        if (!target) {
            window.location.hash = Navigation.SETTINGS_ID;
            return;
        }
        if (!requested) {
            window.location.hash = `module/${target.id}`;
            return;
        }
        this.showModule(target);
    }

    showModule(descriptor) {
        this.activeId = descriptor.id;
        this.ui.settings.classList.add('hidden');
        this.showPills([]);
        this.navigation.render(this.pages, this.activeId);
        this.host.open(descriptor);
    }

    async showSettings() {
        this.activeId = Navigation.SETTINGS_ID;
        this.host.close();
        this.showPills([]);
        this.navigation.render(this.pages, this.activeId);
        this.ui.settings.classList.remove('hidden');
        await this.settingsView.render();
    }

    showPills(items) {
        Dom.clear(this.ui.pills).append(...items.map((text) => Dom.el('span', { class: 'header-pill', text })));
    }

    async lock() {
        this.locked = true;
        this.palette.close();
        await this.api.invoke('auth:lock');
        this.host.close();
        this.activeId = null;
        window.location.hash = '';
        this.ui.app.classList.add('hidden');
        await this.unlockIfNeeded();
        await this.enter();
    }
}
