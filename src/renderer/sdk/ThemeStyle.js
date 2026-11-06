export class ThemeStyle {
    static ID = 'bm-theme';

    static css(theme) {
        const lines = Object.entries(theme.variables).map(([name, value]) => `  ${name}: ${value};`);
        lines.push(`  --color-scheme: ${theme.colorScheme};`, `  color-scheme: ${theme.colorScheme};`);
        return `:root {\n${lines.join('\n')}\n}\n`;
    }

    static apply(doc, theme) {
        let style = doc.getElementById(ThemeStyle.ID);
        if (!style) {
            style = doc.createElement('style');
            style.id = ThemeStyle.ID;
            doc.head.append(style);
        }
        style.textContent = ThemeStyle.css(theme);
        doc.documentElement.dataset.theme = theme.name;
    }
}
