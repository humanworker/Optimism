// Optimization: Cache DOM elements frequently accessed by utils
const debugPanel = document.getElementById('debug-panel');
const loadingStatus = document.getElementById('loading-status');
const statusMessage = document.getElementById('status-message');
const resetButton = document.getElementById('reset-db-button');

export const OPTIMISM_UTILS = {
    // Simple logging utility
    log: (message, ...args) => {
        console.log(message, ...args);
        if (debugPanel && debugPanel.style.display !== 'none') {
            try {
                const entry = document.createElement('div');
                // Basic serialization for objects/arrays in log
                const textContent = [message, ...args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg)].join(' ');
                entry.textContent = textContent;
                debugPanel.appendChild(entry);
                // Optimization: Only scroll if near the bottom
                if (debugPanel.scrollHeight - debugPanel.scrollTop <= debugPanel.clientHeight + 50) {
                    debugPanel.scrollTop = debugPanel.scrollHeight;
                }
            } catch (e) { console.error("Error writing to debug panel:", e); }
        }

        // Update loading status ONLY if loading overlay is visible
        if (loadingStatus && document.getElementById('loading-overlay').style.display !== 'none') {
            loadingStatus.textContent = typeof message === 'string' ? message : JSON.stringify(message);
        }
    },

    // Error logging
    logError: (message, error) => {
        const errorMsg = `ERROR: ${message} ${error ? (error.message || error.toString()) : ''}`;
        console.error(errorMsg, error); // Log the actual error object too
        if (debugPanel && debugPanel.style.display !== 'none') {
             try {
                const entry = document.createElement('div');
                entry.textContent = errorMsg;
                entry.style.color = '#ff5555'; // Use CSS variable or fallback
                debugPanel.appendChild(entry);
                debugPanel.scrollTop = debugPanel.scrollHeight; // Always scroll on error
             } catch (e) { console.error("Error writing error to debug panel:", e); }
        }
    },

    // Reset database function
    resetDatabase: () => {
        if (confirm('Are you sure you want to reset all data? This cannot be undone.')) {
            OPTIMISM_UTILS.log('Resetting database...');
            localStorage.setItem('optimism_db_reset', 'true');
            // Clear potentially problematic session/local storage if needed
            // sessionStorage.clear();
            // localStorage.clear(); // Use with caution! Clears everything.
            window.location.reload();
        }
    },

    // Show memory mode indicator
    showMemoryMode: () => {
        OPTIMISM_UTILS.log('Switching to memory-only mode.');
        if(statusMessage) statusMessage.style.display = 'block';
        if (resetButton) {
            resetButton.style.display = 'block';
            // Ensure listener is only added once
            if (!resetButton.dataset.listenerAdded) {
                resetButton.addEventListener('click', OPTIMISM_UTILS.resetDatabase);
                resetButton.dataset.listenerAdded = 'true';
            }
        }
    },

    // Image Resizing Utility
    resizeImage: async (file, maxDimension = 1200, quality = 0.95, displayMaxDimension = 600) => {
        OPTIMISM_UTILS.log(`Resizing image: maxStore=${maxDimension}, maxDisplay=${displayMaxDimension}, quality=${quality}`);

        return new Promise((resolve, reject) => {
            const img = new Image();
            const reader = new FileReader();

            const timeout = setTimeout(() => {
                OPTIMISM_UTILS.logError('Image loading timed out', new Error('Timeout'));
                reject(new Error('Image loading timed out'));
            }, 15000); // 15 second timeout

            reader.onload = (e) => {
                img.onload = () => {
                    clearTimeout(timeout);
                    try {
                        let storageWidth = img.width;
                        let storageHeight = img.height;
                        let displayWidth = img.width;
                        let displayHeight = img.height;

                        // Calculate storage dimensions
                        if (storageWidth > storageHeight && storageWidth > maxDimension) {
                            storageHeight = Math.round(storageHeight * (maxDimension / storageWidth));
                            storageWidth = maxDimension;
                        } else if (storageHeight > maxDimension) {
                            storageWidth = Math.round(storageWidth * (maxDimension / storageHeight));
                            storageHeight = maxDimension;
                        }

                        // Calculate display dimensions based on ORIGINAL aspect ratio
                        if (displayWidth > displayHeight && displayWidth > displayMaxDimension) {
                            displayHeight = Math.round(img.height * (displayMaxDimension / img.width)); // Use original height/width
                            displayWidth = displayMaxDimension;
                        } else if (displayHeight > displayMaxDimension) {
                            displayWidth = Math.round(img.width * (displayMaxDimension / img.height)); // Use original height/width
                            displayHeight = displayMaxDimension;
                        }

                        const canvas = document.createElement('canvas');
                        canvas.width = storageWidth;
                        canvas.height = storageHeight;
                        const ctx = canvas.getContext('2d');
                        // Improve quality for downscaling
                        ctx.imageSmoothingQuality = 'high';
                        ctx.drawImage(img, 0, 0, storageWidth, storageHeight);

                        // toDataURL is synchronous, handle potential errors
                        try {
                            const dataUrl = canvas.toDataURL('image/jpeg', quality);
                            OPTIMISM_UTILS.log(`Image resized: Store=${storageWidth}x${storageHeight}, Display=${displayWidth}x${displayHeight}`);
                            resolve({
                                data: dataUrl,
                                width: displayWidth,
                                height: displayHeight,
                                storageWidth: storageWidth,
                                storageHeight: storageHeight
                            });
                        } catch (canvasError) {
                             OPTIMISM_UTILS.logError('Error converting canvas to data URL:', canvasError);
                             // Fallback or reject
                             reject(canvasError);
                        }
                    } catch (processingError) {
                        OPTIMISM_UTILS.logError('Error processing image during resize:', processingError);
                        reject(processingError);
                    }
                };
                img.onerror = () => {
                    clearTimeout(timeout);
                    OPTIMISM_UTILS.logError('Failed to load image into Image() object', new Error('Image.onload error'));
                    reject(new Error('Failed to load image into Image() object'));
                };
                if (!e.target || !e.target.result) {
                     clearTimeout(timeout);
                     OPTIMISM_UTILS.logError('FileReader error: event target result is missing.', new Error('FileReader result missing'));
                    reject(new Error('FileReader error: event target result is missing.'));
                    return;
                }
                img.src = e.target.result;
            };
            reader.onerror = () => {
                clearTimeout(timeout);
                OPTIMISM_UTILS.logError('Failed to read file', new Error('FileReader onerror'));
                reject(new Error('Failed to read file'));
            };

            try {
                 reader.readAsDataURL(file);
            } catch (readError) {
                 clearTimeout(timeout);
                 OPTIMISM_UTILS.logError('Error starting FileReader:', readError);
                 reject(readError);
            }
        });
    },

    // Generate URL Slug
    generateSlug: (text) => {
        if (!text || typeof text !== 'string') return 'untitled';
        return text.toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '') // Remove non-word, non-space, non-hyphen
            .replace(/[\s]+/g, '-') // Replace spaces with hyphens
            .replace(/--+/g, '-') // Replace multiple hyphens with single
            .replace(/^-+|-+$/g, '') // Trim hyphens
            .substring(0, 30); // Limit length
    },

     // Helper to check if modifier key (CMD on Mac, CTRL elsewhere) is pressed
     isModifierKeyPressed: (event) => {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        return isMac ? event.metaKey : event.ctrlKey;
    },

    // Find Element by ID recursively throughout the data structure
    findElementByIdRecursive: (node, elementId) => {
        if (!node) return null;
        // Check elements in this node
        if (node.elements) {
            const element = node.elements.find(el => el && el.id === elementId);
            if (element) return element;
        }
        // Check in children nodes
        if (node.children) {
            for (const childId in node.children) {
                const foundElement = OPTIMISM_UTILS.findElementByIdRecursive(node.children[childId], elementId);
                if (foundElement) return foundElement;
            }
        }
        return null;
    },

};