import { Dom } from './Dom.js';
import { MenuLayout } from './MenuLayout.js';

export class Navigation {
    static SETTINGS_ID = 'settings';
    static HUB_ID = 'hub';

    constructor(root, i18n) {
        this.root = root;
        this.i18n = i18n;
        this.onReorder = null;
        this.onCollapseChanged = null;
        this.pages = [];
        this.activeId = null;
        this.mode = 'top';
        this.categories = [];
        this.collapsed = new Set();
        this.dragId = null;
        this.dropdown = null;
        this.dropdownAnchor = null;
        this.observer = null;
        this.cleanup = null;
    }

    setLayout({ mode, collapsed, categories } = {}) {
        this.mode = mode === 'sidebar' ? 'sidebar' : 'top';
        this.collapsed = new Set(Array.isArray(collapsed) ? collapsed : []);
        this.categories = Array.isArray(categories) ? categories : [];
        this.root.classList.toggle('nav-sidebar', this.mode === 'sidebar');
        this.draw();
    }

    observe() {
        if (typeof ResizeObserver === 'undefined' || !this.root) {
            return this;
        }
        this.observer = new ResizeObserver(() => this.draw());
        this.observer.observe(this.root);
        return this;
    }

    disconnect() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        this.closeDropdown();
    }

    render(pages, activeId) {
        this.pages = Array.isArray(pages) ? pages : [];
        this.activeId = activeId;
        this.draw();
    }

    draw() {
        if (this.mode === 'sidebar') {
            this.drawSidebar();
        } else {
            this.drawTop();
        }
    }

    pinnedPages() {
        return this.pages
            .filter((page) => page.pinned)
            .sort((a, b) => {
                const ao = typeof a.pinOrder === 'number' ? a.pinOrder : 0;
                const bo = typeof b.pinOrder === 'number' ? b.pinOrder : 0;
                return ao - bo;
            });
    }

    static categoryTitle(category, i18n) {
        if (!category) {
            return '';
        }
        if (category.builtin) {
            return category.titleKey ? i18n.t(category.titleKey) : category.id;
        }
        return category.name || category.id;
    }

    gap() {
        if (!this.root || typeof window === 'undefined' || !window.getComputedStyle) {
            return 0;
        }
        const style = window.getComputedStyle(this.root);
        const raw = style.columnGap || style.gap || '0';
        const value = parseFloat(raw);
        return Number.isFinite(value) ? value : 0;
    }

    drawTop() {
        this.closeDropdown();
        Dom.clear(this.root);
        const pinned = this.pinnedPages();
        const allIds = pinned.map((page) => page.id);
        const itemEls = [];
        for (const page of pinned) {
            const active = page.id === this.activeId;
            const el = Dom.el('a', {
                class: active ? 'nav-link active' : 'nav-link',
                href: `#module/${page.id}`,
                text: page.title || page.id
            });
            el.dataset.id = page.id;
            this.attachDrag(el, page.id, allIds);
            this.root.append(el);
            itemEls.push({ id: page.id, el, page });
        }
        const hubActive = this.activeId === Navigation.HUB_ID;
        const allModulesEl = Dom.el('a', {
            class: hubActive ? 'nav-link active nav-all-modules' : 'nav-link nav-all-modules',
            href: `#${Navigation.HUB_ID}`,
            text: this.i18n.t('nav.allModules')
        });
        const settingsActive = this.activeId === Navigation.SETTINGS_ID;
        const settingsEl = Dom.el('a', {
            class: settingsActive ? 'nav-link active nav-settings' : 'nav-link nav-settings',
            href: `#${Navigation.SETTINGS_ID}`,
            text: this.i18n.t('nav.settings')
        });
        this.root.append(allModulesEl);
        this.root.append(settingsEl);

        if (pinned.length === 0) {
            return;
        }

        const moreEl = Dom.el('button', {
            class: 'nav-link nav-more',
            type: 'button',
            text: this.i18n.t('nav.more')
        });
        this.root.insertBefore(moreEl, allModulesEl);

        const gap = this.gap();
        const available = this.root.clientWidth;
        const moreWidth = moreEl.offsetWidth;
        const settingsWidth = allModulesEl.offsetWidth + gap + settingsEl.offsetWidth;
        const items = itemEls.map((it) => ({ id: it.id, width: it.el.offsetWidth, page: it.page }));

        const layout = MenuLayout.fit(items, available, { gap, moreWidth, settingsWidth });

        if (!layout.needsMore) {
            moreEl.remove();
            return;
        }

        const overflowIds = new Set(layout.overflow.map((item) => item.id));
        for (const it of itemEls) {
            if (overflowIds.has(it.id)) {
                it.el.classList.add('hidden');
            }
        }
        if (layout.overflow.some((item) => item.id === this.activeId)) {
            moreEl.classList.add('has-active');
        }
        moreEl.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.toggleDropdown(moreEl, layout.overflow);
        });
    }

    drawSidebar() {
        this.closeDropdown();
        Dom.clear(this.root);

        const pinned = this.pinnedPages();
        const allIds = pinned.map((page) => page.id);

        if (pinned.length > 0) {
            const section = Dom.el('div', { class: 'nav-side-pinned' });
            for (const page of pinned) {
                const active = page.id === this.activeId;
                const el = Dom.el('a', {
                    class: active ? 'nav-side-item active' : 'nav-side-item',
                    href: `#module/${page.id}`,
                    text: page.title || page.id
                });
                el.dataset.id = page.id;
                this.attachDrag(el, page.id, allIds);
                section.append(el);
            }
            this.root.append(section);
        }

        const pinnedIds = new Set(pinned.map((p) => p.id));
        const unpinned = this.pages.filter((p) => !pinnedIds.has(p.id));
        const categories = Array.isArray(this.categories) ? this.categories : [];
        const grouped = new Map();
        for (const category of categories) {
            grouped.set(category.id, []);
        }
        const leftovers = [];
        for (const page of unpinned) {
            if (grouped.has(page.category)) {
                grouped.get(page.category).push(page);
            } else {
                leftovers.push(page);
            }
        }
        for (const category of categories) {
            const bucket = grouped.get(category.id);
            if (bucket && bucket.length > 0) {
                this.root.append(this.sidebarGroup(category, bucket));
            }
        }
        if (leftovers.length > 0) {
            this.root.append(this.sidebarGroup(
                { id: 'other', titleKey: 'category.other', builtin: true },
                leftovers
            ));
        }

        const footer = Dom.el('div', { class: 'nav-side-footer' });
        footer.append(Dom.el('a', {
            class: this.activeId === Navigation.HUB_ID ? 'nav-side-item nav-hub active' : 'nav-side-item nav-hub',
            href: `#${Navigation.HUB_ID}`,
            text: this.i18n.t('nav.allModules')
        }));
        footer.append(Dom.el('a', {
            class: this.activeId === Navigation.SETTINGS_ID ? 'nav-side-item nav-settings active' : 'nav-side-item nav-settings',
            href: `#${Navigation.SETTINGS_ID}`,
            text: this.i18n.t('nav.settings')
        }));
        this.root.append(footer);
    }

    sidebarGroup(category, modules) {
        const collapsed = this.collapsed.has(category.id);
        const title = Navigation.categoryTitle(category, this.i18n);
        const section = Dom.el('div', { class: collapsed ? 'nav-side-group collapsed' : 'nav-side-group' });
        const toggle = Dom.el('button', {
            class: 'nav-side-group-toggle',
            type: 'button',
            'aria-expanded': collapsed ? 'false' : 'true'
        });
        toggle.append(
            Dom.el('span', { class: 'nav-side-group-title', text: title }),
            Dom.el('span', { class: 'nav-side-group-arrow', text: collapsed ? '▸' : '▾' })
        );
        toggle.addEventListener('click', () => {
            const next = new Set(this.collapsed);
            if (next.has(category.id)) {
                next.delete(category.id);
            } else {
                next.add(category.id);
            }
            this.collapsed = next;
            if (this.onCollapseChanged) {
                this.onCollapseChanged([...next]);
            }
            this.draw();
        });
        section.append(toggle);
        if (!collapsed) {
            const items = Dom.el('div', { class: 'nav-side-group-items' });
            for (const page of modules) {
                const active = page.id === this.activeId;
                items.append(Dom.el('a', {
                    class: active ? 'nav-side-item active' : 'nav-side-item',
                    href: `#module/${page.id}`,
                    text: page.title || page.id
                }));
            }
            section.append(items);
        }
        return section;
    }

    attachDrag(el, id, allIds) {
        el.draggable = true;
        el.addEventListener('dragstart', (event) => {
            this.dragId = id;
            el.classList.add('dragging');
            if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = 'move';
                try {
                    event.dataTransfer.setData('text/plain', id);
                } catch (error) {
                    return;
                }
            }
        });
        el.addEventListener('dragend', () => {
            this.dragId = null;
            el.classList.remove('dragging');
            this.root.querySelectorAll('.drag-over').forEach((node) => node.classList.remove('drag-over'));
        });
        el.addEventListener('dragover', (event) => {
            if (!this.dragId || this.dragId === id) {
                return;
            }
            event.preventDefault();
            if (event.dataTransfer) {
                event.dataTransfer.dropEffect = 'move';
            }
            el.classList.add('drag-over');
        });
        el.addEventListener('dragleave', () => {
            el.classList.remove('drag-over');
        });
        el.addEventListener('drop', (event) => {
            event.preventDefault();
            el.classList.remove('drag-over');
            const dragged = this.dragId;
            this.dragId = null;
            if (!dragged || dragged === id) {
                return;
            }
            const next = Navigation.reorder(dragged, id, allIds);
            if (this.onReorder) {
                this.onReorder(next);
            }
        });
    }

    static reorder(draggedId, targetId, ids) {
        const rest = ids.filter((x) => x !== draggedId);
        const at = rest.indexOf(targetId);
        const insertAt = at >= 0 ? at : rest.length;
        return [...rest.slice(0, insertAt), draggedId, ...rest.slice(insertAt)];
    }

    toggleDropdown(anchor, overflow) {
        if (this.dropdown) {
            this.closeDropdown();
            return;
        }
        this.openDropdown(anchor, overflow);
    }

    openDropdown(anchor, overflow) {
        this.closeDropdown();
        const rect = anchor.getBoundingClientRect();
        const dropdown = Dom.el('div', { class: 'nav-dropdown' });
        for (const item of overflow) {
            const page = item.page || this.pages.find((p) => p.id === item.id);
            const active = item.id === this.activeId;
            const link = Dom.el('a', {
                class: `nav-dropdown-item${active ? ' active' : ''}`,
                href: `#module/${item.id}`,
                text: page ? page.title : item.id
            });
            link.addEventListener('click', () => this.closeDropdown());
            dropdown.append(link);
        }
        dropdown.append(Dom.el('div', { class: 'nav-dropdown-sep' }));
        const allActive = this.activeId === Navigation.HUB_ID;
        const all = Dom.el('a', {
            class: `nav-dropdown-item nav-dropdown-all${allActive ? ' active' : ''}`,
            href: `#${Navigation.HUB_ID}`,
            text: this.i18n.t('nav.allModules')
        });
        all.addEventListener('click', () => this.closeDropdown());
        dropdown.append(all);
        dropdown.style.position = 'fixed';
        dropdown.style.top = `${rect.bottom + 4}px`;
        dropdown.style.right = `${window.innerWidth - rect.right}px`;
        document.body.append(dropdown);
        anchor.classList.add('open');
        this.dropdown = dropdown;
        this.dropdownAnchor = anchor;
        const onDocClick = (event) => {
            if (!anchor.contains(event.target) && !dropdown.contains(event.target)) {
                this.closeDropdown();
            }
        };
        const onKey = (event) => {
            if (event.key === 'Escape') {
                this.closeDropdown();
            }
        };
        document.addEventListener('click', onDocClick);
        document.addEventListener('keydown', onKey);
        this.cleanup = () => {
            document.removeEventListener('click', onDocClick);
            document.removeEventListener('keydown', onKey);
        };
    }

    closeDropdown() {
        if (this.cleanup) {
            this.cleanup();
            this.cleanup = null;
        }
        if (this.dropdown) {
            this.dropdown.remove();
            this.dropdown = null;
        }
        if (this.dropdownAnchor) {
            this.dropdownAnchor.classList.remove('open');
            this.dropdownAnchor = null;
        }
    }
}
