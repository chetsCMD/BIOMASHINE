export class CanvasKeys {
    static ID = /^[A-Za-z][A-Za-z0-9_-]*$/;

    static index(element) {
        let index = 1;
        for (let sibling = element.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
            if (sibling.tagName === element.tagName) {
                index += 1;
            }
        }
        return index;
    }

    static unique(element, doc) {
        return Boolean(element.id) && CanvasKeys.ID.test(element.id) && doc.querySelectorAll(`[id="${element.id}"]`).length === 1;
    }

    static keyFor(element, root, doc) {
        const parts = [];
        for (let node = element; node; node = node.parentElement) {
            const marker = node.getAttribute ? node.getAttribute('data-bm-block') : null;
            if (marker && CanvasKeys.ID.test(marker)) {
                parts.unshift(`@${marker}`);
                return parts.join('>');
            }
            if (CanvasKeys.unique(node, doc)) {
                parts.unshift(`#${node.id}`);
                return parts.join('>');
            }
            if (node === root) {
                parts.unshift('~');
                return parts.join('>');
            }
            parts.unshift(`${node.tagName.toLowerCase()}:${CanvasKeys.index(node)}`);
        }
        return null;
    }

    static resolve(key, root, doc) {
        const [head, ...rest] = key.split('>');
        let node = null;
        if (head === '~') {
            node = root;
        } else if (head.startsWith('#')) {
            node = doc.getElementById(head.slice(1));
        } else if (head.startsWith('@')) {
            node = doc.querySelector(`[data-bm-block="${head.slice(1)}"]`);
        }
        for (const part of rest) {
            if (!node) {
                return null;
            }
            const [tag, number] = part.split(':');
            let count = 0;
            let found = null;
            for (const child of node.children) {
                if (child.tagName.toLowerCase() === tag) {
                    count += 1;
                    if (count === Number(number)) {
                        found = child;
                        break;
                    }
                }
            }
            node = found;
        }
        return node;
    }
}
