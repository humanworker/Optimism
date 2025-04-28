// Core application code
const OPTIMISM = {
    // Global application state
    app: null,
    model: null,
    view: null,
    controller: null,

    // Simple logging utility
    log: function(message) {
        console.log(message);
        const debugPanel = document.getElementById('debug-panel');
        if (debugPanel) {
            const entry = document.createElement('div');
            entry.textContent = message;
            debugPanel.appendChild(entry);
            debugPanel.scrollTop = debugPanel.scrollHeight;
        }

        // Also update loading status
        const loadingStatus = document.getElementById('loading-status');
        if (loadingStatus) {
            loadingStatus.textContent = message;
        }
    },

    // Error logging
    logError: function(message, error) {
        const errorMsg = `ERROR: ${message} ${error ? error.toString() : ''}`;
        console.error(errorMsg);
        const debugPanel = document.getElementById('debug-panel');
        if (debugPanel) {
            const entry = document.createElement('div');
            entry.textContent = errorMsg;
            entry.style.color = '#ff5555';
            debugPanel.appendChild(entry);
            debugPanel.scrollTop = debugPanel.scrollHeight;
        }
    },

    // Reset database function
    resetDatabase: function() {
        localStorage.setItem('optimism_db_reset', 'true');
        window.location.reload();
    },

    // Show memory mode indicator
    showMemoryMode: function() {
        const statusMessage = document.getElementById('status-message');
        statusMessage.style.display = 'block';

        const resetButton = document.getElementById('reset-db-button');
        resetButton.style.display = 'block';
        resetButton.addEventListener('click', OPTIMISM.resetDatabase);
    },

    resizeImage: async function(file, maxDimension = 1200, quality = 0.95, displayMaxDimension = 600) {
        OPTIMISM.log(`Resizing image with max storage dimension ${maxDimension}, display max ${displayMaxDimension}, and quality ${quality}...`);

        return new Promise((resolve, reject) => {
            try {
                const img = new Image();
                const reader = new FileReader();

                // Set timeout in case the image loading hangs
                const timeout = setTimeout(() => {
                    OPTIMISM.logError('Image loading timed out', new Error('Timeout'));
                    reject(new Error('Image loading timed out'));
                }, 10000);

                reader.onload = function(e) {
                    img.onload = function() {
                        clearTimeout(timeout);

                        try {
                            // Calculate storage dimensions (max 1200px)
                            let storageWidth = img.width;
                            let storageHeight = img.height;

                            // Determine which dimension is longer and resize to maxDimension
                            if (storageWidth > storageHeight && storageWidth > maxDimension) {
                                storageHeight = Math.round(storageHeight * (maxDimension / storageWidth));
                                storageWidth = maxDimension;
                            } else if (storageHeight > maxDimension) {
                                storageWidth = Math.round(storageWidth * (maxDimension / storageHeight));
                                storageHeight = maxDimension;
                            }

                            // Calculate display dimensions (max 600px)
                            let displayWidth = img.width;
                            let displayHeight = img.height;

                            // Determine which dimension is longer and resize to displayMaxDimension
                            if (displayWidth > displayHeight && displayWidth > displayMaxDimension) {
                                displayHeight = Math.round(displayHeight * (displayMaxDimension / displayWidth));
                                displayWidth = displayMaxDimension;
                            } else if (displayHeight > displayMaxDimension) {
                                displayWidth = Math.round(displayWidth * (displayMaxDimension / displayHeight));
                                displayHeight = displayMaxDimension;
                            }

                            // Create canvas for resizing to storage dimensions
                            const canvas = document.createElement('canvas');
                            canvas.width = storageWidth;
                            canvas.height = storageHeight;

                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0, storageWidth, storageHeight);

                            // Convert to JPEG data URL with specified quality
                            // Quality is between 0 and 1, where 1 is highest quality
                            const dataUrl = canvas.toDataURL('image/jpeg', quality);

                            OPTIMISM.log(`Image resized to ${storageWidth}x${storageHeight} for storage with quality ${quality}`);
                            OPTIMISM.log(`Image display size set to ${displayWidth}x${displayHeight}`);

                            resolve({
                                data: dataUrl,
                                width: displayWidth,   // Display width
                                height: displayHeight, // Display height
                                storageWidth: storageWidth,   // Actual stored dimensions
                                storageHeight: storageHeight  // Actual stored dimensions
                            });
                        } catch (error) {
                            OPTIMISM.logError('Error processing image:', error);
                            reject(error);
                        }
                    };

                    img.onerror = function() {
                        clearTimeout(timeout);
                        OPTIMISM.logError('Failed to load image', new Error('Image load error'));
                        reject(new Error('Failed to load image'));
                    };

                    img.src = e.target.result;
                };

                reader.onerror = function() {
                    clearTimeout(timeout);
                    OPTIMISM.logError('Failed to read file', new Error('File read error'));
                    reject(new Error('Failed to read file'));
                };

                reader.readAsDataURL(file);
            } catch (error) {
                OPTIMISM.logError('Error in image resize setup:', error);
                reject(error);
            }
        });
    },

    // Initialize the application
   // Add this to core.js, in the OPTIMISM.init function
// Update the init function in core.js
init: function() {
    OPTIMISM.log('Application starting...');

    // Setup global error handlers
    window.addEventListener('error', (event) => {
        OPTIMISM.logError('Uncaught error:', event.error);
    });

    window.addEventListener('unhandledrejection', (event) => {
        OPTIMISM.logError('Unhandled promise rejection:', event.reason);
    });

    // Store the initial hash for later navigation
    const initialHash = window.location.hash;
    OPTIMISM.log(`Initial URL hash: ${initialHash}`);

    // Check for IndexedDB support
    if (!window.indexedDB) {
        OPTIMISM.logError('IndexedDB not supported', new Error('Browser does not support IndexedDB'));
        document.getElementById('loading-status').textContent = 'Your browser does not support IndexedDB. Using memory-only mode.';
        OPTIMISM.showMemoryMode();
    }

    // Set timeout to force error if initialization takes too long
    const initTimeout = setTimeout(() => {
        OPTIMISM.logError('Initialization timed out', new Error('Application did not initialize within 10 seconds'));
        document.getElementById('loading-status').textContent = 'Initialization timed out. Please reset database and reload.';
        document.getElementById('reset-db-button').style.display = 'block';
        document.getElementById('reset-db-button').addEventListener('click', OPTIMISM.resetDatabase);
    }, 10000); // 10 seconds timeout

    // -------- START OF THE REQUESTED CODE BLOCK --------
    try {
        OPTIMISM.model = new CanvasModel();
        OPTIMISM.view = new CanvasView(OPTIMISM.model, null);
        OPTIMISM.controller = new CanvasController(OPTIMISM.model, OPTIMISM.view);

        OPTIMISM.view.controller = OPTIMISM.controller;

        // Initialize application BUT DO NOT RENDER YET
        OPTIMISM.controller.initialize().then(() => {
            clearTimeout(initTimeout); // Clear the safety timeout

            // Handle browser back/forward buttons (popstate)
            window.addEventListener('popstate', (event) => {
                OPTIMISM.log('Popstate event triggered', event.state);
                let nodeId = 'root'; // Default to root

                if (event.state && event.state.nodeId) {
                    nodeId = event.state.nodeId;
                    OPTIMISM.log(`Navigating via popstate to node: ${nodeId}`);
                } else if (window.location.hash && window.location.hash !== '#') {
                    // If no state but we have a hash, try to navigate by hash
                    OPTIMISM.log(`Popstate: Navigating via hash: ${window.location.hash}`);
                    OPTIMISM.model.navigateToNodeByHash(window.location.hash)
                        .then(success => {
                            if (success) {
                                OPTIMISM.log(`Popstate: Successfully navigated via hash.`);
                                // Render AFTER popstate hash navigation is complete
                                OPTIMISM.view.renderWorkspace();
                            } else {
                                OPTIMISM.logError(`Popstate: Failed to navigate via hash.`);
                                // Optionally navigate to root if hash fails
                                OPTIMISM.model.navigateToNode('root').then(() => OPTIMISM.view.renderWorkspace());
                            }
                        }).catch(error => {
                            OPTIMISM.logError('Error handling popstate hash navigation:', error);
                            OPTIMISM.model.navigateToNode('root').then(() => OPTIMISM.view.renderWorkspace());
                        });
                    return; // Skip the rest as we're handling via hash
                } else {
                    OPTIMISM.log(`Popstate: No state or hash, navigating to root.`);
                }

                // Navigate using nodeId determined from state or default (root)
                OPTIMISM.model.navigateToNode(nodeId)
                    .then(success => {
                        if (success) {
                            OPTIMISM.log(`Popstate: Successfully navigated to node ${nodeId}.`);
                            // Render AFTER popstate state navigation is complete
                            OPTIMISM.view.renderWorkspace();
                        } else {
                             OPTIMISM.logError(`Popstate: Failed to navigate to node ${nodeId}, attempting root.`);
                             OPTIMISM.model.navigateToNode('root').then(() => OPTIMISM.view.renderWorkspace());
                        }
                    })
                    .catch(error => {
                        OPTIMISM.logError('Error handling popstate event:', error);
                        OPTIMISM.model.navigateToNode('root').then(() => OPTIMISM.view.renderWorkspace());
                    });
            });

            // --- Handle Initial Load/Hash ---
            let navigationPromise;
            if (initialHash && initialHash !== '#') {
                OPTIMISM.log(`Attempting to navigate to initial hash: ${initialHash}`);
                // Try navigating to the node specified in the hash
                navigationPromise = OPTIMISM.model.navigateToNodeByHash(initialHash);
            } else {
                // If no hash, ensure root state is set in history and resolve immediately
                OPTIMISM.log('No initial hash, starting at root.');
                // Ensure the history state matches the model state (root)
                if (!window.history.state || window.history.state.nodeId !== 'root') {
                     window.history.replaceState({ nodeId: 'root' }, '', '#');
                     OPTIMISM.log('Replaced history state for root.');
                }
                navigationPromise = Promise.resolve(true); // Indicate success (already at root)
            }

            // After attempting initial navigation (or confirming root)...
            navigationPromise.then(success => {
                if (success) {
                    OPTIMISM.log('Initial navigation state determined successfully.');
                } else {
                    OPTIMISM.logError('Failed to navigate to initial state from hash, rendering root.');
                    // Force navigation back to root if hash navigation failed unexpectedly
                    return OPTIMISM.model.navigateToNode('root'); // Chain the promise
                }
            }).catch(error => {
                OPTIMISM.logError('Error navigating to initial state from hash:', error);
                // Force navigation back to root on error
                return OPTIMISM.model.navigateToNode('root'); // Chain the promise
            }).finally(() => {
                 // *** ALWAYS render the workspace AFTER initial state is set ***
                 OPTIMISM.log('Performing initial workspace render.');
                 OPTIMISM.view.renderWorkspace();
                 OPTIMISM.log('Initial workspace render complete.');
            });
            // --- End Initial Load/Hash Handling ---

        }).catch(error => { // Catch errors from controller.initialize()
            clearTimeout(initTimeout);
            OPTIMISM.logError('Error during controller initialization:', error);
            // Handle fatal initialization error
             document.getElementById('loading-overlay').style.display = 'none'; // Hide loading
             alert('Error initializing application core components. Please refresh and try again.');
             document.getElementById('reset-db-button').style.display = 'block';
             document.getElementById('reset-db-button').addEventListener('click', OPTIMISM.resetDatabase);
        });

    } catch (error) { // Catch errors from creating model/view/controller
        clearTimeout(initTimeout);
        OPTIMISM.logError('Fatal error starting application:', error);
        alert('Error creating application components. Please refresh and try again.');
        document.getElementById('loading-overlay').style.display = 'none';
        document.getElementById('reset-db-button').style.display = 'block';
        document.getElementById('reset-db-button').addEventListener('click', OPTIMISM.resetDatabase);
    }
    // -------- END OF THE REQUESTED CODE BLOCK --------
} // End of OPTIMISM.init
// ... (rest of OPTIMISM object if any) ...

};

// Memory store for fallback when IndexedDB fails
class MemoryStore {
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
class SimpleDB {
    constructor(dbName) {
        this.dbName = dbName;
        this.db = null;
        this.memoryFallback = new MemoryStore();
        this.useMemory = false;
    }

    async open() {
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
        if (this.useMemory) {
            return this.memoryFallback.getData(id);
        }

        OPTIMISM.log(`Getting data from ${storeName}`);
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
        if (this.useMemory) {
            return this.memoryFallback.saveData(data);
        }

        OPTIMISM.log(`Saving data to ${storeName}`);
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
        if (this.useMemory) {
            if (storeName === 'imageData') {
                return this.memoryFallback.deleteImage(id);
            }
            return;
        }

        OPTIMISM.log(`Deleting data from ${storeName}`);
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
        if (this.useMemory) {
            if (storeName === 'imageData') {
                return Object.keys(this.memoryFallback.images);
            } else if (storeName === 'canvasData') {
                return Object.keys(this.memoryFallback.data);
            }
            return [];
        }

        OPTIMISM.log(`Getting all keys from ${storeName}`);
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

        OPTIMISM.log(`Clearing store ${storeName}`);
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

// Command base class
class Command {
    constructor(model) {
        this.model = model;
    }

    async execute() {
        throw new Error('Execute method must be implemented by subclasses');
    }

    async undo() {
        throw new Error('Undo method must be implemented by subclasses');
    }
}

// Command classes for undo/redo
class AddElementCommand extends Command {
    constructor(model, element) {
        super(model);
        this.element = element;
        this.nodeId = model.currentNode.id; // Store the current node ID
        this.isImage = element.type === 'image';
        this.imageData = null; // Will store image data if needed
    }



    async execute() {
        // If this is an image, save the image data first
        if (this.isImage && this.imageData) {
            OPTIMISM.log('Saving image data for new element');
            await this.model.saveImageData(this.element.imageDataId, this.imageData);
        }

        await this.model.addElement(this.element);
        return this.element.id;
    }

    async undo() {
        // Remove the element that was added
        await this.model.deleteElement(this.element.id);
    }

    // Set image data for later saving
    setImageData(imageData) {
        this.imageData = imageData;
    }
}

// Add this new command class in core.js

class MoveToInboxCommand extends Command {
    constructor(model, elementId) {
        super(model);
        this.elementId = elementId;
        const element = model.findElement(elementId);
        if (element) {
            this.element = {...element}; // Store a copy of the original element
            // --- NEW: Store original nested data ---
            const currentChildren = model.currentNode.children; // Get ref first
            const childNode = currentChildren ? currentChildren[elementId] : null; // Check existence
            this.originalChildNodeData = childNode ? JSON.parse(JSON.stringify(childNode)) : null; // Deep copy for undo
            OPTIMISM.log(`MoveToInboxCommand Constructor: Found childNode for ${elementId}:`, childNode ? '{...}' : 'null'); // Log presence/absence
            OPTIMISM.log(`MoveToInboxCommand Constructor: Stored originalChildNodeData for ${elementId}:`, this.originalChildNodeData ? '{...}' : 'null'); // Log presence/absence
        } else {
            OPTIMISM.log(`Element ${elementId} not found for MoveToInboxCommand`);
            this.element = null;
            this.originalChildNodeData = null;
        }
        this.nodeId = model.currentNode.id; // Node where the element originated
        this.inboxCard = null; // Will store the created inbox card info
    }

    // In core.js, update the MoveToInboxCommand's execute method
    async execute() {
        if (!this.element) return false;
        OPTIMISM.log(`MoveToInboxCommand Execute: Attempting to move ${this.elementId} with originalChildNodeData:`, this.originalChildNodeData ? '{...}' : 'null');

        // Add to inbox, passing the nested data
        this.inboxCard = await this.model.addToInbox(this.element, this.originalChildNodeData); // Pass nested data
        if (!this.inboxCard) {
            OPTIMISM.logError(`Failed to add element ${this.elementId} to inbox`);
            return false;
        }

        // Now delete the original element from the canvas
        OPTIMISM.log(`MoveToInboxCommand Execute: Calling deleteElement for original ${this.elementId}`);
        const deleteSuccess = await this.model.deleteElement(this.elementId);
        if (!deleteSuccess) {
             OPTIMISM.logError(`Failed to delete original element ${this.elementId} after moving to inbox.`);
             // Attempt to rollback by removing from inbox
             await this.model.removeFromInbox(this.inboxCard.id); // Use await here
             this.inboxCard = null;
             return false;
        }

        OPTIMISM.log(`Moved element ${this.elementId}${this.originalChildNodeData ? ' (with nested data)' : ''} to inbox`);
        return true;
        // --------------------------------------------------------------------
    }

    async undo() {
        if (!this.element || !this.inboxCard) return;

        // Find the inbox card to get its nested data (if any)
        const cardFromInbox = this.model.inboxCards.find(c => c.id === this.inboxCard.id);
        OPTIMISM.log(`MoveToInboxCommand Undo: Found inbox card ${this.inboxCard.id} for undo. Has nestedData:`, cardFromInbox?.nestedData ? '{...}' : 'null');

        // Remove from inbox
        const removed = await this.model.removeFromInbox(this.inboxCard.id);
        if (!removed) {
             OPTIMISM.logError(`Failed to remove card ${this.inboxCard.id} from inbox during undo`);
             // Continue anyway to try restoring to canvas
        }

        // Add the original element back to the original node's elements array
        if (!this.model.currentNode.elements) {
            this.model.currentNode.elements = [];
        }

        if (this.model.currentNode.id === this.nodeId) {
             this.model.currentNode.elements.push(this.element); // Restore original element

             // --- NEW: Restore original nested data ---
             if (this.originalChildNodeData) {
                 if (!this.model.currentNode.children) this.model.currentNode.children = {}; // Ensure children object exists
                 this.model.currentNode.children[this.element.id] = JSON.parse(JSON.stringify(this.originalChildNodeData)); // Restore deep copy
                 OPTIMISM.log(`Restored nested data for element ${this.elementId} during move to inbox undo`);
             }
             // --- END NEW ---

             await this.model.saveData(); // Save the change
             OPTIMISM.log(`Restored element ${this.elementId} to node ${this.nodeId} during move to inbox undo`);
        } else {
             OPTIMISM.logError(`Cannot restore element ${this.elementId} - current node is ${this.model.currentNode.id}, expected ${this.nodeId}`);
             // Potentially find the original node and add it back - more complex
        }
    }
}

class DeleteElementCommand extends Command {
    constructor(model, elementId) {
        super(model);
        this.elementId = elementId;
        const element = model.findElement(elementId);
        if (element) {
            this.element = {...element}; // Store a copy of the element
            this.nodeId = model.currentNode.id;
            // --- NEW: Store original nested data ---
            const childNode = model.currentNode.children ? model.currentNode.children[elementId] : null;
            this.originalChildNodeData = childNode ? JSON.parse(JSON.stringify(childNode)) : null; // Deep copy for undo

            // --- NEW: Store original image data (top-level and nested) ---
            this.allOriginalImageData = new Map(); // Map<imageDataId, base64Data>

        } else {
            OPTIMISM.log(`Element ${elementId} not found for DeleteElementCommand`);
            this.element = null;
            this.nodeId = model.currentNode.id;
            this.originalChildNodeData = null; // NEW
            this.allOriginalImageData = new Map(); // NEW
        }
    }

    // In core.js, modify the DeleteElementCommand's execute method
// In core.js, update the DeleteElementCommand's execute method
async execute() {
    if (!this.element) return false;

    // --- NEW: Backup image data before deletion ---
    let idsToBackup = [];
    if (this.element.type === 'image' && this.element.imageDataId) {
        idsToBackup.push(this.element.imageDataId);
    }
    if (this.originalChildNodeData) {
        idsToBackup = idsToBackup.concat(this.model.findAllImageIdsRecursive(this.originalChildNodeData));
    }
    idsToBackup = [...new Set(idsToBackup)]; // Remove duplicates

    OPTIMISM.log(`Backing up image data for ${idsToBackup.length} images before deletion.`);
    const backupPromises = idsToBackup.map(async (id) => {
        try {
            const data = await this.model.getImageData(id);
            if (data) {
                this.allOriginalImageData.set(id, data);
            } else {
                 OPTIMISM.log(`No image data found for ${id} during backup.`);
            }
        } catch (error) {
            OPTIMISM.logError(`Failed to backup image data for ${id}:`, error);
        }
    });
    await Promise.all(backupPromises);
    // --- END NEW ---

    // Model's deleteElement now handles queuing images and removing nested node data
    return await this.model.deleteElement(this.elementId);
}

    async undo() {
        if (!this.element) return;

         // Restore the element to the correct node (assuming current node is correct for simplicity)
        if (!this.model.currentNode.elements) {
            this.model.currentNode.elements = [];
        }
        this.model.currentNode.elements.push(this.element);

        // --- NEW: Restore nested data ---
        if (this.originalChildNodeData) {
            if (!this.model.currentNode.children) this.model.currentNode.children = {};
            this.model.currentNode.children[this.element.id] = JSON.parse(JSON.stringify(this.originalChildNodeData)); // Restore deep copy
             OPTIMISM.log(`Restored nested data for element ${this.element.id} during delete undo`);
        }

        // --- NEW: Restore image data ---
        if (this.allOriginalImageData.size > 0) {
            OPTIMISM.log(`Restoring ${this.allOriginalImageData.size} images during delete undo.`);
            const restorePromises = [];
            this.allOriginalImageData.forEach((data, id) => {
                restorePromises.push(this.model.saveImageData(id, data).catch(err => {
                    OPTIMISM.logError(`Failed to restore image ${id} during undo:`, err);
                }));
            });
            await Promise.all(restorePromises);
        }
        // --- END NEW ---

        // --- NEW: Remove images from deletion queue if they were just restored ---
        // This prevents them from being deleted shortly after being restored by undo
        const restoredImageIds = Array.from(this.allOriginalImageData.keys());
        if (restoredImageIds.length > 0) {
             const initialQueueLength = this.model.deletedImageQueue.length;
             this.model.deletedImageQueue = this.model.deletedImageQueue.filter(item => !restoredImageIds.includes(item.imageId));
             const removedCount = initialQueueLength - this.model.deletedImageQueue.length;
             if (removedCount > 0) {
                 OPTIMISM.log(`Removed ${removedCount} restored image(s) from the deletion queue.`);
                 await this.model.saveAppState(); // Save the updated queue
             }
        }
        // --- END NEW ---


        await this.model.saveData(); // Save the restored element and nested data
    }
}

class UpdateElementCommand extends Command {
    constructor(model, elementId, newProperties, explicitOldProperties = null) {
        super(model);
        this.elementId = elementId;
        this.newProperties = newProperties;

        // Use explicitly provided old properties if available, otherwise fetch them
        if (explicitOldProperties) {
            this.oldProperties = explicitOldProperties;

            // Determine if this is a text element
            const element = model.findElement(elementId);
            this.isText = element ? element.type === 'text' : false;
        } else {
            // Store the old properties that are being changed
            const element = model.findElement(elementId);
            if (element) {
                this.oldProperties = {};
                for (const key in newProperties) {
                    this.oldProperties[key] = element[key];
                }

                this.isText = element.type === 'text';
            } else {
                OPTIMISM.log(`Element ${elementId} not found for UpdateElementCommand`);
                this.oldProperties = null;
                this.isText = false;
            }
        }

        this.nodeId = model.currentNode.id;

        // Special handling for empty text (text elements only)
        this.mightDelete = this.isText &&
            newProperties.text !== undefined &&
            (newProperties.text === '' || newProperties.text === null || newProperties.text.trim() === '');

        // Get the original element for potential restoration
        const element = model.findElement(elementId);
        if (this.mightDelete && element) {
            // Store the full element for potential restoration
            this.fullElement = JSON.parse(JSON.stringify(element));
        }
    }

    // In the UpdateElementCommand's execute method
async execute() {
    if (!this.oldProperties) return false;

    // Check if this is a text update that would make text empty
    if (this.isText &&
        this.newProperties.text !== undefined &&
        (this.newProperties.text.trim() === '')) {

        OPTIMISM.log('Text is empty, element will be deleted');
        this.wasDeleted = true;
        await this.model.deleteElement(this.elementId);
        return true;
    }

    // Normal update
    await this.model.updateElement(this.elementId, this.newProperties);
    return true;
}

    async undo() {
        if (this.wasDeleted) {
            // Restore the full element if it was deleted due to empty text
            if (!this.model.currentNode.elements) {
                this.model.currentNode.elements = [];
            }
            this.model.currentNode.elements.push(this.fullElement);
            await this.model.saveData();
        } else if (this.oldProperties) {
            await this.model.updateElement(this.elementId, this.oldProperties);
        }
    }
}

class MoveElementCommand extends Command {
    constructor(model, sourceId, targetId) {
        super(model);
        this.sourceId = sourceId;
        this.targetId = targetId;

        const sourceElement = model.findElement(sourceId);
        if (sourceElement) {
            this.originalElement = { ...sourceElement }; // Store copy of original element
             // --- NEW: Store original nested data ---
            const childNode = model.currentNode.children ? model.currentNode.children[sourceId] : null;
            this.originalChildNodeData = childNode ? JSON.parse(JSON.stringify(childNode)) : null; // Deep copy for undo
        } else {
            OPTIMISM.log(`Source element ${sourceId} not found for MoveElementCommand`);
            this.originalElement = null;
            this.originalChildNodeData = null; // NEW
        }

        this.nodeId = model.currentNode.id;
        this.newElement = null; // Will store the element created in the target
        this.newChildNodeData = null; // Will store the nested data created in the target
        this.duplicatedImageIds = []; // Store IDs of duplicated images for undo
    }

    async execute() {
        if (!this.originalElement) return false;

        // 1. Perform the deep copy/move using the model method
        // This method internally handles creating new IDs, copying nested data,
        // duplicating images, and deleting the original.
        const moveSuccess = await this.model.moveElement(this.sourceId, this.targetId);

        if (moveSuccess) {
            // --- NEW: We need to find the *newly created* element and its data for undo ---
            // This is tricky because the ID changed. We might need moveElement to return the new ID.
            // For now, we'll assume the structure exists and rely on undo to restore the original.
            // A more robust undo would require storing the new ID and structure.
            // Let's modify moveElement to return the new element's ID
            // *** This requires changing `model.moveElement` to return the new ID ***
            // *** Assuming model.moveElement is NOT changed yet, undo might be limited ***

            OPTIMISM.log(`MoveElementCommand execute successful for source ${this.sourceId}`);
            return true;
        } else {
            OPTIMISM.logError(`MoveElementCommand execute failed for source ${this.sourceId}`);
            return false;
        }
    }

    async undo() {
        if (!this.originalElement) return;

        // --- This undo is complex because the original was deleted and a new one created ---
        // --- A simpler undo strategy might be needed if model.moveElement doesn't return new IDs ---

        // Ideal Undo (if model.moveElement returns new info or we find it):
        // 1. Find the *new* element and its *new* child node data in the *target* node.
        // 2. Delete the *new* element and its children from the *target* node (using a recursive delete).
        // 3. Delete any *duplicated* image data created during the move.
        // 4. Restore the *original* element and its *original* child node data to the *original* parent node.
        // 5. Restore any *original* image data (if it was somehow deleted).

        // --- Simplified Undo (assuming we only have original data) ---
        OPTIMISM.log(`Attempting simplified undo for MoveElementCommand (source: ${this.sourceId})`);

        // 1. Restore the original element to the original node
        if (!this.model.currentNode.elements) this.model.currentNode.elements = [];
        this.model.currentNode.elements.push(this.originalElement);

        // 2. Restore the original nested data
        if (this.originalChildNodeData) {
            if (!this.model.currentNode.children) this.model.currentNode.children = {};
            this.model.currentNode.children[this.originalElement.id] = JSON.parse(JSON.stringify(this.originalChildNodeData));
             OPTIMISM.log(`Restored nested data for element ${this.originalElement.id} during move undo`);
        }

        // 3. Restore original image data (this assumes the backup happened correctly during the initial delete part of the move)
         let idsToRestore = [];
         if (this.originalElement.type === 'image' && this.originalElement.imageDataId) {
             idsToRestore.push(this.originalElement.imageDataId);
         }
         if (this.originalChildNodeData) {
             idsToRestore = idsToRestore.concat(this.model.findAllImageIdsRecursive(this.originalChildNodeData));
         }
         idsToRestore = [...new Set(idsToRestore)];

         if (idsToRestore.length > 0) {
             // We don't have the backed-up data here, need to rely on the image deletion queue logic
             // OR the DeleteElementCommand needs to be more robust.
             // Let's assume the DeleteElement part handled backup/restore correctly.
              OPTIMISM.log(`Image data for ${idsToRestore.length} original images should be restored via delete queue undo mechanism if needed.`);
         }

        // 4. Problem: The copied element still exists in the target node.
        // Without knowing its new ID, we can't easily remove it here.
        // This highlights the need for `model.moveElement` to provide more info
        // or for a different command structure.
        OPTIMISM.logError(`Simplified Undo Warning: The copied element likely still exists in the target node ${this.targetId}. Manual cleanup might be needed.`);


        await this.model.saveData();
        OPTIMISM.log(`Restored original element ${this.originalElement.id} during move undo.`);

        // We need to re-render to show the restored element
        // Note: The view might show both the original and the moved copy until a refresh/reload if undo is imperfect.
    }
}

// Add this new command class at the end of the file, before the DOM content loaded event listener

class MoveElementToBreadcrumbCommand extends Command {
     constructor(model, elementId, navIndex) {
        super(model);
        this.elementId = elementId; // Original ID
        this.navIndex = navIndex; // Target breadcrumb index

        const sourceElement = model.findElement(elementId);
        if (sourceElement) {
            this.originalElement = { ...sourceElement };
            const childNode = model.currentNode.children ? model.currentNode.children[elementId] : null;
            this.originalChildNodeData = childNode ? JSON.parse(JSON.stringify(childNode)) : null;
        } else {
            this.originalElement = null;
            this.originalChildNodeData = null;
        }

        this.currentNodeId = model.currentNode.id; // Original parent node ID
        this.targetNodeId = model.navigationStack[navIndex].node.id; // Target parent node ID
        // Need info about the newly created element/node for proper undo
        this.newElementId = null;
        this.newImageDataId = null;
    }

    async execute() {
        if (!this.originalElement) return false;

        // Model method handles deep copy, new IDs, image duplication, original deletion
        const moveSuccess = await this.model.moveElementToBreadcrumb(this.elementId, this.navIndex);

        if (moveSuccess) {
             // Ideally, model.moveElementToBreadcrumb would return the new ID
             OPTIMISM.log(`MoveElementToBreadcrumb execute successful for source ${this.elementId}`);
             return true;
        } else {
            OPTIMISM.logError(`MoveElementToBreadcrumb execute failed for source ${this.elementId}`);
            return false;
        }

    }

    async undo() {
        if (!this.originalElement) return;

        // Simplified Undo (similar limitations as MoveElementCommand undo)
         OPTIMISM.log(`Attempting simplified undo for MoveElementToBreadcrumbCommand (source: ${this.elementId})`);

         // 1. Need to navigate back to the original node first
         const currentNavId = this.model.currentNode.id;
         if (currentNavId !== this.currentNodeId) {
             OPTIMISM.log(`Navigating back to original node ${this.currentNodeId} for undo.`);
            await this.model.navigateToNode(this.currentNodeId);
             // Note: This navigation might trigger renders, potentially complicating state
         }


        // 2. Restore the original element
        if (!this.model.currentNode.elements) {
            this.model.currentNode.elements = [];
        }
        this.model.currentNode.elements.push(this.originalElement);

        // 3. Restore the original nested data
        if (this.originalChildNodeData) {
            if (!this.model.currentNode.children) this.model.currentNode.children = {};
            this.model.currentNode.children[this.originalElement.id] = JSON.parse(JSON.stringify(this.originalChildNodeData));
             OPTIMISM.log(`Restored nested data for element ${this.originalElement.id} during breadcrumb move undo`);
        }

        // 4. Image data restoration relies on DeleteElementCommand's handling

        // 5. Problem: Copied element still exists in the target breadcrumb node.
        OPTIMISM.logError(`Simplified Undo Warning: The copied element likely still exists in the target breadcrumb node ${this.targetNodeId}. Manual cleanup might be needed.`);


        await this.model.saveData();
        OPTIMISM.log(`Restored original element ${this.originalElement.id} during breadcrumb move undo.`);

        // Navigate back to where the user was if we changed navigation? Or stay?
        // Let's stay in the restored node for now.
    }
}


// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', OPTIMISM.init);
