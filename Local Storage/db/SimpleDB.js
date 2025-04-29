// db/SimpleDB.js

// Memory store for fallback when IndexedDB fails
export class MemoryStore { // Export
    constructor() {
        this.data = {};
        this.images = {};
        this.theme = { isDarkTheme: true };
    }

    async getData(id = 'root') {
        if (id === 'root' && !this.data.root) {
            this.data.root = {
                id: 'root',
                title: 'Home',
                elements: [],
                children: {}
            };
        }
        return this.data[id] || null;
    }

    async saveData(data) {
        this.data[data.id] = data;
    }

    async getTheme() {
        return this.theme;
    }

    async saveTheme(theme) {
        this.theme = theme;
    }

    async saveImage(id, data) {
        this.images[id] = data;
    }

    async getImage(id) {
        return this.images[id] || null;
    }

    async deleteImage(id) {
        delete this.images[id];
    }
}

// Simple IndexedDB wrapper with memory fallback
export class SimpleDB { // Export
    constructor(dbName) {
        this.dbName = dbName;
        this.db = null;
        this.memoryFallback = new MemoryStore();
        this.useMemory = false;
    }

    async open() {
        // Uses OPTIMISM.log etc - assumes OPTIMISM is global when called
        OPTIMISM.log('Opening database...');

        // Try to reset database if needed
        try {
            const needsReset = localStorage.getItem('optimism_db_reset') === 'true';

            if (needsReset) {
                OPTIMISM.log('Database reset requested, deleting old database...');
                await new Promise((resolve) => {
                    const deleteRequest = indexedDB.deleteDatabase(this.dbName);
                    deleteRequest.onsuccess = () => {
                        OPTIMISM.log('Database deleted successfully');
                        localStorage.removeItem('optimism_db_reset');
                        resolve();
                    };
                    deleteRequest.onerror = () => {
                        OPTIMISM.log('Error deleting database, continuing anyway');
                        localStorage.removeItem('optimism_db_reset');
                        resolve();
                    };
                });
            }
        } catch (error) {
            OPTIMISM.logError('Error in database reset:', error);
        }

        // Now try to open the database
        return new Promise((resolve) => {
            try {
                const request = indexedDB.open(this.dbName, 1);

                // Set timeout for database opening
                const timeout = setTimeout(() => {
                    OPTIMISM.log('Database open timed out, using memory store');
                    this.useMemory = true;
                    OPTIMISM.showMemoryMode();
                    resolve();
                }, 3000);

                request.onupgradeneeded = (event) => {
                    OPTIMISM.log('Database upgrade needed');
                    const db = event.target.result;

                    // Create necessary stores
                    if (!db.objectStoreNames.contains('canvasData')) {
                        db.createObjectStore('canvasData', { keyPath: 'id' });
                    }

                    if (!db.objectStoreNames.contains('themeSettings')) {
                        db.createObjectStore('themeSettings', { keyPath: 'id' });
                    }

                    if (!db.objectStoreNames.contains('imageData')) {
                        db.createObjectStore('imageData', { keyPath: 'id' });
                    }
                };

                request.onsuccess = (event) => {
                    clearTimeout(timeout);
                    this.db = event.target.result;
                    OPTIMISM.log('Database opened successfully');
                    resolve();
                };

                request.onerror = (event) => {
                    clearTimeout(timeout);
                    OPTIMISM.logError('Error opening database:', event.target.error);

                    // Fall back to memory mode
                    this.useMemory = true;
                    OPTIMISM.showMemoryMode();
                    resolve();
                };
            } catch (error) {
                OPTIMISM.logError('Exception in database open:', error);
                this.useMemory = true;
                OPTIMISM.showMemoryMode();
                resolve();
            }
        });
    }

    // Get data from database or memory fallback
    async getData(storeName, id) {
        // ... uses OPTIMISM.logError etc ...
        if (this.useMemory) {
             return this.memoryFallback.getData(id);
         }
         OPTIMISM.log(`Getting data from ${storeName}`); // Added log
         return new Promise((resolve) => {
            if (!this.db) {
                this.useMemory = true;
                OPTIMISM.showMemoryMode();
                resolve(this.memoryFallback.getData(id));
                return;
            }

            try {
                const transaction = this.db.transaction(storeName, 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.get(id);

                request.onsuccess = () => {
                    resolve(request.result);
                };

                request.onerror = (event) => {
                    OPTIMISM.logError(`Error getting data from ${storeName}:`, event.target.error);
                    this.useMemory = true;
                    OPTIMISM.showMemoryMode();
                    resolve(this.memoryFallback.getData(id));
                };
            } catch (error) {
                OPTIMISM.logError(`Exception in get from ${storeName}:`, error);
                this.useMemory = true;
                OPTIMISM.showMemoryMode();
                resolve(this.memoryFallback.getData(id));
            }
        });
    }

    // Save data to database or memory fallback
    async put(storeName, data) {
        // ... uses OPTIMISM.logError etc ...
        if (this.useMemory) {
             return this.memoryFallback.saveData(data);
         }
         OPTIMISM.log(`Saving data to ${storeName}`); // Added log
         return new Promise((resolve) => {
            if (!this.db) {
                this.useMemory = true;
                OPTIMISM.showMemoryMode();
                resolve(this.memoryFallback.saveData(data));
                return;
            }

            try {
                const transaction = this.db.transaction(storeName, 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.put(data);

                request.onsuccess = () => {
                    resolve();
                };

                request.onerror = (event) => {
                    OPTIMISM.logError(`Error saving data to ${storeName}:`, event.target.error);
                    this.useMemory = true;
                    OPTIMISM.showMemoryMode();
                    resolve(this.memoryFallback.saveData(data));
                };
            } catch (error) {
                OPTIMISM.logError(`Exception in put to ${storeName}:`, error);
                this.useMemory = true;
                OPTIMISM.showMemoryMode();
                resolve(this.memoryFallback.saveData(data));
            }
        });
    }

    // Delete data from database or memory fallback
    async delete(storeName, id) {
        // ... uses OPTIMISM.logError etc ...
        if (this.useMemory) {
            if (storeName === 'imageData') {
                return this.memoryFallback.deleteImage(id);
            }
            return;
        }
        OPTIMISM.log(`Deleting data from ${storeName}`); // Added log
         return new Promise((resolve) => {
            if (!this.db) {
                this.useMemory = true;
                OPTIMISM.showMemoryMode();
                resolve();
                return;
            }

            try {
                const transaction = this.db.transaction(storeName, 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.delete(id);

                request.onsuccess = () => {
                    resolve();
                };

                request.onerror = (event) => {
                    OPTIMISM.logError(`Error deleting data from ${storeName}:`, event.target.error);
                    this.useMemory = true;
                    OPTIMISM.showMemoryMode();
                    resolve();
                };
            } catch (error) {
                OPTIMISM.logError(`Exception in delete from ${storeName}:`, error);
                this.useMemory = true;
                OPTIMISM.showMemoryMode();
                resolve();
            }
        });
    }

    // Get all keys from a store
    async getAllKeys(storeName) {
        // ... uses OPTIMISM.logError etc ...
        if (this.useMemory) {
            if (storeName === 'imageData') {
                return Object.keys(this.memoryFallback.images);
            } else if (storeName === 'canvasData') {
                return Object.keys(this.memoryFallback.data);
            }
            return [];
        }
        OPTIMISM.log(`Getting all keys from ${storeName}`); // Added log
         return new Promise((resolve) => {
            if (!this.db) {
                this.useMemory = true;
                OPTIMISM.showMemoryMode();
                resolve([]);
                return;
            }

            try {
                const transaction = this.db.transaction(storeName, 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.getAllKeys();

                request.onsuccess = () => {
                    resolve(request.result);
                };

                request.onerror = (event) => {
                    OPTIMISM.logError(`Error getting keys from ${storeName}:`, event.target.error);
                    resolve([]);
                };
            } catch (error) {
                OPTIMISM.logError(`Exception in getAllKeys from ${storeName}:`, error);
                resolve([]);
            }
        });
    }

    // Clear a store
    async clearStore(storeName) {
        // ... uses OPTIMISM.logError etc ...
        if (this.useMemory) {
            if (storeName === 'imageData') {
                this.memoryFallback.images = {};
            } else if (storeName === 'canvasData') {
                this.memoryFallback.data = {};
            } else if (storeName === 'themeSettings') {
                this.memoryFallback.theme = { isDarkTheme: true };
            }
            return;
        }
        OPTIMISM.log(`Clearing store ${storeName}`); // Added log
         return new Promise((resolve) => {
            if (!this.db) {
                this.useMemory = true;
                OPTIMISM.showMemoryMode();
                resolve();
                return;
            }

            try {
                const transaction = this.db.transaction(storeName, 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.clear();

                request.onsuccess = () => {
                    resolve();
                };

                request.onerror = (event) => {
                    OPTIMISM.logError(`Error clearing store ${storeName}:`, event.target.error);
                    resolve();
                };
            } catch (error) {
                OPTIMISM.logError(`Exception in clearStore ${storeName}:`, error);
                resolve();
            }
        });
    }

    // Specialized methods for theme
    async getTheme() {
        if (this.useMemory) {
            return this.memoryFallback.getTheme();
        }

        const result = await this.getData('themeSettings', 'theme');
        return result || { id: 'theme', isDarkTheme: true };
    }
    async saveTheme(theme) {
        if (this.useMemory) {
            return this.memoryFallback.saveTheme(theme);
        }

        return this.put('themeSettings', theme);
    }

    // Specialized methods for images
    async saveImage(id, imageData) {
        if (this.useMemory) {
            return this.memoryFallback.saveImage(id, imageData);
        }

        return this.put('imageData', { id, data: imageData });
    }
    async getImage(id) {
        if (this.useMemory) {
            return this.memoryFallback.getImage(id);
        }

        const result = await this.getData('imageData', id);
        return result ? result.data : null;
    }
    async deleteImage(id) {
        if (this.useMemory) {
            return this.memoryFallback.deleteImage(id);
        }

        return this.delete('imageData', id);
    }
}
