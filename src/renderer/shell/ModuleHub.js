import { Dom } from './Dom.js';
import { TextSearch } from './TextSearch.js';

export class ModuleHub {
    constructor({ root, api, i18n, onChanged }) {
        this.root = root;
        this.api = api;
        this.i18n = i18n;
        this.onChanged = onChanged;
        this.modules = [];
        this.categories = [];
        this.query = '';
        this.filterCategory = null;
        this.groupsRoot = null;
        this.chipRoot = null;
    }

    static categoryById(categories, id) {
        if (!Array.isArray(categories)) {
            return null;
        }
        return categories.find((category) => category.id === id) || null;
    }

    static categoryTitle(category, i18n) {
        if (!category) {
            return '';
        }
        if (category.builtin) {
            if (category.titleKey) {
                return i18n.t(category.titleKey);
            }
            return category.id;
        }
        return category.name || category.id;
    }

    static filterModules(modules, categories, options = {}) {
        const query = typeof options.query === 'string' ? options.query : '';
        const category = options.category || null;
        let result = Array.isArray(modules) ? modules.slice() : [];
        if (category) {
            result = result.filter((module) => module.category === category);
        }
        if (query.trim()) {
            result = TextSearch.filter(result, query, (module) => [
                module.title || '',
                module.description || '',
                module.id || ''
            ]);
        }
        return result;
    }

    static group(modules, categories) {
        const list = Array.isArray(categories) ? categories : [];
        const items = Array.isArray(modules) ? modules : [];
        const known = new Set();
        const byCategory = new Map();
        for (const category of list) {
            known.add(category.id);
            byCategory.set(category.id, []);
        }
        const leftovers = [];
        for (const module of items) {
            if (known.has(module.category)) {
                byCategory.get(module.category).push(module);
            } else {
                leftovers.push(module);
            }
        }
        const groups = [];
        for (const category of list) {
            const bucket = byCategory.get(category.id);
            if (bucket.length > 0) {
                groups.push({ category, modules: bucket });
            }
        }
        if (leftovers.length > 0) {
            groups.push({
                category: { id: 'other', titleKey: 'category.other', builtin: true },
                modules: leftovers
            });
        }
        return groups;
    }

    async render() {
        await this.load();
        this.draw();
    }

    async load() {
        this.modules = await this.api.invoke('modules:list');
        this.categories = await this.api.invoke('modules:categories');
    }

    draw() {
        Dom.clear(this.root);
        const hub = Dom.el('div', { class: 'hub' });
        hub.append(this.buildToolbar());
        this.groupsRoot = Dom.el('div', { class: 'hub-groups' });
        hub.append(this.groupsRoot);
        hub.append(this.buildCategoryManager());
        this.root.append(hub);
        this.drawGroups();
    }

    buildToolbar() {
        const toolbar = Dom.el('div', { class: 'hub-toolbar' });
        const search = Dom.el('input', {
            class: 'hub-search',
            type: 'search',
            placeholder: this.i18n.t('hub.search')
        });
        search.value = this.query;
        search.addEventListener('input', (event) => {
            this.query = event.target.value;
            this.drawGroups();
        });
        const chips = Dom.el('div', { class: 'hub-filters' });
        this.chipRoot = chips;
        chips.append(this.buildChip('', this.i18n.t('hub.filter.all')));
        for (const category of this.categories) {
            chips.append(this.buildChip(category.id, ModuleHub.categoryTitle(category, this.i18n)));
        }
        toolbar.append(search, chips);
        return toolbar;
    }

    buildChip(id, title) {
        const active = (id === '' && this.filterCategory === null) || (id !== '' && id === this.filterCategory);
        const chip = Dom.el('button', {
            class: active ? 'hub-chip active' : 'hub-chip',
            type: 'button',
            text: title
        });
        chip.dataset.category = id;
        chip.addEventListener('click', () => {
            this.filterCategory = id || null;
            this.updateChips();
            this.drawGroups();
        });
        return chip;
    }

    updateChips() {
        if (!this.chipRoot) {
            return;
        }
        for (const chip of this.chipRoot.querySelectorAll('.hub-chip')) {
            const id = chip.dataset.category || '';
            const active = (id === '' && this.filterCategory === null) || (id !== '' && id === this.filterCategory);
            chip.classList.toggle('active', active);
        }
    }

    drawGroups() {
        if (!this.groupsRoot) {
            return;
        }
        Dom.clear(this.groupsRoot);
        const visible = ModuleHub.filterModules(this.modules, this.categories, {
            query: this.query,
            category: this.filterCategory
        });
        const groups = ModuleHub.group(visible, this.categories);
        if (groups.length === 0) {
            this.groupsRoot.append(Dom.el('p', { class: 'hub-empty', text: this.i18n.t('hub.empty') }));
            return;
        }
        for (const group of groups) {
            this.groupsRoot.append(this.renderGroup(group));
        }
    }

    renderGroup(group) {
        const section = Dom.el('section', { class: 'hub-group' });
        section.append(Dom.el('h3', {
            class: 'hub-group-title',
            text: ModuleHub.categoryTitle(group.category, this.i18n)
        }));
        const cards = Dom.el('div', { class: 'hub-cards' });
        for (const module of group.modules) {
            cards.append(this.renderCard(module));
        }
        section.append(cards);
        return section;
    }

    renderCard(module) {
        const category = ModuleHub.categoryById(this.categories, module.category);
        const categoryTitle = category ? ModuleHub.categoryTitle(category, this.i18n) : module.category;
        const card = Dom.el('article', { class: 'hub-card' });

        const header = Dom.el('header', { class: 'hub-card-header' });
        header.append(Dom.el('h4', { class: 'hub-card-title', text: module.title }));
        header.append(Dom.el('span', { class: 'hub-card-badge', text: categoryTitle }));
        header.append(Dom.el('span', {
            class: module.source === 'user' ? 'hub-card-tag user' : 'hub-card-tag system',
            text: this.i18n.t(module.source === 'user' ? 'settings.tag.user' : 'settings.tag.system')
        }));

        const description = Dom.el('p', { class: 'hub-card-desc', text: module.description || '' });

        const actions = Dom.el('footer', { class: 'hub-card-actions' });
        if (module.kind === 'page') {
            const pin = Dom.el('button', {
                class: 'hub-action',
                type: 'button',
                text: this.i18n.t(module.pinned ? 'hub.unpin' : 'hub.pin')
            });
            pin.addEventListener('click', () => this.setPinned(module.id, !module.pinned));
            actions.append(pin);
        }
        actions.append(this.buildCategorySelect(module));
        const hide = Dom.el('button', {
            class: 'hub-action',
            type: 'button',
            text: this.i18n.t(module.hidden ? 'hub.unhide' : 'hub.hide')
        });
        hide.addEventListener('click', () => this.setHidden(module.id, !module.hidden));
        actions.append(hide);

        card.append(header, description, actions);
        return card;
    }

    buildCategorySelect(module) {
        const label = this.i18n.t('hub.category');
        const select = Dom.el('select', { class: 'hub-action-select' });
        select.title = label;
        select.setAttribute('aria-label', label);
        const reset = Dom.el('option', { value: '', text: this.i18n.t('hub.categoryReset') });
        select.append(reset);
        for (const category of this.categories) {
            const option = Dom.el('option', {
                value: category.id,
                text: ModuleHub.categoryTitle(category, this.i18n)
            });
            if (category.id === module.category) {
                option.selected = true;
            }
            select.append(option);
        }
        select.addEventListener('change', () => {
            const value = select.value || null;
            this.setCategory(module.id, value);
        });
        return select;
    }

    buildCategoryManager() {
        const section = Dom.el('section', { class: 'hub-categories' });
        section.append(Dom.el('h3', {
            class: 'hub-section-title',
            text: this.i18n.t('hub.categoryManage')
        }));
        const list = Dom.el('ul', { class: 'hub-category-list' });
        for (const category of this.categories) {
            const item = Dom.el('li', { class: 'hub-category-item' });
            item.append(Dom.el('span', {
                class: 'hub-category-name',
                text: ModuleHub.categoryTitle(category, this.i18n)
            }));
            if (category.builtin) {
                item.append(Dom.el('span', {
                    class: 'hub-category-tag',
                    text: this.i18n.t('hub.categoryBuiltin')
                }));
            } else {
                const remove = Dom.el('button', {
                    class: 'hub-action danger',
                    type: 'button',
                    text: this.i18n.t('hub.categoryRemove')
                });
                remove.addEventListener('click', () => this.removeCategory(category.id));
                item.append(remove);
            }
            list.append(item);
        }
        section.append(list);
        const form = Dom.el('form', { class: 'hub-category-form' });
        const input = Dom.el('input', {
            class: 'hub-input',
            type: 'text',
            maxlength: '40',
            placeholder: this.i18n.t('hub.categoryName')
        });
        const submit = Dom.el('button', {
            class: 'hub-action',
            type: 'submit',
            text: this.i18n.t('hub.categoryCreate')
        });
        form.append(input, submit);
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            const name = input.value.trim();
            if (name) {
                this.createCategory(name);
                input.value = '';
            }
        });
        section.append(form);
        return section;
    }

    commit(list) {
        this.modules = list;
        this.drawGroups();
        if (this.onChanged) {
            this.onChanged(list);
        }
    }

    async setPinned(id, pinned) {
        try {
            const list = await this.api.invoke('modules:setPinned', { id, pinned });
            this.commit(list);
        } catch (error) {
            return;
        }
    }

    async setHidden(id, hidden) {
        try {
            const list = await this.api.invoke('modules:setHidden', { id, hidden });
            this.commit(list);
        } catch (error) {
            return;
        }
    }

    async setCategory(id, category) {
        try {
            const list = await this.api.invoke('modules:setCategory', { id, category });
            this.commit(list);
        } catch (error) {
            return;
        }
    }

    async createCategory(name) {
        try {
            await this.api.invoke('modules:createCategory', { name });
            this.categories = await this.api.invoke('modules:categories');
            this.draw();
        } catch (error) {
            return;
        }
    }

    async removeCategory(id) {
        try {
            const list = await this.api.invoke('modules:removeCategory', { id });
            this.categories = await this.api.invoke('modules:categories');
            this.commit(list);
            this.draw();
        } catch (error) {
            return;
        }
    }
}
