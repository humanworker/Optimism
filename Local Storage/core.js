// core.js

// --- Add Static Imports ---
// Keep Model and Controller static for now, View will be dynamic
import { CanvasModel } from './model.js';
// import { CanvasView } from './view/CanvasView.js'; // Correct path - REMOVED for dynamic import
import { CanvasController } from './controller.js';

// Core application code
const OPTIMISM = { // Define OPTIMISM object first
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
// Update the init function in core.js
init: async function() { // Make init async
    OPTIMISM.log('Application starting...');

    // Setup global error handlers
    window.addEventListener('error', (event) => { OPTIMISM.logError('Uncaught error:', event.error); });
    window.addEventListener('unhandledrejection', (event) => { OPTIMISM.logError('Unhandled promise rejection:', event.reason); });
    const initialHash = window.location.hash;
    if (!window.indexedDB) {
        OPTIMISM.logError('IndexedDB not supported', new Error('Browser does not support IndexedDB'));
        document.getElementById('loading-status').textContent = 'Your browser does not support IndexedDB. Using memory-only mode.';
        OPTIMISM.showMemoryMode();
     }
    const initTimeout = setTimeout(() => {
        OPTIMISM.logError('Initialization timed out', new Error('Application did not initialize within 10 seconds'));
        document.getElementById('loading-status').textContent = 'Initialization timed out. Please reset database and reload.';
        document.getElementById('reset-db-button').style.display = 'block';
        document.getElementById('reset-db-button').addEventListener('click', OPTIMISM.resetDatabase);
    }, 10000); // 10 seconds timeout

    // -------- START: REVISED SECTION --------
    try {
        // Dynamically import the view module
        OPTIMISM.log("Attempting to import CanvasView from './view/CanvasView.js'");
        let CanvasViewModule;
        try {
            CanvasViewModule = await import('./view/CanvasView.js');
        } catch (importError) {
            OPTIMISM.logError("Failed during import() call:", importError);
            throw importError; // Re-throw to be caught by outer catch
        }
        OPTIMISM.log("Import call completed. Module content:", CanvasViewModule);
        const { CanvasView } = CanvasViewModule; // Destructure AFTER successful import
        OPTIMISM.log('CanvasView module loaded successfully.');

        // Instantiate using imported classes
        try {
            OPTIMISM.model = new CanvasModel(); // Uses imported SimpleDB via model.js
            OPTIMISM.view = new CanvasView(OPTIMISM.model, null); // Uses imported CanvasView
            OPTIMISM.controller = new CanvasController(OPTIMISM.model, OPTIMISM.view); // Use imported CanvasController

            OPTIMISM.view.controller = OPTIMISM.controller; // Set controller reference in view

            // Initialize the controller (which loads data, sets up listeners via view, etc.)
            await OPTIMISM.controller.initialize(); // Use await here

            clearTimeout(initTimeout); // Clear timeout AFTER successful init

            // Setup popstate listener (remains the same)
            window.addEventListener('popstate', (event) => {
               // ... existing popstate logic ...
               OPTIMISM.log('Popstate event triggered', event.state); // Log event
               let nodeId = 'root'; // Default to root
               if (event.state && event.state.nodeId) {
                   nodeId = event.state.nodeId;
               } else if (window.location.hash && window.location.hash !== '#') {
                    // Handle hash-based popstate
                    OPTIMISM.log(`Popstate: Navigating via hash: ${window.location.hash}`);
                    OPTIMISM.model.navigateToNodeByHash(window.location.hash)
                        .then(success => { /* ... */ })
                        .catch(error => { /* ... */ })
                        .finally(() => {
                            OPTIMISM.log('Rendering workspace after popstate hash navigation.'); // Add log
                            OPTIMISM.view.renderWorkspace(); // Ensure render
                        });
                    return; // Exit early for hash handling
               }
               // Navigate using nodeId from state or default
               OPTIMISM.model.navigateToNode(nodeId)
                   .then(success => {
                      if (!success) { OPTIMISM.logError(`Popstate: Failed to navigate to node ${nodeId}, attempting root.`); }
                   })
                   .catch(error => {
                       OPTIMISM.logError('Error handling popstate event:', error);
                       OPTIMISM.model.navigateToNode('root').then(() => OPTIMISM.view.renderWorkspace());
                   })
                   .finally(() => {
                       OPTIMISM.log(`Rendering workspace after popstate navigation to ${nodeId}.`); // Add log
                       OPTIMISM.view.renderWorkspace(); // Make sure render happens
                   });
               // Ensure renderWorkspace is called within its .finally()
            });

            // Handle Initial Load/Hash (remains mostly the same, use await)
            let navigationSuccess = true;
            if (initialHash && initialHash !== '#') {
                OPTIMISM.log(`Attempting to navigate to initial hash: ${initialHash}`);
                navigationSuccess = await OPTIMISM.model.navigateToNodeByHash(initialHash);
                if (!navigationSuccess) {
                     OPTIMISM.logError('Failed to navigate to initial state from hash, navigating to root.');
                     await OPTIMISM.model.navigateToNode('root');
                }
            } else {
                OPTIMISM.log('No initial hash, starting at root.');
                if (!window.history.state || window.history.state.nodeId !== 'root') {
                     window.history.replaceState({ nodeId: 'root' }, '', '#');
                     OPTIMISM.log('Replaced history state for root.');
                }
            }

            OPTIMISM.log('Initial navigation state determined. Performing initial workspace render.');
            OPTIMISM.view.renderWorkspace(); // Initial render
            OPTIMISM.log('Initial workspace render complete.');

        } catch(instantiationError) {
             clearTimeout(initTimeout);
             OPTIMISM.logError('Error instantiating MVC components:', instantiationError);
             alert('Error creating application components. Please ensure all scripts loaded correctly.');
             // ... fatal error handling ...
             document.getElementById('loading-overlay').style.display = 'none';
             document.getElementById('reset-db-button').style.display = 'block';
             document.getElementById('reset-db-button').addEventListener('click', OPTIMISM.resetDatabase);
        }

    } catch (error) { // Catch errors from import or top-level init logic
        clearTimeout(initTimeout);
        OPTIMISM.logError('Fatal error starting application:', error);
        // ... existing fatal error handling ...
         alert('Error creating application components or initializing. Please refresh and try again.');
         document.getElementById('loading-overlay').style.display = 'none';
         document.getElementById('reset-db-button').style.display = 'block';
         document.getElementById('reset-db-button').addEventListener('click', OPTIMISM.resetDatabase);
    }
    // -------- END: REVISED SECTION --------

} // End of OPTIMISM.init
// ... rest of OPTIMISM object ...
};

// Make OPTIMISM global immediately so classic scripts can use it
window.OPTIMISM = OPTIMISM; // Still useful for console debugging maybe

// Initialize after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (OPTIMISM && OPTIMISM.init) {
        OPTIMISM.init().catch(err => {
            console.error("Error caught during OPTIMISM.init execution:", err);
            // Display a user-friendly error message if needed
        });
    } else {
        console.error("OPTIMISM or OPTIMISM.init not defined by DOMContentLoaded");
    }
});
