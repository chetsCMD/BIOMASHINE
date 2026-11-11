export class MenuLayout {
    static fit(items, availableWidth, options = {}) {
        const gap = Number.isFinite(options.gap) ? options.gap : 0;
        const moreWidth = Number.isFinite(options.moreWidth) ? options.moreWidth : 0;
        const settingsWidth = Number.isFinite(options.settingsWidth) ? options.settingsWidth : 0;
        const list = Array.isArray(items) ? items : [];
        const n = list.length;
        if (n === 0) {
            return { visible: [], overflow: [], needsMore: false };
        }
        let allNeeded = settingsWidth + gap * n;
        for (const item of list) {
            allNeeded += item.width || 0;
        }
        if (allNeeded <= availableWidth) {
            return { visible: [...list], overflow: [], needsMore: false };
        }
        let k = 0;
        let sum = 0;
        for (let i = 0; i < n; i += 1) {
            const candidate = sum + (list[i].width || 0) + moreWidth + settingsWidth + gap * (i + 2);
            if (candidate <= availableWidth) {
                sum += list[i].width || 0;
                k = i + 1;
            } else {
                break;
            }
        }
        return {
            visible: list.slice(0, k),
            overflow: list.slice(k),
            needsMore: true
        };
    }
}
