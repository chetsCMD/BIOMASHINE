import { Dom } from './Dom.js';
import { KeyRecorder } from './KeyRecorder.js';

export class ContextShortcuts {
    constructor({ api, i18n, items, bindingLabel, titleOf }) {
        this.api = api;
        this.i18n = i18n;
        this.items = items;
        this.bindingLabel = bindingLabel;
        this.titleOf = titleOf;
        this.recorder = new KeyRecorder(document);
        this.binding = null;
        this.recording = false;
        this.pickedContext = null;
        this.pickedAction = null;
        this.error = null;
        this.list = [];
        this.pages = [];
        this.container = null;
    }

    t(key, params) {
        return this.i18n.t(key, params);
    }

    async render(container) {
        this.container = container;
        const [list, modules] = await Promise.all([this.api.invoke('hotkeys:contextual'), this.api.invoke('modules:list')]);
        this.list = list;
        this.pages = modules.filter((module) => module.kind === 'page');
        this.draw();
    }

    contexts() {
        return [
            { id: 'view:settings', title: this.t('settings.shortcuts.context.settings') },
            { id: 'view:hub', title: this.t('settings.shortcuts.context.hub') },
            ...this.pages.map((page) => ({ id: `module:${page.id}`, title: this.t('settings.shortcuts.context.module', { title: page.title }) }))
        ];
    }

    contextTitle(id) {
        const found = this.contexts().find((item) => item.id === id);
        return found ? found.title : id;
    }

    actionTitle(id) {
        const item = this.items.find((entry) => entry.id === id);
        return item ? this.titleOf(item) : id;
    }

    toggle() {
        if (this.recording) {
            this.recorder.stop();
            this.recording = false;
            this.draw();
            return;
        }
        this.recording = true;
        this.recorder.start((binding) => {
            this.recording = false;
            if (binding) {
                this.binding = binding;
            }
            this.draw();
        });
        this.draw();
    }

    async add(context, action) {
        try {
            this.list = await this.api.invoke('hotkeys:contextAdd', { context, action, binding: this.binding });
            this.binding = null;
            this.error = null;
        } catch (error) {
            this.error = error.message;
        }
        this.draw();
    }

    async remove(index) {
        this.list = await this.api.invoke('hotkeys:contextRemove', { index });
        this.draw();
    }

    draw() {
        const root = Dom.clear(this.container);
        root.append(
            Dom.el('div', { class: 'settings-name', text: this.t('settings.shortcuts.contexts') }),
            Dom.el('div', { class: 'settings-hint', text: this.t('settings.shortcuts.contextHint') })
        );
        if (this.list.length === 0) {
            root.append(Dom.el('div', { class: 'settings-hint', text: this.t('settings.shortcuts.noContexts') }));
        }
        this.list.forEach((entry, index) => {
            root.append(
                Dom.el('div', { class: 'settings-row shortcut-row' }, [
                    Dom.el('div', { class: 'settings-label' }, [Dom.el('div', { class: 'settings-name', text: `${this.contextTitle(entry.context)}: ${this.actionTitle(entry.action)}` })]),
                    Dom.el('div', { class: 'shortcut-controls' }, [
                        Dom.el('span', { class: 'shortcut-value', text: this.bindingLabel(entry.binding) }),
                        Dom.el('button', { type: 'button', class: 'dialog-btn secondary', text: this.t('settings.shortcuts.remove'), onclick: () => this.remove(index) })
                    ])
                ])
            );
        });
        const context = Dom.el('select', { class: 'bm-input' }, this.contexts().map((item) => Dom.el('option', { value: item.id, text: item.title })));
        const action = Dom.el('select', { class: 'bm-input' }, this.items.map((item) => Dom.el('option', { value: item.id, text: this.titleOf(item) })));
        context.value = this.pickedContext || context.value;
        action.value = this.pickedAction || action.value;
        context.addEventListener('change', () => (this.pickedContext = context.value));
        action.addEventListener('change', () => (this.pickedAction = action.value));
        const label = this.recording ? this.t('settings.shortcuts.press') : this.binding ? this.bindingLabel(this.binding) : this.t('settings.shortcuts.recordHere');
        root.append(
            Dom.el('div', { class: 'shortcut-add' }, [
                context,
                action,
                Dom.el('button', { type: 'button', class: this.recording ? 'shortcut-value recording' : 'shortcut-value', text: label, onclick: () => this.toggle() }),
                Dom.el('button', { type: 'button', class: 'dialog-btn', text: this.t('settings.shortcuts.addContext'), onclick: () => this.add(context.value, action.value) })
            ]),
            Dom.el('div', { class: this.error ? 'form-error' : 'settings-status', text: this.error || '' })
        );
    }
}
