export class CanvasGeometry {
    static snap(value, step) {
        return step > 0 ? Math.round(value / step) * step : value;
    }

    static clamp(rect, bounds, limits) {
        const w = Math.min(Math.max(rect.w, limits.minWidthPx), bounds.width);
        const h = Math.min(Math.max(rect.h, limits.minHeightPx), limits.maxHeightPx);
        const x = Math.min(Math.max(rect.x, 0), bounds.width - w);
        const y = Math.min(Math.max(rect.y, 0), limits.maxHeightPx - h);
        return { x, y, w, h };
    }

    static clampPosition(rect, bounds, limits) {
        const x = Math.min(Math.max(rect.x, 0), Math.max(bounds.width - rect.w, 0));
        const y = Math.min(Math.max(rect.y, 0), Math.max(limits.maxHeightPx - rect.h, 0));
        return { ...rect, x, y };
    }

    static move(rect, dx, dy, bounds, limits, snap = true) {
        const moved = { ...rect, x: rect.x + dx, y: rect.y + dy };
        if (snap) {
            moved.x = CanvasGeometry.snap(moved.x, limits.snapPx);
            moved.y = CanvasGeometry.snap(moved.y, limits.snapPx);
        }
        return CanvasGeometry.clampPosition(moved, bounds, limits);
    }

    static resize(rect, handle, dx, dy, bounds, limits, snap = true) {
        let left = rect.x;
        let top = rect.y;
        let right = rect.x + rect.w;
        let bottom = rect.y + rect.h;
        const grid = (value) => (snap ? CanvasGeometry.snap(value, limits.snapPx) : value);
        if (handle.includes('w')) left = grid(left + dx);
        if (handle.includes('e')) right = grid(right + dx);
        if (handle.includes('n')) top = grid(top + dy);
        if (handle.includes('s')) bottom = grid(bottom + dy);
        if (right - left < limits.minWidthPx) {
            if (handle.includes('w')) left = right - limits.minWidthPx;
            else right = left + limits.minWidthPx;
        }
        if (bottom - top < limits.minHeightPx) {
            if (handle.includes('n')) top = bottom - limits.minHeightPx;
            else bottom = top + limits.minHeightPx;
        }
        left = Math.max(left, 0);
        top = Math.max(top, 0);
        right = Math.min(right, bounds.width);
        bottom = Math.min(bottom, limits.maxHeightPx);
        return CanvasGeometry.clamp({ x: left, y: top, w: right - left, h: bottom - top }, bounds, limits);
    }

    static nudge(rect, key, bounds, limits, large = false) {
        const step = limits.snapPx * (large ? limits.nudgeLargeFactor : 1);
        const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[key];
        return delta ? CanvasGeometry.move(rect, delta[0], delta[1], bounds, limits, false) : rect;
    }

    static rectOf(natural, item) {
        return { x: natural.x + (item.dx || 0), y: natural.y + (item.dy || 0), w: item.w || natural.w, h: item.h || natural.h };
    }

    static itemFromRect(natural, rect) {
        const item = { dx: Math.round(rect.x - natural.x), dy: Math.round(rect.y - natural.y) };
        if (Math.round(rect.w) !== Math.round(natural.w)) item.w = Math.round(rect.w);
        if (Math.round(rect.h) !== Math.round(natural.h)) item.h = Math.round(rect.h);
        return item;
    }

    static toLayout(rect, rootWidth, precision) {
        const factor = 10 ** precision;
        const round = (value) => Math.round(value * factor) / factor;
        return { x: round(rect.x / rootWidth), y: Math.round(rect.y), w: round(rect.w / rootWidth), h: Math.round(rect.h) };
    }

    static fromLayout(entry, rootWidth) {
        return { x: Math.round(entry.x * rootWidth), y: entry.y, w: Math.round(entry.w * rootWidth), h: entry.h };
    }

    static reorder(blocks, id, toFront) {
        const order = Object.keys(blocks)
            .sort((a, b) => (blocks[a].z || 0) - (blocks[b].z || 0) || a.localeCompare(b))
            .filter((key) => key !== id);
        if (toFront) order.push(id);
        else order.unshift(id);
        const result = {};
        order.forEach((key, index) => {
            result[key] = { ...blocks[key], z: index };
        });
        return result;
    }

    static contentBottom(blocks) {
        return Object.values(blocks).reduce((bottom, block) => (block.hidden ? bottom : Math.max(bottom, block.y + block.h)), 0);
    }
}
