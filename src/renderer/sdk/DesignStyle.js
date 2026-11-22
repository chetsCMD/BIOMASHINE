export class DesignStyle {
    static OVERRIDES_ID = 'bm-design-overrides';
    static CUSTOM_ID = 'bm-custom';

    static css(tokens) {
        const lines = Object.entries(tokens || {}).map(([name, value]) => `  --${name}: ${value};`);
        return lines.length > 0 ? `:root {\n${lines.join('\n')}\n}\n` : '';
    }

    static place(doc, id, text) {
        let style = doc.getElementById(id);
        if (!style) {
            style = doc.createElement('style');
            style.id = id;
        }
        style.textContent = text;
        doc.head.append(style);
    }

    static apply(doc, tokens, customCss) {
        DesignStyle.place(doc, DesignStyle.OVERRIDES_ID, DesignStyle.css(tokens));
        DesignStyle.place(doc, DesignStyle.CUSTOM_ID, customCss || '');
    }

    static raise(doc) {
        for (const id of [DesignStyle.OVERRIDES_ID, DesignStyle.CUSTOM_ID]) {
            const style = doc.getElementById(id);
            if (style) {
                doc.head.append(style);
            }
        }
    }
}
