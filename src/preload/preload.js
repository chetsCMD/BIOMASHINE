const { contextBridge, ipcRenderer } = require('electron');

const CHANNEL = 'api';
const SHORTCUT_CHANNEL = 'shortcut';
const WINDOW_CHANNEL = 'window-state';

contextBridge.exposeInMainWorld('api', {
    onShortcut: (handler) => {
        ipcRenderer.on(SHORTCUT_CHANNEL, (event, name) => handler(name));
    },
    onWindowState: (handler) => {
        ipcRenderer.on(WINDOW_CHANNEL, (event, state) => handler(state));
    },
    invoke: async (channel, payload) => {
        const response = await ipcRenderer.invoke(CHANNEL, channel, payload);
        if (!response.ok) {
            const error = new Error(response.error);
            error.status = response.status;
            throw error;
        }
        return response.data;
    }
});
