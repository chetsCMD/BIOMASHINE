export class ModuleNotifications {
    constructor(client) {
        this.client = client;
    }

    schedule(options) {
        return this.client.invoke('notifications:schedule', options);
    }

    cancel(id) {
        return this.client.invoke('notifications:cancel', { id });
    }

    list() {
        return this.client.invoke('notifications:list');
    }
}
