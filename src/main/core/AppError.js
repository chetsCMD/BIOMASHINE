class AppError extends Error {
    constructor(key, params, status) {
        if (typeof params === 'number' && status === undefined) {
            status = params;
            params = undefined;
        }
        if (status === undefined) {
            status = 500;
        }
        super(String(key));
        this.name = 'AppError';
        this.key = String(key);
        this.params = params || null;
        this.status = status;
    }

    static badRequest(key, params) {
        return new AppError(key, params, 400);
    }

    static forbidden(key, params) {
        return new AppError(key, params, 403);
    }

    static notFound(key, params) {
        return new AppError(key, params, 404);
    }
}

module.exports = AppError;