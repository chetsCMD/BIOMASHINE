import { Dom } from './Dom.js';

export class GlobalSearch {
    constructor({ api, i18n, win, onOpen }) {
        this.api = api;
        this.i18n = i18n;
        this.win = win;
        this.onOpen = onOpen;
        this.config = null;
        this.available = false;
        this.opened = false;
        this.results = [];
        this.index = 0;
        this.timer = null;
        this.sequence = 0;
    }

    t(key, params) {
        return this.i18n.t(key, params);
    }

    async start() {
        this.config = await this.api.invoke('config:get', { name: 'search' });
        this.input = Dom.el('input', { type: 'text', class: 'global-search-input', placeholder: this.t('search.placeholder'), autocomplete: 'off', spellcheck: 'false' });
        this.input.addEventListener('input', () => this.schedule());
        this.input.addEventListener('keydown', (event) => this.key(event));
        this.list = Dom.el('div', { class: 'global-search-list' });
        this.panel = Dom.el('div', { class: 'global-search' }, [this.input, this.list]);
        this.layer = Dom.el('div', { class: 'global-search-layer hidden' }, [this.panel]);
        this.layer.setAttribute('data-bm-canvas-ui', '');
        this.layer.addEventListener('click', (event) => {
            if (event.target === this.layer) {
                this.close();
            }
        });
        this.win.document.body.append(this.layer);
    }

    setAvailable(available) {
        this.available = available;
        if (!available) {
            this.close();
        }
    }

    toggle() {
        if (this.opened) this.close();
        else this.open();
    }

    open() {
        if (!this.available) {
            return;
        }
        this.opened = true;
        this.layer.classList.remove('hidden');
        this.input.focus();
        this.input.select();
        this.schedule();
    }

    close() {
        this.opened = false;
        if (this.layer) {
            this.layer.classList.add('hidden');
        }
    }

    key(event) {
        if (event.key === 'Escape') {
            event.preventDefault();
            this.close();
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const step = event.key === 'ArrowDown' ? 1 : -1;
            this.index = Math.min(Math.max(this.index + step, 0), Math.max(this.results.length - 1, 0));
            this.mark();
        } else if (event.key === 'Enter' && this.results[this.index]) {
            event.preventDefault();
            this.choose(this.results[this.index]);
        }
    }

    schedule() {
        this.win.clearTimeout(this.timer);
        this.timer = this.win.setTimeout(() => this.run(), this.config.debounceMs);
    }

    note(text) {
        Dom.clear(this.list).append(Dom.el('div', { class: 'global-search-note', text }));
    }

    async run() {
        const text = this.input.value.trim();
        if (text.length < this.config.minQueryLength) {
            this.results = [];
            this.note(this.t('search.hint', { count: this.config.minQueryLength }));
            return;
        }
        const sequence = this.sequence + 1;
        this.sequence = sequence;
        const reply = await this.api.invoke('search:query', { text });
        if (sequence !== this.sequence) {
            return;
        }
        this.results = reply.results;
        this.index = 0;
        this.render(text, reply.truncated);
    }

    highlight(text, query) {
        const words = query.toLowerCase().split(/\s+/).filter(Boolean).map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        if (words.length === 0) {
            return [text];
        }
        return String(text)
            .split(new RegExp(`(${words.join('|')})`, 'giu'))
            .map((part, index) => (index % 2 === 1 ? Dom.el('mark', { text: part }) : part));
    }

    render(query, truncated) {
        if (this.results.length === 0) {
            this.note(this.t('search.empty'));
            return;
        }
        Dom.clear(this.list);
        let group = null;
        this.results.forEach((result, position) => {
            const name = result.kind === 'module' ? this.t('search.modules') : result.moduleTitle;
            if (name !== group) {
                group = name;
                this.list.append(Dom.el('div', { class: 'global-search-group', text: name }));
            }
            const item = Dom.el('button', { class: 'global-search-item' }, [
                Dom.el('span', { class: 'global-search-title' }, this.highlight(result.title, query)),
                ...(result.snippet ? [Dom.el('span', { class: 'global-search-snippet' }, this.highlight(result.snippet, query))] : [])
            ]);
            item.setAttribute('data-index', String(position));
            item.addEventListener('click', () => this.choose(result));
            this.list.append(item);
        });
        if (truncated) {
            this.list.append(Dom.el('div', { class: 'global-search-note', text: this.t('search.truncated') }));
        }
        this.mark();
    }

    mark() {
        for (const item of this.list.querySelectorAll('.global-search-item')) {
            const active = Number(item.getAttribute('data-index')) === this.index;
            item.classList.toggle('active', active);
            if (active && item.scrollIntoView) {
                item.scrollIntoView({ block: 'nearest' });
            }
        }
    }

    choose(result) {
        this.close();
        this.onOpen(result);
    }
}
