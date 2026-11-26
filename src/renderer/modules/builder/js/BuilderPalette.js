export class BuilderPalette {
    static GROUPS = { static: 'group.static', input: 'group.input', data: 'group.data' };

    constructor({ bm, doc, groups, onPick }) {
        this.bm = bm;
        this.doc = doc;
        this.groups = groups;
        this.onPick = onPick;
    }

    title(manifest) {
        const title = manifest.title;
        return typeof title === 'string' ? title : title[this.bm.language] || title.en;
    }

    render(manifests) {
        const root = this.doc.createElement('div');
        root.className = 'builder-side';
        const heading = this.doc.createElement('div');
        heading.className = 'bm-title';
        heading.textContent = this.bm.t('palette.title');
        root.append(heading);
        for (const group of this.groups) {
            const section = this.doc.createElement('div');
            section.className = 'builder-group';
            const caption = this.doc.createElement('div');
            caption.className = 'bm-muted';
            const labelKey = BuilderPalette.GROUPS[group];
            caption.textContent = labelKey ? this.bm.t(labelKey) : group;
            section.append(caption);
            for (const manifest of manifests.filter((item) => item.group === group)) {
                const button = this.doc.createElement('button');
                button.className = 'bm-btn secondary';
                button.textContent = this.title(manifest);
                button.addEventListener('click', () => this.onPick(manifest));
                section.append(button);
            }
            root.append(section);
        }
        return root;
    }
}
