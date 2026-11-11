import { DomTranslator } from '../sdk/DomTranslator.js';
import { Translator } from '../sdk/Translator.js';
import { Dom } from './Dom.js';
import { CommandPalette } from './CommandPalette.js';
import { DialogService } from './DialogService.js';
import { LoginView } from './LoginView.js';
import { ModuleCommands } from './ModuleCommands.js';
import { ModuleHost } from './ModuleHost.js';
import { ModuleHub } from './ModuleHub.js';
import { NavMultiClick } from './NavMultiClick.js';
import { Navigation } from './Navigation.js';
import { PluginStyles } from './PluginStyles.js';
import { SettingsView } from './SettingsView.js';
import { SplitRatio } from './SplitRatio.js';
import { SplitState } from './SplitState.js';
import { ThemeManager } from './ThemeManager.js';

export class ShellApp {
    constructor({ document, api }) {
        this.document = document;
        this.api = api;
        this.pages = [];
        this.modules = [];
        this.status = null;
        this.i18n = new Translator();
        this.split = new SplitState();
        this.bound = false;
        this.locked = false;
        this.ui = {
            app: document.getElementById('app'),
            nav: document.getElementById('nav'),
            pills: document.getElementById('pills'),
            lock: document.getElementById('lock-btn'),
            stage: document.getElementById('stage'),
            settings: document.getElementById('settings-view'),
            hub: document.getElementById('hub-view'),
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

    async refreshLayout() {
        let categories = [];
        try {
            categories = await this.api.invoke('modules:categories');
        } catch (error) {
            categories = [];
        }
        const mode = this.settings.menuLayout === 'sidebar' ? 'sidebar' : 'top';
        if (this.ui.app) {
            this.ui.app.dataset.menuLayout = mode;
        }
        if (this.navigation) {
            this.navigation.setLayout({
                mode,
                collapsed: this.settings.menuCollapsed,
                categories
            });
        }
    }

    async start() {
        await this.loadI18n();
        this.splitRatio = new SplitRatio(await this.api.invoke('config:get', { name: 'split' }));
        this.theme = new ThemeManager(this.api, this.document, this.i18n);
        this.plugins = new PluginStyles(this.document);
        await this.theme.load();
        this.theme.apply(this.settings.theme);
        this.dialogs = new DialogService(this.ui.dialogs, this.i18n);
        this.navigation = new Navigation(this.ui.nav, this.i18n);
        this.navigation.onReorder = (ids) => this.handleReorder(ids);
        this.navigation.onCollapseChanged = (ids) => this.handleCollapseChange(ids);
        this.navigation.observe();
        this.loginView = new LoginView(this.ui.login, this.api, this.i18n);
        this.host = new ModuleHost({
            container: this.ui.stage,
            api: this.api,
            theme: this.theme,
            dialogs: this.dialogs,
            i18n: this.i18n,
            splitRatio: this.splitRatio,
            onPills: (items) => this.showPills(items),
            onClosePane: (role) => this.handleClosePane(role)
        });
        this.settingsView = new SettingsView({
            root: this.ui.settings,
            api: this.api,
            theme: this.theme,
            dialogs: this.dialogs,
            i18n: this.i18n,
            onModulesChanged: (list) => this.applyModules(list),
            onSecurityChanged: () => this.refreshStatus(),
            onLanguageChanged: () => this.changeLanguage(),
            onMenuLayoutChanged: (settings) => this.handleMenuLayoutChange(settings),
            onOpenHub: () => this.navigate(Navigation.HUB_ID)
        });
        this.hub = new ModuleHub({
            root: this.ui.hub,
            api: this.api,
            i18n: this.i18n,
            onChanged: (list) => this.applyModules(list)
        });
        this.palette = new CommandPalette({
            root: this.ui.dialogs,
            i18n: this.i18n,
            providers: [() => new ModuleCommands(() => this.pages, (route) => this.navigate(route), this.i18n).provide()]
        });
        this.navMultiClick = new NavMultiClick({
            root: this.ui.nav,
            isPage: (id) => this.pages.some((page) => page.id === id),
            onOpen: (id) => this.enterSplit(id),
            document: this.document
        }).attach();
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
        await this.refreshLayout();
        this.applyModules(await this.api.invoke('modules:list'));
        if (this.split.primaryId === Navigation.HUB_ID) {
            await this.hub.render();
        }
    }

    async handleMenuLayoutChange(settings) {
        this.settings = settings;
        await this.refreshLayout();
    }

    async handleCollapseChange(ids) {
        try {
            this.settings = await this.api.invoke('settings:set', { key: 'menuCollapsed', value: ids });
        } catch (error) {
            return;
        }
    }

    handleReorder(ids) {
        this.api.invoke('modules:reorderPinned', { ids }).then((list) => {
            this.applyModules(list);
        }).catch(() => {});
    }

    enterSplit(id) {
        if (!this.split.primaryId || this.split.primaryId === Navigation.SETTINGS_ID || this.split.primaryId === Navigation.HUB_ID) {
            this.navigate(`module/${id}`);
            return;
        }
        if (!this.split.openSplit(id)) {
            return;
        }
        this.showSplit();
    }

    showSplit() {
        const primary = this.pages.find((page) => page.id === this.split.primaryId);
        const secondary = this.pages.find((page) => page.id === this.split.secondaryId);
        if (!primary || !secondary) {
            this.split.closeRight();
            return;
        }
        this.ui.settings.classList.add('hidden');
        this.ui.hub.classList.add('hidden');
        this.showPills([]);
        this.document.body.classList.add('is-split-view');
        this.navigation.render(this.pages, this.split.primaryId);
        this.host.openSplit(primary, secondary);
    }

    handleClosePane(role) {
        if (role === 'right') {
            this.split.closeRight();
            this.document.body.classList.remove('is-split-view');
            this.host.removePane('right');
            return;
        }
        if (role === 'left') {
            const next = this.split.closeLeft();
            this.document.body.classList.remove('is-split-view');
            this.host.removePane('left');
            if (next) {
                this.navigation.render(this.pages, this.split.primaryId);
                window.history.replaceState(null, '', `#module/${next}`);
            }
        }
    }

    navigate(route) {
        window.location.hash = route;
    }

    onShortcut(name) {
        const ready = !this.locked && this.status && (!this.status.protected || this.status.unlocked);
        if (!ready || this.ui.app.classList.contains('hidden')) {
            return;
        }
        if (name === 'quickSwitch') {
            this.palette.toggle();
        }
        if (name === 'moduleHub') {
            this.navigate(Navigation.HUB_ID);
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
        await this.refreshLayout();
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
        this.navigation.render(this.pages, this.split.primaryId);
        if (this.split.primaryId && this.split.primaryId !== Navigation.SETTINGS_ID && this.split.primaryId !== Navigation.HUB_ID && !this.pages.some((page) => page.id === this.split.primaryId)) {
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
        if (hash === Navigation.HUB_ID) {
            this.showHub();
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
        this.split.open(descriptor.id);
        this.document.body.classList.remove('is-split-view');
        this.ui.settings.classList.add('hidden');
        this.ui.hub.classList.add('hidden');
        this.showPills([]);
        this.navigation.render(this.pages, this.split.primaryId);
        this.host.open(descriptor);
    }

    async showSettings() {
        this.split.open(Navigation.SETTINGS_ID);
        this.document.body.classList.remove('is-split-view');
        this.host.close();
        this.showPills([]);
        this.ui.hub.classList.add('hidden');
        this.navigation.render(this.pages, this.split.primaryId);
        this.ui.settings.classList.remove('hidden');
        await this.settingsView.render();
    }

    async showHub() {
        this.split.open(Navigation.HUB_ID);
        this.document.body.classList.remove('is-split-view');
        this.host.close();
        this.showPills([]);
        this.ui.settings.classList.add('hidden');
        this.ui.hub.classList.remove('hidden');
        this.navigation.render(this.pages, this.split.primaryId);
        await this.hub.render();
    }

    showPills(items) {
        Dom.clear(this.ui.pills).append(...items.map((text) => Dom.el('span', { class: 'header-pill', text })));
    }

    async lock() {
        this.locked = true;
        this.palette.close();
        await this.api.invoke('auth:lock');
        this.host.close();
        this.split.reset();
        this.document.body.classList.remove('is-split-view');
        window.location.hash = '';
        this.ui.app.classList.add('hidden');
        await this.unlockIfNeeded();
        await this.enter();
    }
}
