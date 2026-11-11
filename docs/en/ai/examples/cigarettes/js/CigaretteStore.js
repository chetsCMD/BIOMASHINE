export class CigaretteStore {
    static ENTRIES = 'entries';
    static SETTINGS = 'settings';

    constructor(storage) {
        this.storage = storage;
    }

    listEntries() {
        return this.storage.list(CigaretteStore.ENTRIES);
    }

    addEntry(timestamp) {
        return this.storage.insert(CigaretteStore.ENTRIES, { at: timestamp });
    }

    removeEntry(id) {
        return this.storage.remove(CigaretteStore.ENTRIES, id);
    }

    async getGoal() {
        const [document] = await this.storage.list(CigaretteStore.SETTINGS);
        return document ? document.data.goal : 10;
    }

    async saveGoal(goal) {
        const [document] = await this.storage.list(CigaretteStore.SETTINGS);
        if (document) {
            await this.storage.update(CigaretteStore.SETTINGS, document.id, { goal });
        } else {
            await this.storage.insert(CigaretteStore.SETTINGS, { goal });
        }
    }
}
