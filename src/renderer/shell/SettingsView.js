import { Dom } from './Dom.js';
import { TextSearch } from './TextSearch.js';
import { ShortcutEditor } from './ShortcutEditor.js';
import { TrashView } from './TrashView.js';

export class SettingsView {
    constructor({ root, api, theme, dialogs, i18n, onModulesChanged, onSecurityChanged, onLanguageChanged, onMenuLayoutChanged, onOpenHub }) {
        this.root = root;
        this.api = api;
        this.theme = theme;
        this.dialogs = dialogs;
        this.i18n = i18n;
        this.onModulesChanged = onModulesChanged;
        this.onSecurityChanged = onSecurityChanged;
        this.onLanguageChanged = onLanguageChanged;
        this.onMenuLayoutChanged = onMenuLayoutChanged;
        this.onOpenHub = onOpenHub;
        this.shortcutEditor = new ShortcutEditor({ api, i18n });
        this.trashView = new TrashView({ api, i18n, dialogs });
    }

    t(key, params) {
        return this.i18n.t(key, params);
    }

    async render() {
        const [settings, modules, errors, configErrors, status, languages, languageErrors, about, zones, clock, shortcutItems, notificationModules] = await Promise.all([
            this.api.invoke('settings:get'),
            this.api.invoke('modules:list'),
            this.api.invoke('modules:errors'),
            this.api.invoke('config:errors'),
            this.api.invoke('auth:status'),
            this.api.invoke('i18n:languages'),
            this.api.invoke('i18n:errors'),
            this.api.invoke('about:info'),
            this.api.invoke('clock:zones'),
            this.api.invoke('clock:now'),
            this.api.invoke('shortcuts:list'),
            this.api.invoke('notifications:modules')
        ]);
        const section = (key) => Dom.el('div', { class: 'section-sep', text: this.t(key) });
        Dom.clear(this.root).append(
            Dom.el('main', {}, [
                section('settings.section.appearance'),
                this.appearance(settings, configErrors, modules.filter((module) => module.kind === 'plugin')),
                section('settings.section.language'),
                this.language(settings, languages, languageErrors),
                section('settings.section.time'),
                this.time(settings, zones, clock),
                section('settings.section.startup'),
                this.startup(settings),
                section('settings.section.shortcuts'),
                this.shortcuts(shortcutItems),
                section('settings.section.modules'),
                this.modules(modules, errors),
                section('settings.section.notifications'),
                this.notificationsBlock(notificationModules, modules),
                section('settings.section.data'),
                this.exports(),
                section('settings.section.trash'),
                this.trash(),
                section('settings.section.security'),
                this.security(status),
                section('settings.section.about'),
                this.about(about)
            ])
        );
    }

    card(children) {
        return Dom.el('div', { class: 'panel-card settings-card' }, children);
    }

    row(label, control, hint) {
        return Dom.el('div', { class: 'settings-row' }, [
            Dom.el('div', { class: 'settings-label' }, [
                Dom.el('div', { class: 'settings-name', text: label }),
                hint ? Dom.el('div', { class: 'settings-hint', text: hint }) : null
            ]),
            control
        ]);
    }

    openResult(status, result, format = (path) => path) {
        status.textContent = result.opened ? format(result.path) : this.t('settings.openFailed', { error: result.error });
    }

    appearance(settings, configErrors, plugins) {
        const themeSelect = Dom.el(
            'select',
            {
                class: 'bm-input',
                onchange: async (event) => {
                    await this.api.invoke('settings:set', { key: 'theme', value: event.target.value });
                    this.theme.apply(event.target.value);
                }
            },
            this.theme.names().map(({ name, title }) => Dom.el('option', { value: name, text: title, selected: name === settings.theme }))
        );
        const layoutSelect = Dom.el(
            'select',
            {
                class: 'bm-input',
                onchange: async (event) => {
                    const updated = await this.api.invoke('settings:set', { key: 'menuLayout', value: event.target.value });
                    if (this.onMenuLayoutChanged) {
                        await this.onMenuLayoutChanged(updated);
                    }
                }
            },
            [
                Dom.el('option', { value: 'top', text: this.t('settings.menuLayout.top'), selected: settings.menuLayout !== 'sidebar' }),
                Dom.el('option', { value: 'sidebar', text: this.t('settings.menuLayout.sidebar'), selected: settings.menuLayout === 'sidebar' })
            ]
        );
        const status = Dom.el('div', { class: 'settings-status' });
        const open = Dom.el('button', {
            class: 'dialog-btn secondary',
            text: this.t('settings.openConfigFolder'),
            onclick: async () => this.openResult(status, await this.api.invoke('config:openFolder'), (path) => this.t('settings.configChanges', { path }))
        });
        const errors = configErrors.map((error) => Dom.el('div', { class: 'form-error', text: this.t('settings.configError', { file: error.file, message: error.message }) }));
        const pluginRows = plugins.map((plugin) => this.moduleRow(plugin, true));
        return this.card([
            this.row(this.t('settings.theme'), themeSelect),
            this.row(this.t('settings.menuLayout'), layoutSelect, this.t('settings.menuLayout.hint')),
            ...pluginRows,
            this.row(this.t('settings.userConfigs'), open),
            ...errors,
            status
        ]);
    }

    language(settings, languages, languageErrors) {
        const select = Dom.el(
            'select',
            {
                class: 'bm-input',
                onchange: async (event) => {
                    await this.api.invoke('settings:set', { key: 'language', value: event.target.value });
                    await this.onLanguageChanged();
                    await this.render();
                    const restart = await this.dialogs.confirm(this.t('settings.language.restartConfirm'), {
                        confirmText: this.t('settings.language.restartNow'),
                        cancelText: this.t('settings.language.restartLater')
                    });
                    if (restart) {
                        await this.api.invoke('settings:relaunch');
                    }
                }
            },
            languages.map((language) => Dom.el('option', { value: language.code, text: language.name, selected: language.code === settings.language }))
        );
        const status = Dom.el('div', { class: 'settings-status' });
        const actions = Dom.el('div', { class: 'settings-actions' }, [
            Dom.el('button', {
                class: 'dialog-btn secondary',
                text: this.t('settings.language.exportTemplate'),
                onclick: async () => {
                    const result = await this.api.invoke('i18n:export', { code: settings.language });
                    status.textContent = result.saved ? this.t('settings.export.saved', { path: result.path }) : this.t('settings.export.cancelled');
                }
            }),
            Dom.el('button', {
                class: 'dialog-btn secondary',
                text: this.t('settings.language.openFolder'),
                onclick: async () => this.openResult(status, await this.api.invoke('i18n:openFolder'))
            })
        ]);
        const errors = languageErrors.map((error) => Dom.el('div', { class: 'form-error', text: this.t('settings.language.error', { file: error.file, message: error.message }) }));
        return this.card([this.row(this.t('settings.language.label'), select, this.t('settings.language.hint')), actions, ...errors, status]);
    }

    time(settings, zones, clock) {
        const preview = Dom.el('div', { class: 'settings-status', text: this.t('settings.time.now', { timestamp: clock.timestamp }) });
        let current = settings.timezone;
        const select = Dom.el('select', {
            class: 'bm-input',
            onchange: async (event) => {
                current = event.target.value;
                await this.api.invoke('settings:set', { key: 'timezone', value: current });
                const updated = await this.api.invoke('clock:now');
                preview.textContent = this.t('settings.time.now', { timestamp: updated.timestamp });
            }
        });
        const systemOption = () =>
            Dom.el('option', {
                value: 'system',
                text: this.t('settings.time.system', { zone: clock.system.zone, offset: clock.system.offset }),
                selected: current === 'system'
            });
        const draw = (query) => {
            const found = TextSearch.filter(zones, query, (zone) => [zone.id, zone.id.replace(/[_/]/g, ' '), zone.offset]);
            const shown = found.some((zone) => zone.id === current) || current === 'system' ? found : [...found, ...zones.filter((zone) => zone.id === current)];
            Dom.clear(select).append(systemOption(), ...shown.map((zone) => Dom.el('option', { value: zone.id, text: `${zone.id} (${zone.offset})`, selected: zone.id === current })));
        };
        draw('');
        const search = Dom.el('input', {
            type: 'text',
            class: 'bm-input',
            placeholder: this.t('settings.time.search'),
            autocomplete: 'off',
            oninput: (event) => draw(event.target.value)
        });
        return this.card([this.row(this.t('settings.time.zone'), Dom.el('div', { class: 'settings-time-control' }, [search, select]), this.t('settings.time.hint')), preview]);
    }

    startup(settings) {
        const box = Dom.el('input', {
            type: 'checkbox',
            checked: settings.autostart,
            onchange: (event) => this.api.invoke('settings:set', { key: 'autostart', value: event.target.checked })
        });
        return this.card([this.row(this.t('settings.autostart'), box)]);
    }

    shortcuts(items) {
        const container = Dom.el('div');
        this.shortcutEditor.render(items, container);
        return this.card([container]);
    }

    modules(list, errors) {
        const entries = list.filter((module) => module.kind === 'page');
        const rows = Dom.el('div', { class: 'settings-rows' });
        const draw = (query) => {
            const found = TextSearch.filter(entries, query, (module) => [
                module.title,
                module.id,
                module.description,
                this.t(module.source === 'user' ? 'settings.tag.user' : 'settings.tag.system'),
                this.t('settings.tag.page')
            ]);
            Dom.clear(rows).append(
                ...(found.length > 0
                    ? found.map((module) => this.moduleRow(module, false))
                    : [Dom.el('div', { class: 'empty', text: this.t(entries.length === 0 ? 'settings.modules.none' : 'settings.modules.notFound') })])
            );
        };
        const search = Dom.el('input', {
            type: 'text',
            class: 'settings-search bm-input',
            placeholder: this.t('settings.modules.search'),
            autocomplete: 'off',
            oninput: (event) => draw(event.target.value)
        });
        draw('');
        const status = Dom.el('div', { class: 'settings-status' });
        const actions = Dom.el('div', { class: 'settings-actions' }, [
            Dom.el('button', {
                class: 'dialog-btn secondary',
                text: this.t('nav.allModules'),
                onclick: () => {
                    if (this.onOpenHub) {
                        this.onOpenHub();
                    }
                }
            }),
            Dom.el('button', {
                class: 'dialog-btn secondary',
                text: this.t('settings.modules.openFolder'),
                onclick: async () => this.openResult(status, await this.api.invoke('modules:openFolder'))
            }),
            Dom.el('button', {
                class: 'dialog-btn secondary',
                text: this.t('settings.modules.rescan'),
                onclick: async () => {
                    const result = await this.api.invoke('modules:rescan');
                    this.onModulesChanged(result.modules);
                    await this.render();
                }
            })
        ]);
        const errorRows = errors.map((error) =>
            Dom.el('div', {
                class: 'form-error',
                text: this.t(error.source === 'user' ? 'settings.modules.errorUser' : 'settings.modules.errorSystem', { dir: error.dir, message: error.message })
            })
        );
        return this.card([search, rows, ...errorRows, actions, status]);
    }

    notificationsBlock(entries, modules) {
        const byId = new Map(modules.map((module) => [module.id, module]));
        const rows = Dom.el('div', { class: 'settings-rows' });
        if (!entries || entries.length === 0) {
            rows.append(Dom.el('div', { class: 'empty', text: this.t('settings.notifications.empty') }));
        } else {
            for (const entry of entries) {
                const module = byId.get(entry.module);
                const title = module ? module.title : entry.module;
                const box = Dom.el('input', {
                    type: 'checkbox',
                    checked: entry.enabled,
                    onchange: async (event) => {
                        await this.api.invoke('notifications:setEnabled', { module: entry.module, enabled: event.target.checked });
                        await this.render();
                    }
                });
                const hint = entry.count > 0 ? this.t('settings.notifications.count', { count: entry.count }) : null;
                rows.append(this.row(title, box, hint));
            }
        }
        return this.card([rows]);
    }

    moduleRow(module, isPlugin) {
        const box = Dom.el('input', {
            type: 'checkbox',
            checked: !module.hidden,
            disabled: !module.hideable,
            onchange: async (event) => {
                const updated = await this.api.invoke('modules:setHidden', { id: module.id, hidden: !event.target.checked });
                this.onModulesChanged(updated);
            }
        });
        const tags = [module.source === 'user' ? this.t('settings.tag.user') : null, isPlugin ? this.t('settings.tag.plugin') : null].filter(Boolean);
        const title = tags.length ? `${module.title} · ${tags.join(', ')}` : module.title;
        return this.row(title, box, module.description || this.t('settings.modules.hint'));
    }

    exports() {
        const status = Dom.el('div', { class: 'settings-status' });
        const run = (channel) => async () => {
            status.textContent = '';
            try {
                const result = await this.api.invoke(channel);
                status.textContent = result.saved ? this.t('settings.export.saved', { path: result.path }) : this.t('settings.export.cancelled');
            } catch (error) {
                status.textContent = error.message;
            }
        };
        const buttons = Dom.el('div', { class: 'settings-actions' }, [
            Dom.el('button', { class: 'dialog-btn secondary', text: this.t('settings.export.json'), onclick: run('export:json') }),
            Dom.el('button', { class: 'dialog-btn secondary', text: this.t('settings.export.csv'), onclick: run('export:csv') })
        ]);
        return this.card([this.row(this.t('settings.export.row'), buttons, this.t('settings.export.hint')), status]);
    }

    trash() {
        const container = Dom.el('div', { class: 'trash-container' });
        this.trashView.render(container);
        return this.card([container]);
    }

    about(info) {
        const open = (link) => () => this.api.invoke('about:open', { link });
        const button = (key, link, primary) =>
            Dom.el('button', { class: primary ? 'dialog-btn' : 'dialog-btn secondary', text: this.t(key), onclick: open(link) });
        return this.card([
            this.row(this.t('settings.about.author', { name: info.author }), Dom.el('div', { class: 'settings-hint', text: this.t('settings.about.version', { version: info.version }) }), this.t('settings.about.license')),
            Dom.el('div', { class: 'settings-actions' }, [
                button('settings.about.authorGithub', 'authorGithub', false),
                button('settings.about.projectGithub', 'projectGithub', false),
                button('settings.about.support', 'support', true)
            ])
        ]);
    }

    field(placeholder, type = 'text') {
        return Dom.el('input', { type, placeholder, autocomplete: 'off', class: 'bm-input' });
    }

    security(status) {
        const message = Dom.el('div', { class: 'settings-status' });
        const fail = (error) => {
            message.textContent = error.message;
        };
        if (!status.protected) {
            const login = this.field(this.t('settings.auth.login'));
            const password = this.field(this.t('settings.auth.password'), 'password');
            const repeat = this.field(this.t('settings.auth.repeat'), 'password');
            const enable = async () => {
                if (password.value !== repeat.value) {
                    message.textContent = this.t('settings.auth.mismatch');
                    return;
                }
                try {
                    await this.api.invoke('auth:setup', { login: login.value, password: password.value });
                    await this.onSecurityChanged();
                    await this.render();
                } catch (error) {
                    fail(error);
                }
            };
            return this.card([
                Dom.el('div', { class: 'settings-hint', text: this.t('settings.auth.none') }),
                Dom.el('div', { class: 'settings-form' }, [login, password, repeat]),
                Dom.el('button', { class: 'dialog-btn', text: this.t('settings.auth.enable'), onclick: enable }),
                message
            ]);
        }
        const login = this.field(this.t('settings.auth.currentLogin'));
        const password = this.field(this.t('settings.auth.currentPassword'), 'password');
        const newLogin = this.field(this.t('settings.auth.newLogin'));
        const newPassword = this.field(this.t('settings.auth.newPassword'), 'password');
        const change = async () => {
            try {
                await this.api.invoke('auth:change', {
                    login: login.value,
                    password: password.value,
                    newLogin: newLogin.value,
                    newPassword: newPassword.value
                });
                message.textContent = this.t('settings.auth.changed');
            } catch (error) {
                fail(error);
            }
        };
        const disable = async () => {
            if (!(await this.dialogs.confirm(this.t('settings.auth.confirmRemove'), { confirmText: this.t('settings.auth.removeConfirm'), danger: true }))) {
                return;
            }
            try {
                await this.api.invoke('auth:remove', { login: login.value, password: password.value });
                await this.onSecurityChanged();
                await this.render();
            } catch (error) {
                fail(error);
            }
        };
        return this.card([
            Dom.el('div', { class: 'settings-form' }, [login, password, newLogin, newPassword]),
            Dom.el('div', { class: 'settings-actions' }, [
                Dom.el('button', { class: 'dialog-btn', text: this.t('settings.auth.change'), onclick: change }),
                Dom.el('button', { class: 'dialog-btn danger', text: this.t('settings.auth.remove'), onclick: disable })
            ]),
            message
        ]);
    }
}
