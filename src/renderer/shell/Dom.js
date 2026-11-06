export class Dom {
    static el(tag, props = {}, children = []) {
        const node = document.createElement(tag);
        for (const [key, value] of Object.entries(props)) {
            if (key === 'class') {
                node.className = value;
            } else if (key === 'text') {
                node.textContent = value;
            } else if (key.startsWith('on')) {
                node.addEventListener(key.slice(2).toLowerCase(), value);
            } else if (value === true) {
                node.setAttribute(key, '');
            } else if (value !== false && value !== null && value !== undefined) {
                node.setAttribute(key, value);
            }
        }
        for (const child of [].concat(children)) {
            if (child !== null && child !== undefined && child !== false) {
                node.append(child);
            }
        }
        return node;
    }

    static clear(node) {
        node.replaceChildren();
        return node;
    }
}
