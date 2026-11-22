const fs = require('fs');
const postcss = require('postcss');
const valueParser = require('postcss-value-parser');

class DesignTool {
    static COLOR_NAMES = new Set([
        'white', 'black', 'red', 'green', 'blue', 'yellow', 'orange', 'purple', 'pink', 'gray', 'grey', 'silver', 'gold', 'cyan', 'magenta', 'brown',
        'navy', 'teal', 'lime', 'maroon', 'olive', 'aqua', 'fuchsia', 'crimson', 'coral', 'indigo', 'violet', 'tomato', 'salmon', 'khaki'
    ]);
    static COLOR_FUNCTIONS = new Set(['rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch']);
    static WHOLE_VALUE = { 'box-shadow': 'shadow', 'text-shadow': 'shadow', filter: 'effect', 'backdrop-filter': 'effect' };
    static UNITLESS = { 'font-weight': 'font-weight', 'z-index': 'z', opacity: 'opacity', 'line-height': 'line-height' };
    static ALLOWED_PERCENT = new Set([0, 50, 100]);
    static LENGTH_UNITS = new Set(['px', 'rem', 'em', 'ch', 'ex', 'pt', 'vh', 'vw', 'vmin', 'vmax']);

    constructor(tokens = {}) {
        this.tokens = { ...tokens };
        this.added = {};
    }

    static slug(number) {
        return String(number).replace('-', 'n').replace('.', 'p');
    }

    static canonColor(text) {
        return String(text).toLowerCase().replace(/\s+/g, '');
    }

    static groupFor(prop, unit) {
        const name = prop.toLowerCase();
        if (unit === 'deg') return 'angle';
        if (['vh', 'vw', 'vmin', 'vmax'].includes(unit)) return 'viewport';
        if (name === 'font-size') return 'font-size';
        if (name === 'letter-spacing' || name === 'word-spacing') return 'tracking';
        if (name === 'line-height') return 'line-height';
        if (/radius$/.test(name)) return 'radius';
        if (/^(border|outline)/.test(name)) return 'border';
        if (/^(margin|padding|gap|row-gap|column-gap|grid-gap|inset|top|right|bottom|left)/.test(name)) return 'space';
        if (/^(transform|translate|offset)/.test(name)) return 'distance';
        return 'size';
    }

    sequential(group, value) {
        for (const [name, existing] of Object.entries(this.tokens)) {
            if (name.startsWith(`${group}-`) && DesignTool.canonColor(existing) === DesignTool.canonColor(value)) return name;
        }
        const used = Object.keys(this.tokens).filter((name) => name.startsWith(`${group}-`) && /^\d+$/.test(name.slice(group.length + 1))).length;
        return `${group}-${used + 1}`;
    }

    token(name, value) {
        if (this.tokens[name] === undefined) {
            this.tokens[name] = value;
            this.added[name] = value;
        }
        return name;
    }

    describe(node, prop, state) {
        const lower = prop.toLowerCase();
        if (node.type === 'word') {
            const value = node.value;
            if (/^#[0-9a-fA-F]{3,8}$/.test(value)) {
                const canon = DesignTool.canonColor(value);
                return { name: `color-${canon.slice(1)}`, value: canon };
            }
            if (DesignTool.COLOR_NAMES.has(value.toLowerCase())) return { name: `color-${value.toLowerCase()}`, value: value.toLowerCase() };
            const parsed = valueParser.unit(value);
            if (!parsed) return null;
            const number = Number(parsed.number);
            const unit = parsed.unit.toLowerCase();
            if (unit === '') {
                if (lower === 'opacity' && (number === 0 || number === 1)) return null;
                if (DesignTool.UNITLESS[lower]) return { name: `${DesignTool.UNITLESS[lower]}-${DesignTool.slug(number)}`, value: parsed.number };
                if (state.fn === 'scale') return { name: `scale-${DesignTool.slug(number)}`, value: parsed.number };
                return null;
            }
            if (unit === 'fr') return null;
            if (unit === 's' || unit === 'ms') {
                const ms = unit === 's' ? Math.round(number * 1000) : number;
                return { name: `duration-${ms}ms`, value: `${ms}ms` };
            }
            if (number === 0) return null;
            if (unit === '%') {
                if (DesignTool.ALLOWED_PERCENT.has(number) || state.keyframe) return null;
                return { name: `ratio-${DesignTool.slug(number)}pct`, value };
            }
            if (DesignTool.LENGTH_UNITS.has(unit) || unit === 'deg') return { name: `${DesignTool.groupFor(prop, unit)}-${DesignTool.slug(number)}${unit}`, value };
            return null;
        }
        if (node.type === 'function') {
            const fn = node.value.toLowerCase();
            if (DesignTool.COLOR_FUNCTIONS.has(fn)) {
                const text = valueParser.stringify(node);
                const inner = DesignTool.canonColor(text).replace(/^[a-z]+\(/, '').replace(/\)$/, '').replace(/\./g, 'p').replace(/[,/%]+/g, '-');
                return { name: `color-${fn}-${inner}`, value: text };
            }
            if (fn === 'cubic-bezier' || fn === 'steps') return { group: 'easing', value: valueParser.stringify(node) };
        }
        return null;
    }

    visit(nodes, prop, state) {
        const hits = [];
        for (const node of nodes) {
            if (node.type === 'function') {
                const fn = node.value.toLowerCase();
                if (fn === 'url') continue;
                const whole = this.describe(node, prop, state);
                if (whole) {
                    hits.push({ node, info: whole });
                } else if (fn === 'var') {
                    const divider = node.nodes.findIndex((item) => item.type === 'div');
                    if (divider !== -1) hits.push(...this.visit(node.nodes.slice(divider + 1), prop, { ...state, fn }));
                } else {
                    hits.push(...this.visit(node.nodes, prop, { ...state, fn }));
                }
            } else {
                const info = this.describe(node, prop, state);
                if (info) hits.push({ node, info });
            }
        }
        return hits;
    }

    scanDeclaration(decl, state) {
        const lower = decl.prop.toLowerCase();
        if (lower.startsWith('--')) return { hits: [], parsed: null };
        const parsed = valueParser(decl.value);
        const text = decl.value.trim();
        if (lower === 'font-family') {
            if (/var\(/.test(text)) return { hits: [], parsed };
            return { hits: [{ whole: true, info: { group: 'font-family', value: text } }], parsed };
        }
        if (DesignTool.WHOLE_VALUE[lower]) {
            if (/^(none|inherit|initial|unset)$/i.test(text) || /^var\(--[^)]*\)$/.test(text)) return { hits: [], parsed };
            const group = DesignTool.WHOLE_VALUE[lower];
            return { hits: [{ whole: true, info: { group, value: text } }], parsed };
        }
        return { hits: this.visit(parsed.nodes, decl.prop, state), parsed };
    }

    static isReference(value) {
        const parsed = valueParser(value);
        return parsed.nodes.length > 0 && parsed.nodes.every((node) => node.type === 'space' || (node.type === 'function' && node.value.toLowerCase() === 'var'));
    }

    tokenNameFor(property, prefix) {
        const bare = property.slice(2);
        return !prefix || bare.startsWith(`${prefix}-`) ? bare : `${prefix}-${bare}`;
    }

    collectDefinitions(root, { write, file, prefix, themeVariables, violations }) {
        const renames = {};
        const doomed = [];
        root.walkDecls((decl) => {
            if (!decl.prop.startsWith('--')) return;
            const value = decl.value.trim();
            if (DesignTool.isReference(value)) return;
            const line = decl.source && decl.source.start ? decl.source.start.line : 0;
            const theme = themeVariables ? themeVariables[decl.prop] : undefined;
            if (theme !== undefined && DesignTool.canonColor(theme) === DesignTool.canonColor(value)) {
                violations.push({ file, line, prop: decl.prop, literal: value, token: null, value, note: 'duplicates a theme variable' });
                if (write) doomed.push(decl);
                return;
            }
            const name = this.tokenNameFor(decl.prop, prefix);
            violations.push({ file, line, prop: decl.prop, literal: value, token: name, value, note: 'definition in css' });
            if (!write) return;
            if (this.tokens[name] !== undefined && DesignTool.canonColor(this.tokens[name]) !== DesignTool.canonColor(value)) {
                throw new Error(`${file}:${line} token ${name} is already defined with another value`);
            }
            this.token(name, value);
            if (`--${name}` !== decl.prop) renames[decl.prop] = `--${name}`;
            doomed.push(decl);
        });
        doomed.forEach((decl) => {
            const parent = decl.parent;
            decl.remove();
            if (parent && parent.type === 'rule' && parent.nodes.length === 0) parent.remove();
        });
        return renames;
    }

    static renameVariables(root, renames) {
        const entries = Object.entries(renames);
        if (entries.length === 0) return;
        root.walkDecls((decl) => {
            let value = decl.value;
            for (const [from, to] of entries) value = value.replace(new RegExp(`var\\(\\s*${from}(?![a-z0-9-])`, 'g'), `var(${to}`);
            if (value !== decl.value) decl.value = value;
        });
    }

    process(css, { write = false, file = '', prefix = '', themeVariables = null } = {}) {
        const root = postcss.parse(css, { from: undefined });
        const violations = [];
        const renames = this.collectDefinitions(root, { write, file, prefix, themeVariables, violations });
        DesignTool.renameVariables(root, renames);
        const lineOf = (node) => (node.source && node.source.start ? node.source.start.line : 0);
        const walk = (container, state) => {
            container.each((node) => {
                if (node.type === 'decl') {
                    const { hits, parsed } = this.scanDeclaration(node, state);
                    for (const hit of hits) {
                        if (!hit.info.name) hit.info.name = this.sequential(hit.info.group, hit.info.value);
                        violations.push({ file, line: lineOf(node), prop: node.prop, literal: hit.whole ? node.value.trim() : valueParser.stringify(hit.node), token: hit.info.name, value: hit.info.value });
                    }
                    if (write && hits.length > 0) {
                        if (hits[0].whole) {
                            this.token(hits[0].info.name, hits[0].info.value);
                            node.value = `var(--${hits[0].info.name})`;
                        } else {
                            for (const hit of hits) {
                                this.token(hit.info.name, hit.info.value);
                                hit.node.type = 'function';
                                hit.node.value = 'var';
                                hit.node.nodes = [{ type: 'word', value: `--${hit.info.name}` }];
                            }
                            node.value = valueParser.stringify(parsed.nodes);
                        }
                    }
                } else if (node.type === 'atrule') {
                    if (['media', 'container', 'supports'].includes(node.name)) {
                        const params = node.params.replace(/(?<![\w$-])(\d*\.?\d+)(px|em|rem)\b/g, (match, number, unit) => {
                            const name = `breakpoint-${DesignTool.slug(Number(number))}${unit}`;
                            violations.push({ file, line: lineOf(node), prop: `@${node.name}`, literal: match, token: name, value: match });
                            if (write) this.token(name, match);
                            return write ? `$${name}` : match;
                        });
                        if (write) node.params = params;
                    }
                    if (node.nodes) walk(node, { ...state, keyframe: state.keyframe || node.name === 'keyframes' });
                } else if (node.type === 'rule') {
                    walk(node, state);
                }
            });
        };
        walk(root, { keyframe: false });
        return { css: root.toString(), violations };
    }

    static expand(css, tokens) {
        const resolve = (text, depth = 0) =>
            depth > 8 ? text : text.replace(/var\(--([a-z0-9-]+)\)/gi, (match, name) => (tokens[name] !== undefined ? resolve(tokens[name], depth + 1) : match));
        return resolve(css).replace(/\$([a-z0-9-]+)/g, (match, name) => (tokens[name] !== undefined ? tokens[name] : match));
    }

    static canon(css) {
        const root = postcss.parse(css, { from: undefined });
        const lines = [];
        const norm = (value) => {
            const parsed = valueParser(value);
            parsed.walk((node) => {
                if (node.type === 'word') {
                    if (/^#[0-9a-fA-F]{3,8}$/.test(node.value)) node.value = node.value.toLowerCase();
                    const unit = valueParser.unit(node.value);
                    if (unit && (unit.unit === 's' || unit.unit === 'ms')) node.value = `${unit.unit === 's' ? Math.round(Number(unit.number) * 1000) : Number(unit.number)}ms`;
                    else if (unit && unit.unit === '' && unit.number !== '' && /^\.|\.0+$|^0\d/.test(node.value)) node.value = String(Number(unit.number));
                }
            });
            return valueParser.stringify(parsed.nodes).replace(/\s+/g, ' ').replace(/\s*,\s*/g, ',').trim();
        };
        const walk = (container, path) => {
            container.each((node) => {
                if (node.type === 'decl') lines.push(`${path}|${node.prop}:${norm(node.value)}${node.important ? '!' : ''}`);
                else if (node.type === 'rule') walk(node, `${path}>${node.selector.replace(/\s+/g, ' ')}`);
                else if (node.type === 'atrule') {
                    lines.push(`${path}|@${node.name} ${node.params.replace(/\s+/g, ' ')}`);
                    if (node.nodes) walk(node, `${path}>@${node.name}`);
                }
            });
        };
        walk(root, '');
        return lines;
    }

    static stripDefinitions(css) {
        const root = postcss.parse(css, { from: undefined });
        const defs = {};
        root.walkDecls((decl) => {
            if (decl.prop.startsWith('--') && !DesignTool.isReference(decl.value.trim())) defs[decl.prop.slice(2)] = decl.value.trim();
        });
        root.walkDecls((decl) => {
            if (!decl.prop.startsWith('--')) return;
            const parent = decl.parent;
            decl.remove();
            if (parent && parent.type === 'rule' && parent.nodes.length === 0) parent.remove();
        });
        return { css: root.toString(), defs };
    }

    static verify(original, migrated, tokens, themeVariables = {}) {
        const theme = {};
        Object.entries(themeVariables).forEach(([name, value]) => (theme[name.replace(/^--/, '')] = value));
        const stripped = DesignTool.stripDefinitions(original);
        const sources = { ...theme, ...tokens };
        const a = DesignTool.canon(DesignTool.expand(stripped.css, { ...sources, ...stripped.defs }));
        const b = DesignTool.canon(DesignTool.expand(migrated, sources));
        const problems = [];
        for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
            if (a[index] !== b[index]) problems.push({ original: a[index], migrated: b[index] });
        }
        return problems;
    }

    static files(root) {
        const found = [];
        const walk = (dir) => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = `${dir}/${entry.name}`;
                if (entry.isDirectory()) {
                    if (entry.name !== 'vendor' && entry.name !== 'node_modules') walk(full);
                } else if (entry.name.endsWith('.css')) {
                    found.push(full);
                }
            }
        };
        walk(root);
        return found.sort();
    }
}

module.exports = DesignTool;
