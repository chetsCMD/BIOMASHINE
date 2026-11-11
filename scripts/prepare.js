const fs = require('fs');
const path = require('path');

class VendorBuilder {
    static FONTS = [
        { pkg: '@fontsource/playfair-display', styles: ['700.css', '400-italic.css'] },
        { pkg: '@fontsource/jetbrains-mono', styles: ['300.css', '400.css', '500.css'] }
    ];
    static DEFAULT_SUBSETS = ['latin', 'latin-ext', 'cyrillic'];

    constructor(root) {
        this.root = root;
        this.target = path.join(root, 'src', 'renderer', 'vendor');
        this.modules = path.join(root, 'node_modules');
        this.configFile = path.join(root, 'config', 'app.json');
    }

    subsets() {
        try {
            const data = JSON.parse(fs.readFileSync(this.configFile, 'utf8').replace(/^\uFEFF/, ''));
            const list = data && data.fonts && Array.isArray(data.fonts.subsets) ? data.fonts.subsets : null;
            if (list && list.length > 0) {
                const clean = list.filter((item) => typeof item === 'string' && item.length > 0);
                if (clean.length > 0) {
                    return clean;
                }
            }
        } catch (error) {
        }
        return [...VendorBuilder.DEFAULT_SUBSETS];
    }

    needsBuild() {
        return !fs.existsSync(path.join(this.target, 'chart.min.js')) || !fs.existsSync(path.join(this.target, 'fonts', 'fonts.css'));
    }

    copyChart() {
        const source = path.join(this.modules, 'chart.js', 'dist', 'chart.min.js');
        if (!fs.existsSync(source)) {
            throw new Error('chart.js не установлен: выполните npm install');
        }
        fs.mkdirSync(this.target, { recursive: true });
        fs.copyFileSync(source, path.join(this.target, 'chart.min.js'));
    }

    keepBlock(block) {
        const name = (block.match(/\/\*\s*(\S+)\s*\*\//) || [])[1] || '';
        return this.subsets().some((subset) => new RegExp(`-${subset}-\\d+-(normal|italic)$`).test(name));
    }

    buildFonts() {
        const fontsDir = path.join(this.target, 'fonts');
        fs.mkdirSync(fontsDir, { recursive: true });
        const output = [];
        for (const font of VendorBuilder.FONTS) {
            const packageDir = path.join(this.modules, font.pkg);
            if (!fs.existsSync(packageDir)) {
                throw new Error(`${font.pkg} не установлен: выполните npm install`);
            }
            for (const style of font.styles) {
                const css = fs.readFileSync(path.join(packageDir, style), 'utf8');
                for (const block of css.split(/\n\s*\n/).filter((item) => item.includes('@font-face'))) {
                    if (!this.keepBlock(block)) {
                        continue;
                    }
                    const file = block.match(/url\(\.\/files\/([^)]+\.woff2)\)/)[1];
                    fs.copyFileSync(path.join(packageDir, 'files', file), path.join(fontsDir, file));
                    const rule = block
                        .replace(/\/\*[^*]*\*\/\s*/, '')
                        .replace(/src:[^;]+;/, `src: url(./${file}) format('woff2');`);
                    output.push(rule.trim());
                }
            }
        }
        fs.writeFileSync(path.join(fontsDir, 'fonts.css'), `${output.join('\n\n')}\n`);
    }

    run(force) {
        if (!force && !this.needsBuild()) {
            return false;
        }
        this.copyChart();
        this.buildFonts();
        return true;
    }
}

if (require.main === module) {
    const built = new VendorBuilder(path.join(__dirname, '..')).run(process.argv.includes('--force'));
    process.stdout.write(built ? 'vendor: готово\n' : 'vendor: уже собран\n');
}

module.exports = VendorBuilder;