import { Dom } from './Dom.js';

export class Splitter {
    constructor({ ratio, initial, onRatio } = {}) {
        this.ratio = ratio;
        this.currentRatio = ratio.clamp(initial);
        this.onRatio = onRatio;
        this.cleanup = null;
        this.element = Dom.el('div', {
            class: 'mv-splitter',
            role: 'separator',
            'aria-orientation': 'vertical'
        });
        this.element.addEventListener('mousedown', (event) => this.start(event));
    }

    start(event) {
        if (event.button !== 0) {
            return;
        }
        const parent = this.element.parentElement;
        if (!parent) {
            return;
        }
        const rect = parent.getBoundingClientRect();
        if (rect.width <= 0) {
            return;
        }
        event.preventDefault();
        const startX = event.clientX;
        const startRatio = this.currentRatio;
        document.body.classList.add('mv-dragging');
        const onMove = (moveEvent) => {
            const next = this.ratio.fromDelta(startRatio, moveEvent.clientX - startX, rect.width);
            this.currentRatio = next;
            if (this.onRatio) {
                this.onRatio(next);
            }
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.body.classList.remove('mv-dragging');
            this.cleanup = null;
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        this.cleanup = onUp;
    }

    destroy() {
        if (this.cleanup) {
            this.cleanup();
        }
        this.element.remove();
    }
}
