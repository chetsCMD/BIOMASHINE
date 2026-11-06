const crypto = require('crypto');
const AppError = require('../core/AppError');

class AuthService {
    constructor(settings, config) {
        this.settings = settings;
        this.keyLength = config.get('app.auth.keyLength');
        this.minPasswordLength = config.get('app.auth.minPasswordLength');
        this.unlocked = !this.isProtected();
    }

    isProtected() {
        return this.settings.get('auth.hash') !== null;
    }

    isUnlocked() {
        return this.unlocked;
    }

    status() {
        const protectedByPassword = this.isProtected();
        return {
            protected: protectedByPassword,
            unlocked: this.unlocked,
            login: this.unlocked && protectedByPassword ? this.settings.get('auth.login') : null
        };
    }

    derive(password, salt) {
        return crypto.scryptSync(password, salt, this.keyLength);
    }

    verify(login, password) {
        const salt = this.settings.get('auth.salt');
        const stored = this.settings.get('auth.hash');
        if (!salt || !stored || login !== this.settings.get('auth.login')) {
            return false;
        }
        const expected = Buffer.from(stored, 'hex');
        const actual = this.derive(String(password), salt);
        return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    }

    store(login, password) {
        if (!login || !String(login).trim()) {
            throw AppError.badRequest('Логин не может быть пустым');
        }
        if (!password || String(password).length < this.minPasswordLength) {
            throw AppError.badRequest(`Пароль должен быть не короче ${this.minPasswordLength} символов`);
        }
        const salt = crypto.randomBytes(16).toString('hex');
        this.settings.set('auth.login', String(login).trim());
        this.settings.set('auth.salt', salt);
        this.settings.set('auth.hash', this.derive(String(password), salt).toString('hex'));
    }

    setup(login, password) {
        if (this.isProtected()) {
            throw AppError.badRequest('Защита уже включена');
        }
        this.store(login, password);
        this.unlocked = true;
    }

    login(login, password) {
        if (!this.isProtected()) {
            this.unlocked = true;
            return;
        }
        if (!this.verify(login, password)) {
            throw new AppError('Неверный логин или пароль', 401);
        }
        this.unlocked = true;
    }

    lock() {
        this.unlocked = this.isProtected() ? false : true;
    }

    change(currentLogin, currentPassword, newLogin, newPassword) {
        if (!this.verify(currentLogin, currentPassword)) {
            throw new AppError('Неверный текущий логин или пароль', 401);
        }
        this.store(newLogin, newPassword);
    }

    remove(login, password) {
        if (!this.verify(login, password)) {
            throw new AppError('Неверный логин или пароль', 401);
        }
        for (const key of ['auth.login', 'auth.salt', 'auth.hash']) {
            this.settings.remove(key);
        }
        this.unlocked = true;
    }
}

module.exports = AuthService;
