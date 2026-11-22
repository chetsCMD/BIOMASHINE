import { DesignStyle } from '../sdk/DesignStyle.js';

export class DesignRuntime {
    constructor({ api, doc }) {
        this.api = api;
        this.doc = doc;
    }

    async forModule(id) {
        const [design, css] = await Promise.all([this.api.invoke('design:get', { module: id }), this.api.invoke('design:getCss', { module: id })]);
        return { tokens: design.effective, customCss: css.effective };
    }

    async load() {
        const data = await this.forModule(null);
        DesignStyle.apply(this.doc, data.tokens, data.customCss);
    }
}
