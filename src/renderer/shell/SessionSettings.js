import { Dom } from './Dom.js';

export class SessionSettings {
    constructor({ api, i18n }) {
        this.api = api;
        this.i18n = i18n;
    }

    t(key, params) {
        return this.i18n.t(key, params);
    }

    render() {
        const root = Dom.el('div', { class: 'panel-card settings-card' });
        this.draw(root);
        return root;
    }

    async draw(root) {
        const info = await this.api.invoke('session:get');
        const options = [
            ['ask', this.t('session.mode.ask')],
            ['always', this.t('session.mode.always')],
            ['never', this.t('session.mode.never')]
        ];
        const select = Dom.el(
            'select',
            { class: 'bm-input', onchange: (event) => this.api.invoke('session:setMode', { mode: event.target.value }) },
            options.map(([value, text]) => Dom.el('option', { value, text, selected: value === info.mode }))
        );
        Dom.clear(root).append(
            Dom.el('div', { class: 'settings-row' }, [
                Dom.el('div', { class: 'settings-label' }, [
                    Dom.el('div', { class: 'settings-name', text: this.t('session.mode.label') }),
                    Dom.el('div', { class: 'settings-hint', text: this.t('session.hint') })
                ]),
                select
            ])
        );
    }
}
