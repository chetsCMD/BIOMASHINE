const fs = require('fs');
const path = require('path');
const { app, dialog, shell } = require('electron');

class ElectronSystem {
    constructor(getWindow) {
        this.getWindow = getWindow;
    }

    systemLocale() {
        try {
            const preferred = app.getPreferredSystemLanguages();
            if (preferred.length > 0) {
                return preferred[0];
            }
        } catch (error) {
            return Intl.DateTimeFormat().resolvedOptions().locale;
        }
        return Intl.DateTimeFormat().resolvedOptions().locale;
    }

    async openExternal(url) {
        await shell.openExternal(url);
    }

    relaunch() {
        app.relaunch();
        app.exit(0);
    }

    windowState() {
        const window = this.getWindow();
        return { fullscreen: Boolean(window && window.isFullScreen()) };
    }

    toggleFullscreen() {
        const window = this.getWindow();
        if (window) {
            window.setFullScreen(!window.isFullScreen());
        }
        return this.windowState();
    }

    closeWindow() {
        const window = this.getWindow();
        if (window) {
            window.close();
        }
    }

    applyAutostart(enabled) {
        app.setLoginItemSettings({ openAtLogin: Boolean(enabled) });
    }

    async openFolder(folder) {
        const failure = await shell.openPath(folder);
        return { opened: failure === '', path: folder, error: failure || null };
    }

    async saveFile(defaultName, content) {
        const result = await dialog.showSaveDialog(this.getWindow(), {
            defaultPath: path.join(app.getPath('documents'), defaultName)
        });
        if (result.canceled || !result.filePath) {
            return { saved: false };
        }
        fs.writeFileSync(result.filePath, content, 'utf8');
        return { saved: true, path: result.filePath };
    }

    async saveFolder(folderName, files) {
        const result = await dialog.showOpenDialog(this.getWindow(), {
            defaultPath: app.getPath('documents'),
            properties: ['openDirectory', 'createDirectory']
        });
        if (result.canceled || result.filePaths.length === 0) {
            return { saved: false };
        }
        const target = path.join(result.filePaths[0], folderName);
        fs.mkdirSync(target, { recursive: true });
        for (const [name, content] of Object.entries(files)) {
            fs.writeFileSync(path.join(target, path.basename(name)), `\uFEFF${content}`, 'utf8');
        }
        return { saved: true, path: target };
    }
}

module.exports = ElectronSystem;
