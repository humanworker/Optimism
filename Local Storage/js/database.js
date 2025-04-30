// Using utils for logging
import { OPTIMISM_UTILS } from './utils.js';

// Memory store for fallback when IndexedDB fails
class MemoryStore {
    constructor() {
        this.data = {};
        this.images = {};
        this.theme = { isDarkTheme: true };
    }

    async getData(storeName, id) {
        OPTIMISM_UTILS.log(`MemoryStore: Getting data from ${storeName} with id ${id}`);
        if (storeName === 'canvasData') {
            if (id === 'root' && !this.data.root) {
                this.data.root = { id: 'root', title: 'Home', elements: [], children: {} };
            }
            return structuredClone(this.data[id] || null); // Return clone
        } else if (storeName === 'themeSettings') {
            return structuredClone(this.theme);
        } else if (storeName === 'imageData') {
            return this.images[id] || null; // Images might be large, don't clone unless necessary
        }
        return null;
    }

    async put(storeName, data) {
         OPTIMISM_UTILS.log(`MemoryStore: Saving data to ${storeName} with id ${data.id}`);
         const clonedData = structuredClone(data); // Save a clone
         if (storeName === 'canvasData') {
             this.data[clonedData.id] = clonedData;
         } else if (storeName === 'themeSettings') {
             this.theme = clonedData;
         } else if (storeName === 'imageData') {
             this.images[clonedData.id] = clonedData.data; // Store only the data part for images
         }
    }

    async delete(storeName, id) {
        OPTIMISM_UTILS.log(`MemoryStore: Deleting data from ${storeName} with id ${id}`);
        if (storeName === 'canvasData') {
            delete this.data[id];
        } else if (storeName === 'imageData') {
            delete this.images[id];
        } else if (storeName === 'themeSettings') {
            // Don't delete theme, maybe reset to default?
            this.theme = { isDarkTheme: true };
        }
    }

    async getAllKeys(storeName) {
        OPTIMISM_UTILS.log(`MemoryStore: Getting all keys from ${storeName}`);
        if (storeName === 'canvasData') {
            return Object.keys(this.data);
        } else if (storeName === 'imageData') {
            return Object.keys(this.images);
        } else if (storeName === 'themeSettings') {
            return this.theme ? [this.theme.id] : [];
        }
        return [];
    }

    async clearStore(storeName) {
        OPTIMISM_UTILS.log(`MemoryStore: Clearing store ${storeName}`);
        if (storeName === 'canvasData') {
            this.data = {};
        } else if (storeName === 'imageData') {
            this.images = {};
        } else if (storeName === 'themeSettings') {
            this.theme = { isDarkTheme: true };
        }
    }
}


// Simple IndexedDB wrapper with memory fallback
export class SimpleDB {
    constructor(dbName) {
        this.dbName = dbName;
        this.db = null;
        this.memoryFallback = new MemoryStore();
        this.useMemory = !window.indexedDB; // Use memory immediately if IndexedDB not supported
        this.STORE_NAMES = {
            DATA: 'canvasData',
            THEME: 'themeSettings',
            IMAGES: 'imageData'
        };
    }

    async open() {
        if (this.useMemory) {
            OPTIMISM_UTILS.log('IndexedDB not supported, using memory store.');
            return; // Already in memory mode
        }
        if (this.db) {
            OPTIMISM_UTILS.log('Database already open.');
            return; // Already open
        }

        OPTIMISM_UTILS.log('Opening database...');

        // Try to reset database if needed
        try {
            const needsReset = localStorage.getItem('optimism_db_reset') === 'true';
            if (needsReset) {
                OPTIMISM_UTILS.log('Database reset requested, deleting old database...');
                await new Promise((resolve, reject) => {
                    const deleteRequest = indexedDB.deleteDatabase(this.dbName);
                    deleteRequest.onsuccess = () => {
                        OPTIMISM_UTILS.log('Database deleted successfully for reset.');
                        localStorage.removeItem('optimism_db_reset');
                        resolve();
                    };
                    deleteRequest.onerror = (e) => {
                        OPTIMISM_UTILS.logError('Error deleting database during reset', e.target.error);
                        localStorage.removeItem('optimism_db_reset'); // Remove flag even on error
                        resolve(); // Continue anyway
                    };
                    deleteRequest.onblocked = () => {
                        OPTIMISM_UTILS.logError('Database delete blocked during reset. Please close other tabs using the app.', null);
                        // Don't reject, let it try to open anyway, might recover
                        localStorage.removeItem('optimism_db_reset');
                        resolve();
                    };
                });
            }
        } catch (error) {
            OPTIMISM_UTILS.logError('Error checking/performing database reset:', error);
             localStorage.removeItem('optimism_db_reset'); // Ensure flag is removed
        }

        // Now try to open the database
        return new Promise((resolve) => {
            try {
                const request = indexedDB.open(this.dbName, 1); // Version 1

                const timeout = setTimeout(() => {
                    OPTIMISM_UTILS.logError('Database open timed out, falling back to memory store', null);
                    request.onerror = null; // Prevent late error firing
                    request.onsuccess = null;
                    request.onupgradeneeded = null;
                    this.useMemory = true;
                    OPTIMISM_UTILS.showMemoryMode();
                    resolve();
                }, 5000); // 5 second timeout

                request.onupgradeneeded = (event) => {
                    OPTIMISM_UTILS.log('Database upgrade needed');
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains(this.STORE_NAMES.DATA)) {
                        db.createObjectStore(this.STORE_NAMES.DATA, { keyPath: 'id' });
                        OPTIMISM_UTILS.log(`Created store: ${this.STORE_NAMES.DATA}`);
                    }
                    if (!db.objectStoreNames.contains(this.STORE_NAMES.THEME)) {
                        db.createObjectStore(this.STORE_NAMES.THEME, { keyPath: 'id' });
                        OPTIMISM_UTILS.log(`Created store: ${this.STORE_NAMES.THEME}`);
                    }
                    if (!db.objectStoreNames.contains(this.STORE_NAMES.IMAGES)) {
                        db.createObjectStore(this.STORE_NAMES.IMAGES, { keyPath: 'id' });
                         OPTIMISM_UTILS.log(`Created store: ${this.STORE_NAMES.IMAGES}`);
                    }
                };

                request.onsuccess = (event) => {
                    clearTimeout(timeout);
                    this.db = event.target.result;
                    OPTIMISM_UTILS.log('Database opened successfully');
                    // Add error handler to the database connection itself
                    this.db.onerror = (dbEvent) => {
                         OPTIMISM_UTILS.logError('Database connection error:', dbEvent.target.error);
                         this.useMemory = true;
                         this.db = null; // Invalidate DB connection
                         OPTIMISM_UTILS.showMemoryMode();
                    };
                    resolve();
                };

                request.onerror = (event) => {
                    clearTimeout(timeout);
                    OPTIMISM_UTILS.logError('Error opening database:', event.target.error);
                    this.useMemory = true;
                    OPTIMISM_UTILS.showMemoryMode();
                    resolve();
                };

                request.onblocked = () => {
                     clearTimeout(timeout);
                     OPTIMISM_UTILS.logError('Database open blocked. Please close other tabs using the app.', null);
                     // Fallback to memory, user needs to fix the block
                     this.useMemory = true;
                     OPTIMISM_UTILS.showMemoryMode();
                     resolve();
                };

            } catch (error) {
                OPTIMISM_UTILS.logError('Exception during indexedDB.open call:', error);
                this.useMemory = true;
                OPTIMISM_UTILS.showMemoryMode();
                resolve();
            }
        });
    }

    // Generic transaction helper
    _getTransaction(storeName, mode = 'readonly') {
        if (this.useMemory || !this.db) {
            return null; // Indicate memory mode or DB issue
        }
        try {
            // Check if the store exists before creating transaction
            if (!this.db.objectStoreNames.contains(storeName)) {
                 OPTIMISM_UTILS.logError(`Store "${storeName}" does not exist in the database.`, null);
                 this.useMemory = true; // Fallback if store missing
                 OPTIMISM_UTILS.showMemoryMode();
                 return null;
            }
            const transaction = this.db.transaction(storeName, mode);
            return transaction.objectStore(storeName);
        } catch (error) {
            OPTIMISM_UTILS.logError(`Error creating transaction for ${storeName} (${mode}):`, error);
            // Fallback to memory on transaction error
             if (error.name === 'InvalidStateError' || error.name === 'TransactionInactiveError') {
                 OPTIMISM_UTILS.log('Database connection might be closed. Attempting fallback.');
                 this.useMemory = true;
                 this.db = null; // Invalidate DB
                 OPTIMISM_UTILS.showMemoryMode();
             }
            return null;
        }
    }

    // --- CRUD Operations ---

    async getData(storeName, id) {
        if (this.useMemory) {
            return this.memoryFallback.getData(storeName, id);
        }
        const store = this._getTransaction(storeName, 'readonly');
        if (!store) return this.memoryFallback.getData(storeName, id); // Fallback if transaction failed

        // OPTIMISM_UTILS.log(`DB: Getting data from ${storeName}, id: ${id}`); // Less verbose logging
        return new Promise((resolve) => {
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => {
                OPTIMISM_UTILS.logError(`Error getting data from ${storeName} (id: ${id}):`, e.target.error);
                resolve(this.memoryFallback.getData(storeName, id)); // Fallback on error
            };
        });
    }

    async put(storeName, data) {
        if (this.useMemory) {
            return this.memoryFallback.put(storeName, data);
        }
        const store = this._getTransaction(storeName, 'readwrite');
         if (!store) return this.memoryFallback.put(storeName, data); // Fallback if transaction failed

        // OPTIMISM_UTILS.log(`DB: Saving data to ${storeName}, id: ${data.id}`); // Less verbose logging
        return new Promise((resolve, reject) => { // Use reject for write errors
             // Ensure data has an ID if required by keyPath
             if (!data || typeof data.id === 'undefined') {
                 OPTIMISM_UTILS.logError(`Data missing 'id' for store ${storeName}:`, data);
                 return reject(new Error(`Data missing 'id' for store ${storeName}`));
             }

            const request = store.put(data);
            request.onsuccess = () => resolve();
            request.onerror = (e) => {
                OPTIMISM_UTILS.logError(`Error saving data to ${storeName} (id: ${data.id}):`, e.target.error);
                 // Don't automatically fallback on write error, signal failure
                reject(e.target.error);
            };
        });
    }

    async delete(storeName, id) {
        if (this.useMemory) {
            return this.memoryFallback.delete(storeName, id);
        }
        const store = this._getTransaction(storeName, 'readwrite');
        if (!store) return this.memoryFallback.delete(storeName, id); // Fallback if transaction failed

        // OPTIMISM_UTILS.log(`DB: Deleting data from ${storeName}, id: ${id}`); // Less verbose logging
        return new Promise((resolve, reject) => { // Use reject for write errors
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = (e) => {
                OPTIMISM_UTILS.logError(`Error deleting data from ${storeName} (id: ${id}):`, e.target.error);
                 // Don't automatically fallback on write error, signal failure
                reject(e.target.error);
            };
        });
    }

    async getAllKeys(storeName) {
        if (this.useMemory) {
            return this.memoryFallback.getAllKeys(storeName);
        }
        const store = this._getTransaction(storeName, 'readonly');
        if (!store) return this.memoryFallback.getAllKeys(storeName); // Fallback if transaction failed

        // OPTIMISM_UTILS.log(`DB: Getting all keys from ${storeName}`); // Less verbose logging
        return new Promise((resolve) => {
            const request = store.getAllKeys();
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => {
                OPTIMISM_UTILS.logError(`Error getting keys from ${storeName}:`, e.target.error);
                 resolve(this.memoryFallback.getAllKeys(storeName)); // Fallback on error
            };
        });
    }

    async clearStore(storeName) {
        if (this.useMemory) {
            return this.memoryFallback.clearStore(storeName);
        }
        const store = this._getTransaction(storeName, 'readwrite');
        if (!store) return this.memoryFallback.clearStore(storeName); // Fallback if transaction failed

        OPTIMISM_UTILS.log(`DB: Clearing store ${storeName}`);
        return new Promise((resolve, reject) => { // Use reject for write errors
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = (e) => {
                OPTIMISM_UTILS.logError(`Error clearing store ${storeName}:`, e.target.error);
                // Don't automatically fallback on write error, signal failure
                reject(e.target.error);
            };
        });
    }

    // --- Specialized Methods ---

    async getTheme() {
        const result = await this.getData(this.STORE_NAMES.THEME, 'theme');
        return result || { id: 'theme', isDarkTheme: true }; // Default theme
    }

    async saveTheme(theme) {
        return this.put(this.STORE_NAMES.THEME, theme);
    }

    async saveImage(id, imageData) {
         // Basic check for large data before saving
         if (typeof imageData === 'string' && imageData.length > 10 * 1024 * 1024) { // ~10MB limit check
             OPTIMISM_UTILS.logError(`Image data for ${id} might be too large (${(imageData.length / (1024*1024)).toFixed(1)}MB)`, null);
             // Optionally reject or compress further
         }
        return this.put(this.STORE_NAMES.IMAGES, { id, data: imageData });
    }

    async getImage(id) {
        const result = await this.getData(this.STORE_NAMES.IMAGES, id);
        return result ? result.data : null;
    }

    async deleteImage(id) {
        return this.delete(this.STORE_NAMES.IMAGES, id);
    }
}