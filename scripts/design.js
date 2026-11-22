const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const DesignTool = require('./lib/DesignTool');

const root = path.join(__dirname, '..');
const designFile = path.join(root, 'config', 'design.json');
const themesFile = path.join(root, 'config', 'themes.json');

class DesignCli {
    constructor(argv) {
        this.command = argv[0];
        this.flags = new Set(argv.filter((item) => item.startsWith('--')));
        this.values = argv.slice(1).filter((item) => !item.startsWith('--'));
    }

    loadTokens() {
        return fs.existsSync(designFile) ? JSON.parse(fs.readFileSync(designFile, 'utf8')).tokens : {};
    }

    saveTokens(tokens) {
        const group = (name) => name.replace(/-(n?\d[\w.]*|\d+)$/, '');
        const amount = (name) => Number((name.match(/-(n?\d+(?:p\d+)?)[a-z%]*$/) || [0, '0'])[1].replace('n', '-').replace('p', '.'));
        const sorted = Object.keys(tokens).sort((a, b) => group(a).localeCompare(group(b)) || amount(a) - amount(b) || a.localeCompare(b));
        const out = {};
        sorted.forEach((name) => (out[name] = tokens[name]));
        fs.writeFileSync(designFile, `${JSON.stringify({ tokens: out }, null, 2)}\n`);
    }

    targets() {
        const base = this.values.length > 0 ? this.values.map((item) => path.resolve(item)) : [path.join(root, 'src', 'renderer')];
        const all = base.flatMap((item) => (fs.statSync(item).isDirectory() ? DesignTool.files(item) : [item]));
        return all.sort((a, b) => Number(/\/modules\//.test(a)) - Number(/\/modules\//.test(b)) || a.localeCompare(b));
    }

    rel(file) {
        return path.relative(root, file).split(path.sep).join('/');
    }

    themeVariables() {
        const themes = JSON.parse(fs.readFileSync(themesFile, 'utf8'));
        return themes.themes[themes.default].variables;
    }

    options(file) {
        const unix = this.rel(file);
        const module = unix.match(/\/modules\/([a-z0-9-]+)\//);
        return { file: unix, prefix: module ? module[1] : '', themeVariables: unix.endsWith('shared/base.css') ? this.themeVariables() : null };
    }

    audit() {
        const tool = new DesignTool(this.loadTokens());
        const found = this.targets().flatMap((file) => tool.process(fs.readFileSync(file, 'utf8'), this.options(file)).violations);
        if (this.flags.has('--json')) {
            process.stdout.write(`${JSON.stringify(found, null, 2)}\n`);
        } else {
            for (const item of found) process.stdout.write(`${item.file}:${item.line}  ${item.prop}: ${item.literal}  ->  ${item.token ? `--${item.token}` : item.note}\n`);
            process.stdout.write(`${found.length} hard-coded visual values\n`);
        }
        return found.length === 0 ? 0 : 1;
    }

    migrate() {
        const tool = new DesignTool(this.loadTokens());
        let total = 0;
        for (const file of this.targets()) {
            const result = tool.process(fs.readFileSync(file, 'utf8'), { ...this.options(file), write: true });
            total += result.violations.length;
            if (this.flags.has('--write') && result.violations.length > 0) fs.writeFileSync(file, result.css);
            process.stdout.write(`${this.rel(file)}: ${result.violations.length}\n`);
        }
        process.stdout.write(`${total} values, ${Object.keys(tool.added).length} new tokens${this.flags.has('--write') ? ' (written)' : ' (dry run, add --write)'}\n`);
        if (this.flags.has('--write')) this.saveTokens(tool.tokens);
        return 0;
    }

    tokens() {
        const filter = this.values[0];
        for (const [name, value] of Object.entries(this.loadTokens())) {
            if (!filter || name.startsWith(filter)) process.stdout.write(`--${name}: ${value}\n`);
        }
        return 0;
    }

    verify() {
        const ref = this.values[0] || 'HEAD';
        const tokens = this.loadTokens();
        let problems = 0;
        for (const file of DesignTool.files(path.join(root, 'src', 'renderer'))) {
            let original;
            try {
                original = execFileSync('git', ['show', `${ref}:${this.rel(file)}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
            } catch (error) {
                continue;
            }
            const found = DesignTool.verify(original, fs.readFileSync(file, 'utf8'), tokens, this.themeVariables());
            problems += found.length;
            found.slice(0, 5).forEach((item) => process.stdout.write(`${this.rel(file)}\n  was: ${item.original}\n  now: ${item.migrated}\n`));
        }
        process.stdout.write(problems === 0 ? `verify: no visual difference against ${ref}\n` : `verify: ${problems} differences\n`);
        return problems === 0 ? 0 : 1;
    }

    run() {
        if (!['audit', 'migrate', 'tokens', 'verify'].includes(this.command)) {
            process.stdout.write('Usage: node scripts/design.js <audit|migrate|tokens|verify> [files] [--json] [--write]\n');
            return 1;
        }
        return this[this.command]();
    }
}

process.exitCode = new DesignCli(process.argv.slice(2)).run();
