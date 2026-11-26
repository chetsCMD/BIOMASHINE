class FakeClassList {
    constructor(owner) {
        this.owner = owner;
    }

    names() {
        return this.owner.className.split(/\s+/).filter(Boolean);
    }

    add(...names) {
        this.owner.className = [...new Set([...this.names(), ...names])].join(' ');
    }

    remove(...names) {
        this.owner.className = this.names().filter((name) => !names.includes(name)).join(' ');
    }

    contains(name) {
        return this.names().includes(name);
    }

    toggle(name, force) {
        const on = force === undefined ? !this.contains(name) : force;
        if (on) {
            this.add(name);
        } else {
            this.remove(name);
        }
        return on;
    }
}

class FakeElement {
    constructor(id = '', tag = 'div') {
        this.id = id;
        this.tagName = tag.toUpperCase();
        this.children = [];
        this.listeners = {};
        this.style = { setProperty() {}, removeProperty() {} };
        this.dataset = {};
        this.className = '';
        this.textContent = '';
        this.value = '';
        this.innerHTML = '';
        this.checked = false;
        this.disabled = false;
        this.hidden = false;
        this.attributes = {};
        this.parentNode = null;
        this.classList = new FakeClassList(this);
    }

    setAttribute(name, value) {
        this.attributes[name] = String(value);
    }

    getAttribute(name) {
        return name in this.attributes ? this.attributes[name] : null;
    }

    removeAttribute(name) {
        delete this.attributes[name];
    }

    adopt(nodes) {
        nodes.forEach((node) => {
            if (typeof node === 'object') {
                node.parentNode = this;
            }
        });
    }

    append(...nodes) {
        this.adopt(nodes);
        this.children.push(...nodes);
    }

    appendChild(node) {
        this.append(node);
        return node;
    }

    prepend(...nodes) {
        this.adopt(nodes);
        this.children.unshift(...nodes);
    }

    replaceChildren(...nodes) {
        this.adopt(nodes);
        this.children = nodes;
    }

    removeChild(node) {
        this.children = this.children.filter((child) => child !== node);
        return node;
    }

    remove() {
        if (this.parentNode) {
            this.parentNode.removeChild(this);
        }
    }

    contains(node) {
        return node === this || this.children.some((child) => typeof child === 'object' && child.contains(node));
    }

    closest() {
        return null;
    }

    querySelector() {
        return null;
    }

    querySelectorAll() {
        return [];
    }

    addEventListener(type, handler) {
        (this.listeners[type] = this.listeners[type] || []).push(handler);
    }

    removeEventListener(type, handler) {
        this.listeners[type] = (this.listeners[type] || []).filter((item) => item !== handler);
    }

    async fire(type, event = {}) {
        for (const handler of this.listeners[type] || []) {
            await handler({ target: this, currentTarget: this, preventDefault() {}, stopPropagation() {}, ...event });
        }
    }

    focus() {}

    blur() {}

    click() {
        return this.fire('click');
    }

    scrollIntoView() {}

    getBoundingClientRect() {
        return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
    }

    getContext() {
        return {};
    }

    text() {
        return [this.textContent, ...this.children.map((child) => (typeof child === 'string' ? child : child.text()))].join(' ');
    }

    find(predicate, found = []) {
        for (const child of this.children) {
            if (typeof child === 'object') {
                if (predicate(child)) {
                    found.push(child);
                }
                child.find(predicate, found);
            }
        }
        return found;
    }
}

class FakeDocument {
    constructor() {
        this.elements = new Map();
        this.requestedIds = new Set();
        this.documentElement = new FakeElement('html');
        this.body = new FakeElement('body', 'body');
        this.head = new FakeElement('head', 'head');
        this.listeners = {};
        this.activeElement = null;
    }

    getElementById(id) {
        this.requestedIds.add(id);
        if (!this.elements.has(id)) {
            this.elements.set(id, new FakeElement(id));
        }
        return this.elements.get(id);
    }

    createElement(tag) {
        return new FakeElement('', tag);
    }

    createElementNS(namespace, tag) {
        return new FakeElement('', tag);
    }

    createTextNode(text) {
        return String(text);
    }

    createDocumentFragment() {
        return new FakeElement('', 'fragment');
    }

    querySelector() {
        return null;
    }

    querySelectorAll() {
        return [];
    }

    addEventListener(type, handler) {
        (this.listeners[type] = this.listeners[type] || []).push(handler);
    }

    removeEventListener(type, handler) {
        this.listeners[type] = (this.listeners[type] || []).filter((item) => item !== handler);
    }
}

class FakeChart {
    static instances = [];

    constructor(context, config) {
        this.config = config;
        this.destroyed = false;
        FakeChart.instances.push(this);
    }

    destroy() {
        this.destroyed = true;
    }
}

module.exports = { FakeElement, FakeDocument, FakeChart };
