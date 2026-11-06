class AppError extends Error {
    constructor(message, status = 500) {
        super(message);
        this.name = 'AppError';
        this.status = status;
    }

    static badRequest(message) {
        return new AppError(message, 400);
    }

    static forbidden(message) {
        return new AppError(message, 403);
    }

    static notFound(message) {
        return new AppError(message, 404);
    }
}

module.exports = AppError;
