export class PageText {
    static HIDDEN = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);

    static collect(doc, limits) {
        const lines = new Set();
        const add = (text) => {
            const line = String(text).replace(/\s+/g, ' ').trim();
            if (line.length >= limits.minLine && lines.size < limits.maxLines) {
                lines.add(line.slice(0, limits.maxLine));
            }
        };
        const walker = doc.createTreeWalker(doc.body, doc.defaultView.NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const parent = node.parentElement;
            if (parent && !PageText.HIDDEN.has(parent.tagName) && !parent.closest('[data-bm-canvas-ui]') && parent.getClientRects().length > 0) {
                add(node.nodeValue);
            }
        }
        for (const element of doc.querySelectorAll('[title], [aria-label], [placeholder]')) {
            if (!element.closest('[data-bm-canvas-ui]')) {
                add(element.getAttribute('title') || element.getAttribute('aria-label') || element.getAttribute('placeholder'));
            }
        }
        return [...lines];
    }
}
