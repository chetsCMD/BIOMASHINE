import { Dom } from './Dom.js';

export class MacroEditor {
    constructor({ api, i18n, rules, items, titleOf, onChanged }) {
        this.api = api;
        this.i18n = i18n;
        this.rules = rules;
        this.items = items;
        this.titleOf = titleOf;
        this.onChanged = onChanged;
        this.macros = [];
        this.pages = [];
        this.editingId = null;
        this.name = '';
        this.steps = [];
        this.error = null;
        this.container = null;
    }

    t(key, params) {
        return this.i18n.t(key, params);
    }

    async render(container) {
        this.container = container;
        const [macros, modules] = await Promise.all([this.api.invoke('hotkeys:macros'), this.api.invoke('modules:list')]);
        this.macros = macros;
        this.pages = modules.filter((module) => module.kind === 'page');
        this.draw();
    }

    stepTitle(step) {
        if (step.startsWith('wait:')) {
            return this.t('settings.shortcuts.macroWaitStep', { ms: step.slice(5) });
        }
        if (step === 'open:settings') {
            return this.t('settings.shortcuts.macroOpenSettings');
        }
        if (step === 'open:hub') {
            return this.t('settings.shortcuts.macroOpenHub');
        }
        if (step.startsWith('open:')) {
            const page = this.pages.find((item) => item.id === step.slice(5));
            return this.t('settings.shortcuts.macroOpen', { title: page ? page.title : step.slice(5) });
        }
        const item = this.items.find((entry) => entry.id === step);
        return item ? this.titleOf(item) : step;
    }

    options() {
        const actions = this.rules.macroActions.map((id) => ({ value: id, title: this.stepTitle(id) }));
        const open = [{ value: 'open:settings', title: this.stepTitle('open:settings') }, { value: 'open:hub', title: this.stepTitle('open:hub') }, ...this.pages.map((page) => ({ value: `open:${page.id}`, title: this.stepTitle(`open:${page.id}`) }))];
        return [...actions, ...open];
    }

    async persist(work) {
        try {
            this.macros = await work();
            this.error = null;
            this.onChanged();
        } catch (error) {
            this.error = error.message;
        }
        this.draw();
    }

    edit(macro) {
        this.editingId = macro.id;
        this.name = macro.name;
        this.steps = [...macro.steps];
        this.draw();
    }

    save() {
        const payload = { id: this.editingId || undefined, name: this.name, steps: this.steps };
        return this.persist(async () => {
            const macros = await this.api.invoke('hotkeys:macroSave', payload);
            this.editingId = null;
            this.name = '';
            this.steps = [];
            return macros;
        });
    }

    draw() {
        const root = Dom.clear(this.container);
        root.append(
            Dom.el('div', { class: 'settings-name', text: this.t('settings.shortcuts.macros') }),
            Dom.el('div', { class: 'settings-hint', text: this.t('settings.shortcuts.macroHint') })
        );
        if (this.macros.length === 0) {
            root.append(Dom.el('div', { class: 'settings-hint', text: this.t('settings.shortcuts.macroEmpty') }));
        }
        for (const macro of this.macros) {
            root.append(
                Dom.el('div', { class: 'settings-row shortcut-row' }, [
                    Dom.el('div', { class: 'settings-label' }, [
                        Dom.el('div', { class: 'settings-name', text: macro.name }),
                        Dom.el('div', { class: 'settings-hint', text: macro.steps.map((step) => this.stepTitle(step)).join(' → ') })
                    ]),
                    Dom.el('div', { class: 'shortcut-controls' }, [
                        Dom.el('button', { type: 'button', class: 'dialog-btn secondary', text: this.t('settings.shortcuts.macroEdit'), onclick: () => this.edit(macro) }),
                        Dom.el('button', { type: 'button', class: 'dialog-btn secondary', text: this.t('settings.shortcuts.remove'), onclick: () => this.persist(() => this.api.invoke('hotkeys:macroRemove', { id: macro.id })) })
                    ])
                ])
            );
        }
        const name = Dom.el('input', { type: 'text', class: 'bm-input', placeholder: this.t('settings.shortcuts.macroName'), value: this.name });
        name.addEventListener('input', () => (this.name = name.value));
        const choice = Dom.el('select', { class: 'bm-input' }, [...this.options().map((option) => Dom.el('option', { value: option.value, text: option.title })), Dom.el('option', { value: 'wait', text: this.t('settings.shortcuts.macroWait') })]);
        const wait = Dom.el('input', { type: 'number', class: 'bm-input', placeholder: this.t('settings.shortcuts.macroWait'), value: '500' });
        const add = Dom.el('button', {
            type: 'button',
            class: 'dialog-btn secondary',
            text: this.t('settings.shortcuts.macroAddStep'),
            onclick: () => {
                this.steps = [...this.steps, choice.value === 'wait' ? `wait:${Math.max(0, Math.round(Number(wait.value) || 0))}` : choice.value];
                this.draw();
            }
        });
        const steps = this.steps.length === 0
            ? [Dom.el('div', { class: 'settings-hint', text: this.t('settings.shortcuts.macroStepsEmpty') })]
            : this.steps.map((step, index) =>
                  Dom.el('div', { class: 'macro-step' }, [
                      Dom.el('span', { text: `${index + 1}. ${this.stepTitle(step)}` }),
                      Dom.el('button', {
                          type: 'button',
                          class: 'dialog-btn secondary',
                          text: this.t('settings.shortcuts.remove'),
                          onclick: () => {
                              this.steps = this.steps.filter((item, position) => position !== index);
                              this.draw();
                          }
                      })
                  ])
              );
        root.append(
            Dom.el('div', { class: 'macro-form' }, [
                name,
                Dom.el('div', { class: 'settings-hint', text: this.t('settings.shortcuts.macroSteps') }),
                ...steps,
                Dom.el('div', { class: 'shortcut-add' }, [choice, wait, add]),
                Dom.el('button', { type: 'button', class: 'dialog-btn', text: this.t('settings.shortcuts.macroSave'), onclick: () => this.save() })
            ]),
            Dom.el('div', { class: this.error ? 'form-error' : 'settings-status', text: this.error || '' })
        );
    }
}
