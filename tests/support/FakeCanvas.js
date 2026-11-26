class FakeStyle {
    constructor() {
        this.map = new Map();
    }
    setProperty(name, value, priority = '') {
        this.map.set(name, { value: String(value), priority });
    }
    getPropertyValue(name) {
        return this.map.has(name) ? this.map.get(name).value : '';
    }
    removeProperty(name) {
        this.map.delete(name);
    }
}

class FakeNode {
    constructor(tag, attrs = {}, children = [], box = { x: 0, y: 0, w: 100, h: 40 }) {
        this.tagName = tag.toUpperCase();
        this.attrs = attrs;
        this.id = attrs.id || '';
        this.children = children;
        this.parentElement = null;
        this.style = new FakeStyle();
        this.box = box;
        this.isConnected = true;
        this.text = attrs.text || '';
        children.forEach((child) => (child.parentElement = this));
    }
    getAttribute(name) {
        return name in this.attrs ? this.attrs[name] : null;
    }
    get previousElementSibling() {
        if (!this.parentElement) return null;
        const list = this.parentElement.children;
        const index = list.indexOf(this);
        return index > 0 ? list[index - 1] : null;
    }
    get textContent() {
        return this.text + this.children.map((child) => child.textContent).join('');
    }
    set textContent(value) {
        this.text = String(value);
        this.children = [];
    }
    closest(selector) {
        for (let node = this; node; node = node.parentElement) {
            if (selector === '[data-bm-canvas-ui]' && node.attrs['data-bm-canvas-ui'] !== undefined) return node;
        }
        return null;
    }
    getBoundingClientRect() {
        const translate = this.style.getPropertyValue('translate').match(/(-?\d+)px (-?\d+)px/);
        const width = parseInt(this.style.getPropertyValue('width'), 10);
        const height = parseInt(this.style.getPropertyValue('height'), 10);
        const x = this.box.x + (translate ? Number(translate[1]) : 0);
        const y = this.box.y + (translate ? Number(translate[2]) : 0);
        const w = Number.isNaN(width) ? this.box.w : width;
        const h = Number.isNaN(height) ? this.box.h : height;
        return { left: x, top: y, right: x + w, bottom: y + h, width: w, height: h };
    }
    all() {
        return [this, ...this.children.flatMap((child) => child.all())];
    }
}

function createEnvironment(tree) {
    const body = tree;
    const callbacks = [];
    const doc = {
        body,
        documentElement: { clientWidth: 1000 },
        getElementById: (id) => body.all().find((node) => node.id === id) || null,
        querySelector: (selector) => {
            if (selector === 'body') return body;
            const match = selector.match(/\[data-bm-block="(.+)"\]/);
            return match ? body.all().find((node) => node.attrs['data-bm-block'] === match[1]) || null : null;
        },
        querySelectorAll: (selector) => {
            const match = selector.match(/\[id="(.+)"\]/);
            return match ? body.all().filter((node) => node.id === match[1]) : [];
        },
        elementsFromPoint: (x, y) =>
            body
                .all()
                .filter((node) => {
                    const rect = node.getBoundingClientRect();
                    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
                })
                .reverse()
    };
    const win = {
        document: doc,
        scrollX: 0,
        scrollY: 0,
        MutationObserver: class {
            constructor(callback) {
                callbacks.push(callback);
            }
            observe() {}
            disconnect() {}
        },
        requestAnimationFrame: (callback) => {
            callback();
            return 1;
        },
        getComputedStyle: () => ({ display: 'block', position: 'static' })
    };
    return { win, doc, mutate: () => callbacks.forEach((callback) => callback()) };
}

module.exports = { FakeNode, createEnvironment };
