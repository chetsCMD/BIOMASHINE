const BaseController = require('../core/BaseController');
const AppError = require('../core/AppError');

class StorageController extends BaseController {
    constructor(storage, registry, config) {
        super();
        this.storage = storage;
        this.registry = registry;
        this.collectionPattern = new RegExp(config.get('app.storage.collectionPattern'));
        this.maxBytes = config.get('app.storage.maxDocumentBytes');
    }

    get prefix() {
        return 'storage';
    }

    scope({ module, collection }) {
        const owner = this.registry.get(module);
        if (!owner || owner.kind !== 'page') {
            throw AppError.badRequest('Неизвестный модуль');
        }
        if (typeof collection !== 'string' || !this.collectionPattern.test(collection)) {
            throw AppError.badRequest('Имя коллекции: строчные латинские буквы, цифры, _ и -, начинается с буквы, до 40 символов');
        }
        return { module, collection };
    }

    document(data) {
        if (data === null || typeof data !== 'object' || Array.isArray(data)) {
            throw AppError.badRequest('data должен быть объектом');
        }
        if (Buffer.byteLength(JSON.stringify(data), 'utf8') > this.maxBytes) {
            throw AppError.badRequest(`Документ больше ${this.maxBytes} байт`);
        }
        return data;
    }

    routes() {
        return {
            list: (payload) => {
                const { module, collection } = this.scope(payload);
                return this.storage.list(module, collection);
            },
            get: (payload) => {
                const { module, collection } = this.scope(payload);
                const found = this.storage.get(module, collection, BaseController.id(payload.id));
                if (!found) {
                    throw AppError.notFound('Документ не найден');
                }
                return found;
            },
            insert: (payload) => {
                const { module, collection } = this.scope(payload);
                return { id: this.storage.insert(module, collection, this.document(payload.data)) };
            },
            update: (payload) => {
                const { module, collection } = this.scope(payload);
                if (this.storage.update(module, collection, BaseController.id(payload.id), this.document(payload.data)) === 0) {
                    throw AppError.notFound('Документ не найден');
                }
            },
            remove: (payload) => {
                const { module, collection } = this.scope(payload);
                if (this.storage.remove(module, collection, BaseController.id(payload.id)) === 0) {
                    throw AppError.notFound('Документ не найден');
                }
            },
            clear: (payload) => {
                const { module, collection } = this.scope(payload);
                return { removed: this.storage.clear(module, collection) };
            }
        };
    }
}

module.exports = StorageController;
