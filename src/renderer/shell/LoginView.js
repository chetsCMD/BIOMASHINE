import { Dom } from './Dom.js';

export class LoginView {
    constructor(root, api, i18n) {
        this.root = root;
        this.api = api;
        this.i18n = i18n;
    }

    prompt() {
        return new Promise((resolve) => {
            const error = Dom.el('div', { class: 'form-error' });
            const login = Dom.el('input', { type: 'text', placeholder: this.i18n.t('login.login'), autocomplete: 'username' });
            const password = Dom.el('input', { type: 'password', placeholder: this.i18n.t('login.password'), autocomplete: 'current-password' });
            const submit = async () => {
                error.textContent = '';
                try {
                    await this.api.invoke('auth:login', { login: login.value, password: password.value });
                    this.hide();
                    resolve();
                } catch (failure) {
                    error.textContent = failure.message;
                    password.select();
                }
            };
            const onEnter = (event) => {
                if (event.key === 'Enter') {
                    submit();
                }
            };
            login.addEventListener('keydown', onEnter);
            password.addEventListener('keydown', onEnter);
            Dom.clear(this.root).append(
                Dom.el('div', { class: 'login-card' }, [
                    Dom.el('div', { class: 'login-title', text: 'BIOMASHINE' }),
                    login,
                    password,
                    error,
                    Dom.el('button', { class: 'dialog-btn', text: this.i18n.t('login.submit'), onclick: submit })
                ])
            );
            this.root.classList.remove('hidden');
            login.focus();
        });
    }

    hide() {
        this.root.classList.add('hidden');
        Dom.clear(this.root);
    }
}
