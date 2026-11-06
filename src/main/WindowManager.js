const path = require('path');
const { BrowserWindow } = require('electron');
const ShortcutService = require('./ShortcutService');

class WindowManager {
    constructor({ config, settings, preloadPath, root }) {
        this.root = root;
        this.config = config;
        this.settings = settings;
        this.preloadPath = preloadPath;
        this.window = null;
        this.scheme = config.get('app.protocol.scheme');
        this.startUrl = `${this.scheme}://${config.get('app.protocol.appHost')}/${config.get('app.startPage')}`;
    }

    create() {
        const defaults = this.config.get('app.window');
        const bounds = this.settings.get('window.bounds') || {};
        this.window = new BrowserWindow({
            width: bounds.width || defaults.width,
            height: bounds.height || defaults.height,
            x: bounds.x,
            y: bounds.y,
            minWidth: defaults.minWidth,
            minHeight: defaults.minHeight,
            show: false,
            backgroundColor: defaults.backgroundColor,
            icon: path.join(this.root, defaults.icon),
            autoHideMenuBar: true,
            webPreferences: {
                preload: this.preloadPath,
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: true
            }
        });
        this.secure();
        this.shortcuts().attach(this.window.webContents);
        this.window.once('ready-to-show', () => this.window.show());
        this.window.on('enter-full-screen', () => this.announceFullscreen(true));
        this.window.on('leave-full-screen', () => this.announceFullscreen(false));
        this.window.on('close', () => this.settings.set('window.bounds', this.window.getBounds()));
        this.window.loadURL(this.startUrl);
        return this.window;
    }

    shortcuts() {
        return new ShortcutService(this.config.get('app.shortcuts'), {
            fullscreen: () => this.window.setFullScreen(!this.window.isFullScreen()),
            quickSwitch: () => this.window.webContents.send('shortcut', 'quickSwitch')
        });
    }

    announceFullscreen(fullscreen) {
        this.window.webContents.send('window-state', { fullscreen });
    }

    secure() {
        const contents = this.window.webContents;
        contents.setWindowOpenHandler(() => ({ action: 'deny' }));
        contents.on('will-navigate', (event, url) => {
            if (!url.startsWith(`${this.scheme}://`)) {
                event.preventDefault();
            }
        });
    }

    focus() {
        if (!this.window) {
            return;
        }
        if (this.window.isMinimized()) {
            this.window.restore();
        }
        this.window.focus();
    }
}

module.exports = WindowManager;
