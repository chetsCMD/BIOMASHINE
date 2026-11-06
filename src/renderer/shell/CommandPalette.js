import { Dom } from './Dom.js';
import { TextSearch } from './TextSearch.js';

export class CommandPalette {
    constructor({ root, providers, i18n }) {
        this.root = root;
        this.i18n = i18n;
        this.providers = providers;
        this.backdrop = null;
        this.results = [];
        this.selected = 0;
        this.input = null;
        this.list = null;
    }

    isOpen() {
        return this.backdrop !== null;
    }

    commands() {
        return this.providers.flatMap((provider) => provider());
    }

    search(query) {
        return TextSearch.filter(this.commands(), query, (command) => [command.title, ...(command.keywords || []), command.hint]);
    }

    toggle() {
        if (this.isOpen()) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        this.input = Dom.el('input', { type: 'text', class: 'palette-input', placeholder: this.i18n.t('palette.placeholder'), autocomplete: 'off' });
        this.list = Dom.el('div', { class: 'palette-list' });
        this.input.addEventListener('input', () => this.refresh());
        this.input.addEventListener('keydown', (event) => this.onKey(event));
        this.backdrop = Dom.el(
            'div',
            {
                class: 'dialog-backdrop palette-backdrop',
                onmousedown: (event) => {
                    if (event.target === this.backdrop) {
                        this.close();
                    }
                }
            },
            [Dom.el('div', { class: 'palette' }, [this.input, this.list])]
        );
        this.root.append(this.backdrop);
        this.refresh();
        this.input.focus();
    }

    close() {
        if (this.backdrop) {
            this.backdrop.remove();
            this.backdrop = null;
        }
    }

    refresh() {
        this.results = this.search(this.input.value);
        this.selected = 0;
        this.render();
    }

    render() {
        if (this.results.length === 0) {
            Dom.clear(this.list).append(Dom.el('div', { class: 'palette-empty', text: this.i18n.t('palette.empty') }));
            return;
        }
        Dom.clear(this.list).append(
            ...this.results.map((command, index) =>
                Dom.el(
                    'div',
                    {
                        class: index === this.selected ? 'palette-item selected' : 'palette-item',
                        onmousedown: () => this.run(command),
                        onmousemove: () => this.select(index)
                    },
                    [Dom.el('span', { text: command.title }), Dom.el('span', { class: 'palette-hint', text: command.hint || '' })]
                )
            )
        );
    }

    select(index) {
        if (index === this.selected) {
            return;
        }
        this.selected = index;
        this.render();
    }

    onKey(event) {
        if (event.key === 'Escape') {
            event.preventDefault();
            this.close();
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const step = event.key === 'ArrowDown' ? 1 : -1;
            this.selected = (this.selected + step + this.results.length) % Math.max(this.results.length, 1);
            this.render();
        } else if (event.key === 'Enter') {
            event.preventDefault();
            if (this.results[this.selected]) {
                this.run(this.results[this.selected]);
            }
        }
    }

    run(command) {
        this.close();
        command.run();
    }
}
