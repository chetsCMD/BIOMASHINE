import { Api } from './Api.js';
import { ShellApp } from './ShellApp.js';

new ShellApp({ document, api: new Api() }).start().catch((error) => {
    document.body.textContent = `BIOMASHINE: ${error.message}`;
});
