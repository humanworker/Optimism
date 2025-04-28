// Model to manage data
class CanvasModel {
    constructor() {
        this.db = new SimpleDB('optimismDB');
        this.navigationStack = [{
            nodeId: 'root',
            nodeTitle: 'Home',
            node: null  // Root node will be populated after data load
        }];

        this.data = null; // Will be loaded asynchronously
        this.isDarkTheme = true; // Default theme
        this.currentNode = null; // Will be set after data load
        this.selectedElement = null;
        this.editCounter = 0;
        this.lastBackupReminder = 0;
        this.backupReminderThreshold = 200;
        this.deletedImageQueue = []; // Queue of deleted image IDs with edit counters
        this.imagesLocked = false; // Add this property to track image lock state
        this.lockedCards = []; // Array to store IDs of individually locked cards
        // Quick links in the nav bar (new)
        this.quickLinks = [];
        this.quickLinkExpiryCount = 100; // Links expire after 100 edits

        // Command history for undo/redo
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistorySize = 50; // Limit history size to prevent memory issues
        this.isNestingDisabled = false; // Add this line to track nesting setting
        // Debug panel visibility state
        this.isDebugVisible = false;
        this.inboxCards = []; // Array to store inbox cards
        this.isInboxVisible = false; // Track inbox panel visibility
        this.isSettingsVisible = false; // Add this line
        this.isGridVisible = false;
        this.gridLayout = '1x2'; // Default layout
        this.isArenaVisible = false; // Track are.na panel visibility
        this.priorityCards = []; // Array to store IDs of priority cards
        this.isPrioritiesVisible = false; // Track priorities panel visibility

        // Panel management
        this.panels = {
            settings: false,
            inbox: false,
            grid: false,
            arena: false
            // Add future panels here
        };
    }

    // In model.js, update the initialize method
    async initialize() {
        try {
            OPTIMISM.log('Initializing database...');
            await this.db.open();

            OPTIMISM.log('Loading data...');
            await this.loadData();

            OPTIMISM.log('Loading theme...');
            await this.loadTheme();

            // Add logging for initial edit counter state
            OPTIMISM.log(`Current edit counter: #${this.editCounter}`);
            const editsUntilBackup = this.backupReminderThreshold - (this.editCounter - this.lastBackupReminder);
            OPTIMISM.log(`Backup reminder will appear in ${editsUntilBackup} edits`);

            if (this.deletedImageQueue.length > 0) {
                const nextDeletion = this.deletedImageQueue[0].deleteAtCounter;
                const editsUntilDeletion = nextDeletion - this.editCounter;
                OPTIMISM.log(`${this.deletedImageQueue.length} images in deletion queue (next in ${editsUntilDeletion} edits)`);
            }

            OPTIMISM.log('Model initialization complete');
            return true;
        } catch (error) {
            OPTIMISM.logError('Failed to initialize model:', error);

            // Fallback to memory-only mode
            OPTIMISM.log('Falling back to memory-only mode');
            this.data = {
                id: 'root',
                title: 'Home',
                elements: [],
                children: {}
            };
            this.navigationStack[0].node = this.data;
            this.currentNode = this.data;

            OPTIMISM.showMemoryMode();
            return true; // Still return true to let the app load
        }
    }


    async loadData() {
        try {
            let data = await this.db.getData('canvasData', 'root');

            if (!data) {
                OPTIMISM.log('No existing data, creating default structure');
                data = {
                    id: 'root',
                    title: 'Home',
                    elements: [],
                    children: {}
                };
                await this.db.put('canvasData', data);
            }

            this.data = data;
            this.navigationStack[0].node = this.data;
            this.currentNode = this.data;

            // Load app state (including edit counter and backup reminder)
            try {
                const appState = await this.db.getData('canvasData', 'appState');
                if (appState) {
                    if (appState.deletedImageQueue) {
                        this.deletedImageQueue = appState.deletedImageQueue;
                        OPTIMISM.log(`Loaded deleted image queue with ${this.deletedImageQueue.length} entries`);
                    }

                    // Load edit counter and backup reminder
                    if (appState.editCounter !== undefined) {
                        this.editCounter = appState.editCounter;
                        OPTIMISM.log(`Loaded edit counter: ${this.editCounter}`);
                    }

                    if (appState.priorityCards !== undefined) {
                        this.priorityCards = appState.priorityCards;
                        OPTIMISM.log(`Loaded ${this.priorityCards.length} priority cards`);
                    }

                    if (appState.isPrioritiesVisible !== undefined) {
                        this.isPrioritiesVisible = appState.isPrioritiesVisible;
                        OPTIMISM.log(`Loaded priorities visibility state: ${this.isPrioritiesVisible}`);
                    }

                    if (appState.lastBackupReminder !== undefined) {
                        this.lastBackupReminder = appState.lastBackupReminder;
                        OPTIMISM.log(`Loaded last backup reminder: ${this.lastBackupReminder}`);
                    }

                    // Add this block to load the imagesLocked state
                    if (appState.imagesLocked !== undefined) {
                        this.imagesLocked = appState.imagesLocked;
                        OPTIMISM.log(`Loaded images locked state: ${this.imagesLocked}`);
                    }

                    // Load quick links (new)
                    if (appState.quickLinks !== undefined) {
                        this.quickLinks = appState.quickLinks;
                        OPTIMISM.log(`Loaded ${this.quickLinks.length} quick links`);
                    }

                    if (appState.isSettingsVisible !== undefined) {
                        this.isSettingsVisible = appState.isSettingsVisible;
                        OPTIMISM.log(`Loaded settings visibility state: ${this.isSettingsVisible}`);
                    }

                    // In the loadData method, inside the check for appState
                    if (appState.isNestingDisabled !== undefined) {
                        this.isNestingDisabled = appState.isNestingDisabled;
                        OPTIMISM.log(`Loaded nesting disabled state: ${this.isNestingDisabled}`);
                    }

                    // Load Are.na panel state
                    if (appState.isArenaVisible !== undefined) {
                        this.isArenaVisible = appState.isArenaVisible;
                        OPTIMISM.log(`Loaded Are.na panel state: ${this.isArenaVisible}`);
                    }

                    // Load locked cards
                    if (appState.lockedCards !== undefined) {
                        this.lockedCards = appState.lockedCards;
                        OPTIMISM.log(`Loaded ${this.lockedCards.length} locked cards`);
                    }

                    if (appState.inboxCards !== undefined) {
                        this.inboxCards = appState.inboxCards;
                        OPTIMISM.log(`Loaded ${this.inboxCards.length} inbox cards`);
                    }

                    if (appState.isInboxVisible !== undefined) {
                        this.isInboxVisible = appState.isInboxVisible;
                        OPTIMISM.log(`Loaded inbox visibility state: ${this.isInboxVisible}`);
                    }

                    // Add to the existing loadData method in model.js, in the section where it loads appState
                    if (appState.isGridVisible !== undefined) {
                        this.isGridVisible = appState.isGridVisible;
                        OPTIMISM.log(`Loaded grid visibility state: ${this.isGridVisible}`);
                    }

                    if (appState.gridLayout !== undefined) {
                        this.gridLayout = appState.gridLayout;
                        OPTIMISM.log(`Loaded grid layout: ${this.gridLayout}`);
                    }

                }
            } catch (error) {
                OPTIMISM.logError('Error loading app state:', error);
                // Continue with default values
            }

            return data;
        } catch (error) {
            OPTIMISM.logError('Error loading data:', error);
            throw error;
        }
    }

    async saveData() {
        try {
            await this.db.put('canvasData', this.data);
        } catch (error) {
            OPTIMISM.logError('Error saving data:', error);
            throw error;
        }
    }

    async loadTheme() {
        try {
            const themeData = await this.db.getTheme();
            if (themeData) {
                this.isDarkTheme = themeData.isDarkTheme;
            }
        } catch (error) {
            OPTIMISM.logError('Error loading theme:', error);
            // Continue with default theme
        }
    }

    async saveTheme() {
        try {
            await this.db.saveTheme({
                id: 'theme',
                isDarkTheme: this.isDarkTheme
            });
        } catch (error) {
            OPTIMISM.logError('Error saving theme:', error);
        }
    }

    // --- NEW HELPER: Recursively find the path to an element ---
    findPathToElementRecursive(currentNode, targetElementId, currentPath) {
        // Check elements in the current node
        if (currentNode.elements) {
            const elementIndex = currentNode.elements.findIndex(el => el.id === targetElementId);
            if (elementIndex !== -1) {
                // Found the element! Return the path to its parent node.
                return true;
            }
        }

        // Check children nodes
        if (currentNode.children) {
            for (const childId in currentNode.children) {
                currentPath.push(childId); // Add child to path tentatively
                if (this.findPathToElementRecursive(currentNode.children[childId], targetElementId, currentPath)) {
                    // Found it down this branch
                    return true;
                }
                currentPath.pop(); // Backtrack if not found in this branch
            }
        }

        // Not found in this subtree
        return false;
    }

    // --- NEW HELPER: Get the full path to an element's parent ---
    findNavigationPathToParent(targetElementId) {
        const path = ['root']; // Start with root
        if (this.findPathToElementRecursive(this.data, targetElementId, path)) {
            return path; // Returns the path ending with the PARENT node ID
        }
        return null; // Element not found anywhere
    }
    // --- END NEW HELPERS ---


    // Save image data
    async saveImageData(imageId, imageData) {
        try {
            await this.db.saveImage(imageId, imageData);
        } catch (error) {
            OPTIMISM.logError('Error saving image data:', error);
            throw error;
        }
    }

    // Get image data
    async getImageData(imageId) {
        try {
            const result = await this.db.getImage(imageId);
            return result;
        } catch (error) {
            OPTIMISM.logError('Error getting image data:', error);
            throw error;
        }
    }

    // Delete image data
    async deleteImageData(imageId) {
        try {
            await this.db.deleteImage(imageId);
        } catch (error) {
            OPTIMISM.logError('Error deleting image data:', error);
            throw error;
        }
    }

    // Toggle debug panel visibility
    toggleDebugPanel() {
        this.isDebugVisible = !this.isDebugVisible;
        return this.isDebugVisible;
    }

    // In model.js, add a log to the execute method
    async execute(command) {
        try {
            OPTIMISM.log(`Executing ${command.constructor.name}`);
            // Execute the command and save its result
            const result = await command.execute();

            // Add to undo stack
            this.undoStack.push(command);

            // Clear redo stack when a new action is performed
            this.redoStack = [];

            // Limit undo stack size
            if (this.undoStack.length > this.maxHistorySize) {
                this.undoStack.shift(); // Remove oldest command
            }

            // Increment edit counter and check if backup reminder is needed
            const showBackupReminder = this.incrementEditCounter();

            return { result, showBackupReminder };
        } catch (error) {
            OPTIMISM.logError('Error executing command:', error);
            throw error;
        }
    }

    async undo() {
        if (this.undoStack.length === 0) return false;

        try {
            OPTIMISM.log('Undoing last two actions (if available)');

            // Create a counter to track how many actions we've undone
            let actionsUndone = 0;
            const maxActionsToUndo = 2;

            // Keep undoing until we reach our limit or run out of actions
            while (actionsUndone < maxActionsToUndo && this.undoStack.length > 0) {
                // Get the last command from the undo stack
                const command = this.undoStack.pop();

                // Execute the undo action
                await command.undo();

                // Add to redo stack
                this.redoStack.push(command);

                // Limit redo stack size
                if (this.redoStack.length > this.maxHistorySize) {
                    this.redoStack.shift(); // Remove oldest command
                }

                // Increment our counter
                actionsUndone++;
            }

            OPTIMISM.log(`Undid ${actionsUndone} action(s)`);
            return true;
        } catch (error) {
            OPTIMISM.logError('Error during undo:', error);
            return false;
        }
    }

    async redo() {
        if (this.redoStack.length === 0) return false;

        try {
            OPTIMISM.log('Redoing last two actions (if available)');

            // Create a counter to track how many actions we've redone
            let actionsRedone = 0;
            const maxActionsToRedo = 2;

            // Keep redoing until we reach our limit or run out of actions
            while (actionsRedone < maxActionsToRedo && this.redoStack.length > 0) {
                // Get the last command from the redo stack
                const command = this.redoStack.pop();

                // Execute the command again
                await command.execute();

                // Add back to undo stack
                this.undoStack.push(command);

                // Increment our counter
                actionsRedone++;
            }

            OPTIMISM.log(`Redid ${actionsRedone} action(s)`);
            return true;
        } catch (error) {
            OPTIMISM.logError('Error during redo:', error);
            return false;
        }
    }

    canUndo() {
        return this.undoStack.length > 0;
    }

    canRedo() {
        return this.redoStack.length > 0;
    }

    async addElement(element) {
        if (!this.currentNode.elements) {
            this.currentNode.elements = [];
        }
        this.currentNode.elements.push(element);
        await this.saveData();
        return element;
    }

    async updateElement(id, properties) {
        const element = this.findElement(id);
        if (element) {
            Object.assign(element, properties);

            // Delete element if text is empty (for text elements only)
            if (element.type === 'text' &&
                properties.text !== undefined &&
                (properties.text === '' || properties.text === null || properties.text.trim() === '')) {
                await this.deleteElement(id);
                return null; // Return null to indicate the element was deleted
            }

            await this.saveData();
            return element; // Return the updated element
        }
        return null; // Element not found
    }

    // Modify the deleteElement method to remove associated child node data
    async deleteElement(id) {
        if (!this.currentNode.elements) return false;

        const index = this.currentNode.elements.findIndex(el => el.id === id); // Use const
        if (index !== -1) {
            const element = this.currentNode.elements[index];
            OPTIMISM.log(`deleteElement: Starting deletion for element ${id} of type ${element.type}`);

            // --- NEW: Remove associated child node data if it exists ---
            let collectedImageIds = [];
            const currentChildren = this.currentNode.children; // Get ref
            if (currentChildren && currentChildren[id]) { // Check existence
                OPTIMISM.log(`Deleting nested child node structure for element ${id}`);
                const nodeToDelete = currentChildren[id];
                collectedImageIds = this.findAllImageIdsRecursive(nodeToDelete); // Find images *before* deleting node
                delete currentChildren[id]; // Delete the child node entry using the ref
                 OPTIMISM.log(`Removed child node entry for ${id}. Found ${collectedImageIds.length} nested images.`);
            }
            // --- END NEW ---

            // If it's an image element, also collect its ID for deletion
            if (element.type === 'image' && element.imageDataId) {
                collectedImageIds.push(element.imageDataId);
                OPTIMISM.log(`Added top-level image ${element.imageDataId} to deletion list.`);
            }

            // Remove element from array
            this.currentNode.elements.splice(index, 1);

            // Queue all collected image IDs for deletion
            const uniqueImageIds = [...new Set(collectedImageIds)]; // Ensure uniqueness
            if (uniqueImageIds.length > 0) {
                const deleteAtCounter = this.editCounter + 10; // Use a consistent delay
                OPTIMISM.log(`Queueing ${uniqueImageIds.length} image(s) for deletion (element ${id} and descendants) at edit #${deleteAtCounter}`);
                uniqueImageIds.forEach(imageId => {
                    this.deletedImageQueue.push({ imageId, deleteAtCounter }); // Add to queue
                });
                // Save app state immediately to persist the queue
                await this.saveAppState();
            }

            // Save canvas data
            await this.saveData();
            OPTIMISM.log(`deleteElement: Completed deletion for element ${id}`);

            return true;
        }
        return false;
    }

    findElement(id) {
        return this.currentNode.elements?.find(el => el.id === id);
    }

    // Check if an element has children cards
    hasChildren(elementId) {
        if (!this.currentNode.children) return false;
        return !!this.currentNode.children[elementId] &&
            (this.currentNode.children[elementId].elements?.length > 0 ||
                Object.keys(this.currentNode.children[elementId].children || {}).length > 0);
    }

    async navigateToElement(elementId) {
        const element = this.findElement(elementId);
        if (!element) return false;
        if (!this.currentNode.children) {
            this.currentNode.children = {};
        }

        // Create a child node if it doesn't exist
        if (!this.currentNode.children[elementId]) {
            let nodeTitle = "Untitled";

            if (element.type === 'text') {
                nodeTitle = element.text ?
                    (element.text.trim() === "" ? "Untitled" : element.text.substring(0, 60)) :
                    "Untitled";
            } else if (element.type === 'image') {
                nodeTitle = "Image";
            }

            this.currentNode.children[elementId] = {
                id: elementId,
                parentId: this.currentNode.id,
                title: nodeTitle,
                elements: [],
                children: {}
            };
        } else {
            // If the node exists but we're updating a text element, update the title
            if (element.type === 'text') {
                const nodeTitle = element.text ?
                    (element.text.trim() === "" ? "Untitled" : element.text.substring(0, 60)) :
                    "Untitled";
                this.currentNode.children[elementId].title = nodeTitle;
            }
        }

        // Add to navigation stack
        this.navigationStack.push({
            nodeId: elementId,
            nodeTitle: this.currentNode.children[elementId].title,
            node: this.currentNode.children[elementId]
        });

        // Update current node
        this.currentNode = this.currentNode.children[elementId];

        // Clear selected element when navigating
        this.selectedElement = null;

        // Update URL hash
        this.updateUrlHash();

        // Update browser history
        window.history.pushState({ nodeId: elementId }, '', this.generateUrlHash(elementId));

        await this.saveData();
        return true;
    }

    // --- NEW METHOD: Navigate directly into an element ---
    async navigateToElementDirectly(elementId) {
        OPTIMISM.log(`Attempting direct navigation into element: ${elementId}`);

        // 1. Find the path to the PARENT node containing the element
        const parentPathIds = this.findNavigationPathToParent(elementId);
        if (!parentPathIds) {
            OPTIMISM.logError(`Could not find path to parent of element ${elementId}`);
            return false;
        }
        OPTIMISM.log(`Found parent path: ${parentPathIds.join(' -> ')}`);

       // 2. Construct the new navigation stack up to the PARENT
       const newNavStack = [];
       let currentNodeData = this.data; // Start with root data object

       for (let i = 0; i < parentPathIds.length; i++) {
           const nodeId = parentPathIds[i]; // The ID for the node at this level

           if (!currentNodeData) {
               // This should ideally not happen if path finding starts from root
               OPTIMISM.logError(`Error building nav stack: currentNodeData became null before processing ${nodeId}`);
               return false;
           }

           // Add the data for the current node level to the stack
           newNavStack.push({
               nodeId: nodeId,
               nodeTitle: nodeId === 'root' ? 'Home' : (currentNodeData.title || 'Untitled'),
               node: currentNodeData // Add the actual node object
           });

           // If this isn't the last ID in the path, prepare for the next iteration
           // by finding the next node's data object within the current node's children.
           if (i < parentPathIds.length - 1) {
               const nextNodeId = parentPathIds[i + 1];

               // Check if the current node *has* children and if the *next* ID exists within them
               if (currentNodeData.children && currentNodeData.children[nextNodeId]) {
                   // Successfully found the next node's data, update for the next loop iteration
                   currentNodeData = currentNodeData.children[nextNodeId];
               } else {
                   // *** This is where the error occurs for nested items ***
                   OPTIMISM.logError(`Error building nav stack: Node data missing for child ${nextNodeId} within parent ${nodeId}`);
                   // Add more detailed logging:
                   console.error(`Parent Node (ID: ${nodeId}) Data:`, JSON.stringify(newNavStack[newNavStack.length-1].node, null, 2));
                   console.error(`Expected Child ID: ${nextNodeId}`);
                   console.error(`Available Children Keys:`, currentNodeData.children ? Object.keys(currentNodeData.children) : 'None');
                   return false; // Stop the navigation process
               }
           }
       }

       // 3. Get the parent node (which is the last node processed in the loop)
       //    Check if newNavStack is not empty before accessing the last element
       if (newNavStack.length === 0) {
            OPTIMISM.logError("Navigation stack is empty after processing path.");
            return false;
       }
       const parentNode = newNavStack[newNavStack.length - 1].node;
        if (!parentNode || !parentNode.elements) {
            OPTIMISM.logError(`Parent node or its elements not found for ${elementId}`);
            return false;
        }
        const element = parentNode.elements.find(el => el.id === elementId);
        if (!element) {
            OPTIMISM.logError(`Element ${elementId} not found within its determined parent node`);
            return false;
        }

        // 4. Ensure the child node (inside the element) exists or create it
        if (!parentNode.children) {
            parentNode.children = {};
        }
        let childNode = parentNode.children[elementId];
        if (!childNode) {
            OPTIMISM.log(`Child node for ${elementId} does not exist, creating...`);
            let nodeTitle = "Untitled";
            if (element.type === 'text') {
                nodeTitle = element.text ? (element.text.trim() === "" ? "Untitled" : element.text.substring(0, 60)) : "Untitled";
            } else if (element.type === 'image') {
                nodeTitle = "Image";
            }
            childNode = {
                id: elementId, // Child node ID is the same as the element ID
                parentId: parentNode.id,
                title: nodeTitle,
                elements: [],
                children: {}
            };
            parentNode.children[elementId] = childNode;
             await this.saveData(); // Save immediately after creating the node
             OPTIMISM.log(`Created and saved new child node for ${elementId}`);
        } else {
             // Ensure title is up-to-date if element is text
             if (element.type === 'text') {
                 const expectedTitle = element.text ? (element.text.trim() === "" ? "Untitled" : element.text.substring(0, 60)) : "Untitled";
                 if (childNode.title !== expectedTitle) {
                     childNode.title = expectedTitle;
                     await this.saveData();
                     OPTIMISM.log(`Updated title for existing child node ${elementId}`);
                 }
             }
        }

        // 5. Add the final step (the element itself) to the navigation stack
        newNavStack.push({
            nodeId: elementId,
            nodeTitle: childNode.title,
            node: childNode
        });

        // 6. Update the model state
        this.navigationStack = newNavStack;
        this.currentNode = childNode;
        this.selectedElement = null; // Clear selection

        // 7. Update URL and History
        const finalNodeId = elementId;
        const hash = this.generateUrlHash(finalNodeId);
        window.history.pushState({ nodeId: finalNodeId }, '', hash);
        OPTIMISM.log(`Direct navigation successful. New stack depth: ${this.navigationStack.length}. Current node: ${this.currentNode.id}`);

        // 8. Data was potentially saved when creating/updating node, ensure it's saved if not already.
        // (saveData() was called above if node needed creation/update)

        return true; // Indicate success
    }

    async navigateBack() {
        if (this.navigationStack.length <= 1) return false;

        // Get the current node ID before navigation
        const currentNodeId = this.navigationStack[this.navigationStack.length - 1].nodeId;
        const currentNode = this.currentNode; // Store reference to current node before popping

        // Remove the current level
        this.navigationStack.pop();

        // Set current node to the previous level
        this.currentNode = this.navigationStack[this.navigationStack.length - 1].node;

        // Check if the node we just left has no children anymore
        const isEmpty = this.checkIfNodeIsEmpty(currentNodeId);

        // Clear selected element when navigating
        this.selectedElement = null;

        // Update URL hash
        this.updateUrlHash();

        // Update browser history
        const newNodeId = this.navigationStack[this.navigationStack.length - 1].nodeId;
        window.history.pushState({ nodeId: newNodeId }, '', this.generateUrlHash(newNodeId));

        // Update hasChildren status for the card we just came out of
        if (this.currentNode.elements) {
            const parentElement = this.currentNode.elements.find(el => el.id === currentNodeId);
            if (parentElement) {
                // Update the display to not show it as having children if empty
                if (isEmpty) {
                    // Queue any images in this empty node for deletion before it's effectively removed
                    this.queueImagesForDeletion(currentNode);

                    // Just save the data here, the view will handle removing underline
                    await this.saveData();
                }
            }
        }

        return true;
    }

    /**
     * Recursively finds all imageDataId values within a node and its descendants.
     * @param {Object} nodeData The node data structure to search within.
     * @returns {string[]} An array of all found imageDataIds.
     */
    findAllImageIdsRecursive(nodeData) {
        let imageIds = [];
        if (!nodeData) return imageIds;

        // Check elements in the current node
        if (nodeData.elements) {
            nodeData.elements.forEach(el => {
                if (el.type === 'image' && el.imageDataId) {
                    imageIds.push(el.imageDataId);
                }
            });
        }

        // Check children nodes
        if (nodeData.children) {
            for (const childId in nodeData.children) {
                imageIds = imageIds.concat(this.findAllImageIdsRecursive(nodeData.children[childId]));
            }
        }
        return imageIds;
    }

    /**
     * Recursively duplicates image data for a copied node structure.
     * @param {Map<string, string>} imageIdMap A map of {originalImageDataId: newImageDataId}.
     */
    async duplicateImageDataBatch(imageIdMap) {
        if (imageIdMap.size === 0) return;
        OPTIMISM.log(`Duplicating image data for ${imageIdMap.size} images.`);
        const promises = [];
        for (const [originalId, newId] of imageIdMap.entries()) {
            promises.push(
                this.getImageData(originalId).then(imageData => {
                    if (imageData) {
                        return this.saveImageData(newId, imageData);
                    } else {
                        OPTIMISM.logError(`Original image data not found for ID: ${originalId} during duplication.`);
                        return Promise.resolve(); // Continue even if one fails
                    }
                }).catch(error => {
                    OPTIMISM.logError(`Error duplicating image data from ${originalId} to ${newId}:`, error);
                    return Promise.resolve(); // Continue even if one fails
                })
            );
        }
        await Promise.all(promises);
        OPTIMISM.log(`Finished duplicating image data.`);
    }

    checkIfNodeIsEmpty(nodeId) {
        // Find the node in the current level's children
        const node = this.currentNode.children[nodeId];

        if (!node) return true;

        // Check if node has no elements and no children with content
        const hasNoElements = !node.elements || node.elements.length === 0;
        const hasNoChildren = !node.children || Object.keys(node.children).length === 0;

        return hasNoElements && hasNoChildren;
    }

    /**
     * Creates a deep copy of an element and its associated child node structure,
     * generating new IDs for all copied elements and nodes.
     * @param {string} originalElementId The ID of the element to copy in the sourceNode.
     * @param {Object} sourceNode The node containing the original element.
     * @param {string} newParentId The ID of the node where the copied element will reside.
     * @returns {Promise<{newElement: Object, newChildNodeData: Object|null, imageIdMap: Map<string, string>}|null>}
     *          Returns an object containing the new element, the new child node data (if any),
     *          and a map of original->new imageDataIds, or null if the original element wasn't found.
     */
    async deepCopyElementData(originalElementId, sourceNode, newParentId) {
        const originalElement = sourceNode.elements?.find(el => el.id === originalElementId);
        if (!originalElement) {
            OPTIMISM.logError(`Original element ${originalElementId} not found in source node ${sourceNode.id} for deep copy.`);
            return null;
        }

        const originalChildNodeData = sourceNode.children ? sourceNode.children[originalElementId] : null;
        const imageIdMap = new Map(); // Map<originalImageDataId, newImageDataId>

        // 1. Create the new top-level element
        const newElement = {
            ...originalElement,
            id: crypto.randomUUID() // Generate new ID for the element itself
            // x, y, width, height will be set later based on paste/drop location
        };
        if (newElement.type === 'image' && newElement.imageDataId) {
            const newImageDataId = crypto.randomUUID();
            imageIdMap.set(newElement.imageDataId, newImageDataId);
            newElement.imageDataId = newImageDataId;
        }

        let newChildNodeData = null;

        // 2. If there's nested data, copy it recursively
        if (originalChildNodeData) {
            newChildNodeData = {
                ...originalChildNodeData,
                id: newElement.id, // Child node ID matches the new element ID
                parentId: newParentId, // Link to the new parent node
                elements: [],
                children: {}
            };

            // 3. Recursively copy elements within the child node
            if (originalChildNodeData.elements) {
                for (const elem of originalChildNodeData.elements) {
                    // Recursively copy this element and its potential children
                    const nestedCopyResult = await this.deepCopyElementData(elem.id, originalChildNodeData, newChildNodeData.id); // Pass child node as source
                    if (nestedCopyResult) {
                        newChildNodeData.elements.push(nestedCopyResult.newElement);
                        if (nestedCopyResult.newChildNodeData) {
                            newChildNodeData.children[nestedCopyResult.newElement.id] = nestedCopyResult.newChildNodeData;
                        }
                        // Merge image ID maps
                        nestedCopyResult.imageIdMap.forEach((newId, oldId) => imageIdMap.set(oldId, newId));
                    }
                }
            }
        }

        return { newElement, newChildNodeData, imageIdMap };
    }

    // Modify the navigateToIndex method to update URL
    async navigateToIndex(index) {
        if (index >= this.navigationStack.length || index < 0) return false;

        // Keep only up to the specified index
        this.navigationStack = this.navigationStack.slice(0, index + 1);

        // Set current node
        this.currentNode = this.navigationStack[index].node;

        // Clear selected element when navigating
        this.selectedElement = null;

        // Update browser history
        const nodeId = this.navigationStack[index].nodeId;
        window.history.pushState({ nodeId: nodeId }, '', this.generateUrlHash(nodeId));

        return true;
    }

    /**
     * Finds and deletes a node and its descendants from the data structure.
     * Also collects all imageDataIds within the deleted structure.
     * @param {string} targetNodeId The ID of the node to delete.
     * @param {Object} startNode The node from which to start the search (usually this.data).
     * @returns {{deleted: boolean, imageIds: string[]}} Object indicating if deletion occurred and list of image IDs removed.
     */
    findAndDeleteNodeRecursive(targetNodeId, startNode) {
        let deleted = false;
        let imageIds = [];

        if (startNode.children) {
            if (startNode.children[targetNodeId]) {
                const nodeToDelete = startNode.children[targetNodeId];
                OPTIMISM.log(`findAndDeleteNodeRecursive: Found node ${targetNodeId} in parent ${startNode.id}`);
                imageIds = this.findAllImageIdsRecursive(nodeToDelete); // Collect image IDs before deleting
                delete startNode.children[targetNodeId];
                OPTIMISM.log(`Deleted child node ${targetNodeId} from parent ${startNode.id}`);
                return { deleted: true, imageIds };
            } else {
                for (const childId in startNode.children) {
                    const result = this.findAndDeleteNodeRecursive(targetNodeId, startNode.children[childId]);
                    if (result.deleted) {
                        return result; // Found and deleted in a deeper level
                    }
                }
            }
        }
        return { deleted: false, imageIds: [] }; // Not found in this branch
    }

    async moveElement(elementId, targetElementId) {
        // NOTE: This function now performs a DEEP COPY when moving between cards.
        // The original element and its children are REMOVED from the source.
        try {
            // Find source element in the CURRENT node
            const sourceElementIndex = this.currentNode.elements?.findIndex(el => el.id === elementId);
            if (sourceElementIndex === -1 || !this.currentNode.elements) {
                 OPTIMISM.logError(`Source element ${elementId} not found in current node ${this.currentNode.id} for move.`);
                 return false;
            }
            const sourceElement = this.currentNode.elements[sourceElementIndex];


            // Find target element in the CURRENT node
            const targetElement = this.findElement(targetElementId);
            if (!targetElement) {
                 OPTIMISM.logError(`Target element ${targetElementId} not found in current node ${this.currentNode.id} for move.`);
                return false;
            }

            // Make sure target has children node
            if (!this.currentNode.children) {
                this.currentNode.children = {};
            }

            // Create child node for target if it doesn't exist
             // Ensure target node exists or create it
             if (!this.currentNode.children) this.currentNode.children = {};
            if (!this.currentNode.children[targetElementId]) {
                OPTIMISM.log(`Creating target child node for ${targetElementId}`);
                let nodeTitle = targetElement.type === 'text' ? (targetElement.text?.substring(0, 60) || 'Untitled') : 'Image';
                this.currentNode.children[targetElementId] = {
                    id: targetElementId,
                    parentId: this.currentNode.id,
                    title: nodeTitle,
                    elements: [],
                    children: {}
                };
            }
             const targetNode = this.currentNode.children[targetElementId];

            // Perform deep copy (generates new IDs)
            OPTIMISM.log(`Performing deep copy of ${elementId} into ${targetElementId}`);
            const copyResult = await this.deepCopyElementData(elementId, this.currentNode, targetNode.id); // sourceNode is currentNode

            if (!copyResult) {
                OPTIMISM.logError(`Deep copy failed for element ${elementId}.`);
                return false;
            }

            const { newElement, newChildNodeData, imageIdMap } = copyResult;

            // Adjust position (optional - maybe center it in the target node?)
            // For simplicity, we'll keep the original relative coords for now.
            // If you want to reset position:
            // newElement.x = 20;
            // newElement.y = 20;

            // Add the new element and its potential children to the target node
            if (!targetNode.elements) targetNode.elements = [];
            targetNode.elements.push(newElement);

            if (newChildNodeData) {
                if (!targetNode.children) targetNode.children = {};
                targetNode.children[newElement.id] = newChildNodeData;
            }

            // Duplicate image data
            if (imageIdMap.size > 0) {
                await this.duplicateImageDataBatch(imageIdMap);
            }

            // Save data *before* deleting the original
            await this.saveData();

            // Now, delete the ORIGINAL element and its children from the source (current node)
            OPTIMISM.log(`Deleting original element ${elementId} after successful move/copy.`);
            // Use the existing deleteElement which now handles nested node removal
            const deleteSuccess = await this.deleteElement(elementId);
            if (!deleteSuccess) {
                 OPTIMISM.logError(`Failed to delete original element ${elementId} after move. Data might be inconsistent.`);
                 // Consider how to handle this error state - maybe try to undo the copy? Complex.
            }

            return true;
        } catch (error) {
            OPTIMISM.logError('Error in moveElement:', error);
            return false;
        }
    }

    async moveElementToBreadcrumb(elementId, navIndex) {
        // NOTE: This function now performs a DEEP COPY when moving.
        // The original element and its children are REMOVED from the source.
        try {
            // Find source element in the CURRENT node
            const sourceElementIndex = this.currentNode.elements?.findIndex(el => el.id === elementId);
            if (sourceElementIndex === -1 || !this.currentNode.elements) {
                OPTIMISM.logError(`Source element ${elementId} not found in current node ${this.currentNode.id} for breadcrumb move.`);
                return false;
            }
            const sourceElement = this.currentNode.elements[sourceElementIndex];


            // Ensure the navigation index is valid
            if (navIndex < 0 || navIndex >= this.navigationStack.length) { // Allow dropping onto the last breadcrumb (parent)
                OPTIMISM.log(`Invalid navigation index: ${navIndex}`);
                return false;
            }

            // Get the target node from the navigation stack
            // Ensure the navigation index is valid and get the target node
            const targetNode = this.navigationStack[navIndex].node;
            if (!targetNode) {
                OPTIMISM.log(`Target node not found at index: ${navIndex}`);
                return false;
            }

            // Initialize the elements array if it doesn't exist
            if (!targetNode.elements) {
                targetNode.elements = [];
            }

            // Perform deep copy (generates new IDs)
            OPTIMISM.log(`Performing deep copy of ${elementId} into breadcrumb node ${targetNode.id}`);
            const copyResult = await this.deepCopyElementData(elementId, this.currentNode, targetNode.id);

            if (!copyResult) {
                OPTIMISM.logError(`Deep copy failed for element ${elementId}.`);
                return false;
            }

            const { newElement, newChildNodeData, imageIdMap } = copyResult;

            // Add the new element and its potential children to the target node
            targetNode.elements.push(newElement);

            if (newChildNodeData) {
                if (!targetNode.children) targetNode.children = {};
                targetNode.children[newElement.id] = newChildNodeData;
            }

            // Duplicate image data
            if (imageIdMap.size > 0) {
                await this.duplicateImageDataBatch(imageIdMap);
            }

            // Save data *before* deleting the original
            await this.saveData();

            // Now, delete the ORIGINAL element and its children from the source (current node)
            OPTIMISM.log(`Deleting original element ${elementId} after successful move/copy to breadcrumb.`);
            const deleteSuccess = await this.deleteElement(elementId);
             if (!deleteSuccess) {
                 OPTIMISM.logError(`Failed to delete original element ${elementId} after move to breadcrumb. Data might be inconsistent.`);
            }

            // Save data before attempting to delete
            await this.saveData();

            // Remove source element from current node
            await this.deleteElement(elementId);

            return true;
        } catch (error) {
            OPTIMISM.logError('Error in moveElementToBreadcrumb:', error);
            return false;
        }
    }

    // Modify the navigateToNode method to update URL
    async navigateToNode(nodeId) {
        // Handle case where we're navigating to root
        if (nodeId === 'root') {
            // Reset to just the root node
            this.navigationStack = [this.navigationStack[0]];
            this.currentNode = this.navigationStack[0].node;
            this.selectedElement = null;

            // Update URL hash
            this.updateUrlHash();

            // Update browser history
            window.history.pushState({ nodeId: 'root' }, '', '#');

            return true;
        }

        // Search through the navigation stack
        for (let i = 0; i < this.navigationStack.length; i++) {
            if (this.navigationStack[i].nodeId === nodeId) {
                // Truncate the stack to this point
                this.navigationStack = this.navigationStack.slice(0, i + 1);
                this.currentNode = this.navigationStack[i].node;
                this.selectedElement = null;

                // Update URL hash
                this.updateUrlHash();

                // Update browser history
                window.history.pushState({ nodeId: nodeId }, '', this.generateUrlHash(nodeId));

                return true;
            }
        }

        // If not found in the stack, we need to build the path to this node
        const path = this.buildPathToNode(nodeId);
        if (path && path.length > 0) {
            // Start with root
            this.navigationStack = [this.navigationStack[0]];
            this.currentNode = this.navigationStack[0].node;

            // Navigate through the path
            for (const id of path) {
                const node = this.findNodeById(id);
                if (!node) return false;

                this.navigationStack.push({
                    nodeId: id,
                    nodeTitle: node.title || 'Untitled',
                    node: node
                });
            }

            // Set current node to the last one in the path
            this.currentNode = this.navigationStack[this.navigationStack.length - 1].node;
            this.selectedElement = null;

            // Update URL hash
            this.updateUrlHash();

            // Update browser history
            window.history.pushState({ nodeId: nodeId }, '', this.generateUrlHash(nodeId));

            return true;
        }

        OPTIMISM.logError(`Node ${nodeId} not found in navigation stack`);
        return false;
    }

    async toggleTheme() {
        this.isDarkTheme = !this.isDarkTheme;
        await this.saveTheme();
        return this.isDarkTheme;
    }

    // In model.js, modify the incrementEditCounter method:
    incrementEditCounter() {
        this.editCounter++;

        // Add logging for edit counter and thresholds
        const editsUntilBackup = this.backupReminderThreshold - (this.editCounter - this.lastBackupReminder);
        OPTIMISM.log(`Edit #${this.editCounter} (${editsUntilBackup} until backup reminder)`);

        // If there are deleted images in the queue, log information about them
        if (this.deletedImageQueue.length > 0) {
            const nextDeletion = this.deletedImageQueue[0].deleteAtCounter;
            const editsUntilDeletion = nextDeletion - this.editCounter;
            OPTIMISM.log(`Images pending deletion: ${this.deletedImageQueue.length} (next in ${editsUntilDeletion} edits)`);
        }

        // Check if there are any images to clean up
        if (this.deletedImageQueue.length > 0) {
            this.cleanupDeletedImages();
        }

        // Check for expired quick links
        if (this.quickLinks.length > 0) {
            this.cleanupExpiredQuickLinks();
        }

        // Save the app state after incrementing edit counter
        this.saveAppState();

        // Check if we need to show a backup reminder
        if (this.editCounter - this.lastBackupReminder >= this.backupReminderThreshold) {
            return true; // Signal to show backup reminder
        }

        return false;
    }

    // In model.js, modify the resetBackupReminder method
    resetBackupReminder() {
        this.lastBackupReminder = this.editCounter;
        OPTIMISM.log(`Reset backup reminder (next at edit #${this.editCounter + this.backupReminderThreshold})`);
        this.saveAppState();
    }

    // In model.js, modify the cleanupDeletedImages method
    async cleanupDeletedImages() {
        const imagesToDelete = [];
        const remainingImages = [];

        // Separate images into ones to delete now vs. keep for later
        for (const item of this.deletedImageQueue) {
            if (this.editCounter >= item.deleteAtCounter) {
                imagesToDelete.push(item.imageId);
            } else {
                remainingImages.push(item);
            }
        }

        // Update the queue
        this.deletedImageQueue = remainingImages;

        // Save the updated queue immediately after modification
        await this.saveAppState();

        // Actually delete the images that are old enough
        if (imagesToDelete.length > 0) {
            OPTIMISM.log(`Cleaning up ${imagesToDelete.length} old deleted images`);

            for (const imageId of imagesToDelete) {
                try {
                    await this.deleteImageData(imageId);
                    OPTIMISM.log(`Deleted old image data: ${imageId}`);
                } catch (error) {
                    OPTIMISM.logError(`Failed to delete old image data ${imageId}:`, error);
                }
            }
        }

        // Log the remaining queue status
        if (this.deletedImageQueue.length > 0) {
            const nextDeletion = this.deletedImageQueue[0].deleteAtCounter;
            OPTIMISM.log(`${this.deletedImageQueue.length} images remain in deletion queue (next at edit #${nextDeletion})`);
        }
    }


    async saveAppState() {
        try {
            const appState = {
                id: 'appState',
                deletedImageQueue: this.deletedImageQueue,
                editCounter: this.editCounter,
                lastBackupReminder: this.lastBackupReminder,
                imagesLocked: this.imagesLocked,
                quickLinks: this.quickLinks,
                lockedCards: this.lockedCards,
                inboxCards: this.inboxCards,
                isInboxVisible: this.isInboxVisible,
                isSettingsVisible: this.isSettingsVisible, // Add this line
                isGridVisible: this.isGridVisible,
                isNestingDisabled: this.isNestingDisabled,
                isArenaVisible: this.isArenaVisible,
                gridLayout: this.gridLayout,
                priorityCards: this.priorityCards,
                isPrioritiesVisible: this.isPrioritiesVisible
            };

            OPTIMISM.log(`Saving app state (edit counter: ${this.editCounter}, last backup: ${this.lastBackupReminder}, images locked: ${this.imagesLocked}, quick links: ${this.quickLinks.length}, locked cards: ${this.lockedCards.length}, grid: ${this.isGridVisible ? 'on' : 'off'}, layout: ${this.gridLayout}, arena: ${this.isArenaVisible ? 'on' : 'off'}, nesting disabled: ${this.isNestingDisabled ? 'yes' : 'no'}, settings: ${this.isSettingsVisible ? 'visible' : 'hidden'}, inbox: ${this.isInboxVisible ? 'visible' : 'hidden'})`);
            await this.db.put('canvasData', appState);
        } catch (error) {
            OPTIMISM.logError('Error saving app state:', error);
        }
    }

    // Add this method to the CanvasModel class in model.js
    findAllImageElementsInNode(node) {
        if (!node) return [];

        let imageElements = [];

        // Check elements in this node
        if (node.elements && node.elements.length > 0) {
            // Add all image elements from this node
            const nodeImages = node.elements.filter(element => element.type === 'image');
            imageElements = imageElements.concat(nodeImages);
        }

        // Recursively check all children nodes
        if (node.children && Object.keys(node.children).length > 0) {
            for (const childId in node.children) {
                const childNode = node.children[childId];
                const childImages = this.findAllImageElementsInNode(childNode);
                imageElements = imageElements.concat(childImages);
            }
        }

        return imageElements;
    }

    // Also add this method to recursively queue images for deletion
    queueImagesForDeletion(node) {
        const images = this.findAllImageElementsInNode(node);
        if (images.length > 0) {
            OPTIMISM.log(`Found ${images.length} images to queue for deletion`);

            // Add each image to the deletion queue
            for (const image of images) {
                const deleteAtCounter = this.editCounter + 10;
                this.deletedImageQueue.push({
                    imageId: image.imageDataId,
                    deleteAtCounter: deleteAtCounter
                });
                OPTIMISM.log(`Added image ${image.imageDataId} to deletion queue (will delete after edit #${deleteAtCounter})`);
            }

            // Always save the app state whenever the queue is modified
            this.saveAppState();
        }
    }

    // Add these methods to CanvasModel class in model.js
    // Helper method to build a path to a node

    // Generate a URL-friendly slug from text
    generateSlug(text) {
        if (!text) return 'untitled';

        // Convert to lowercase and replace non-alphanumeric characters with hyphens
        return text.toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '') // Remove special characters
            .replace(/[\s_-]+/g, '-') // Replace spaces, underscores, and hyphens with a single hyphen
            .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
            .substring(0, 30); // Limit length
    }

    // Generate a URL hash for a node
    generateUrlHash(nodeId) {
        const node = this.findNodeById(nodeId);
        if (!node) return '#';

        // For root, just return '#'
        if (nodeId === 'root') return '#';

        // For other nodes, combine slug and ID
        let slug = 'untitled';

        // If it's a text element, use its content for the slug
        const parentNode = this.findParentNode(nodeId);
        if (parentNode && parentNode.elements) {
            const element = parentNode.elements.find(el => el.id === nodeId);
            if (element && element.type === 'text' && element.text) {
                slug = this.generateSlug(element.text);
            } else if (element && element.type === 'image') {
                slug = 'image';
            }
        }

        // Add the first 6 characters of ID
        const idPart = nodeId.substring(0, 6);
        return `#${slug}-${idPart}`;
    }

    // Find a node by ID in the entire data structure
    findNodeById(nodeId) {
        // Root node is a special case
        if (nodeId === 'root') return this.data;

        // For other nodes, search through the children
        return this.findNodeRecursive(this.data, nodeId);
    }

    // Recursively search for a node by ID
    findNodeRecursive(currentNode, targetId) {
        // Check if this node has the target ID
        if (currentNode.id === targetId) return currentNode;

        // Check children
        if (currentNode.children) {
            for (const childId in currentNode.children) {
                const result = this.findNodeRecursive(currentNode.children[childId], targetId);
                if (result) return result;
            }
        }

        return null;
    }

    // Find the parent node of a given node ID
    findParentNode(nodeId) {
        // Root has no parent
        if (nodeId === 'root') return null;

        // Search through the entire structure
        return this.findParentNodeRecursive(this.data, nodeId);
    }

    // Recursively search for the parent of a node
    findParentNodeRecursive(currentNode, targetId) {
        // Check if any direct children have the target ID
        if (currentNode.children) {
            if (currentNode.children[targetId]) {
                return currentNode;
            }

            // Check deeper in the hierarchy
            for (const childId in currentNode.children) {
                const result = this.findParentNodeRecursive(currentNode.children[childId], targetId);
                if (result) return result;
            }
        }

        return null;
    }

    // Update the URL hash based on current navigation
    updateUrlHash() {
        if (this.navigationStack.length === 0) return;

        const currentNodeId = this.navigationStack[this.navigationStack.length - 1].nodeId;
        const hash = this.generateUrlHash(currentNodeId);

        // Update the URL without adding a new history entry
        window.history.replaceState(null, '', hash);
    }

    // Navigate to a node based on URL hash
    async navigateToNodeByHash(hash) {
        if (!hash || hash === '#') {
            // Go to root if no hash or just '#'
            return this.navigateToNode('root');
        }

        // Remove the # character
        hash = hash.substring(1);

        // Extract the ID part (last part after the last hyphen)
        const parts = hash.split('-');
        if (parts.length < 2) return false;

        const idPart = parts[parts.length - 1];
        if (idPart.length !== 6) return false;

        // Find nodes with matching ID prefix
        const matchingNodes = this.findNodesWithIdPrefix(idPart);
        if (matchingNodes.length === 0) return false;

        // If multiple matches, try to narrow down by slug
        if (matchingNodes.length > 1) {
            const slug = hash.substring(0, hash.length - idPart.length - 1);
            for (const node of matchingNodes) {
                const parentNode = this.findParentNode(node.id);
                if (parentNode && parentNode.elements) {
                    const element = parentNode.elements.find(el => el.id === node.id);
                    if (element && element.type === 'text' && element.text) {
                        const elementSlug = this.generateSlug(element.text);
                        if (elementSlug === slug) {
                            return this.navigateToNode(node.id);
                        }
                    }
                }
            }
        }

        // If we couldn't narrow it down or there's only one match, use the first one
        return this.navigateToNode(matchingNodes[0].id);
    }

    // Find all nodes with a given ID prefix
    findNodesWithIdPrefix(idPrefix) {
        const results = [];
        this.findNodesWithIdPrefixRecursive(this.data, idPrefix, results);
        return results;
    }

    // Recursively find nodes with matching ID prefix
    findNodesWithIdPrefixRecursive(currentNode, idPrefix, results) {
        // Check if this node's ID starts with the prefix
        if (currentNode.id && currentNode.id.startsWith(idPrefix)) {
            results.push(currentNode);
        }

        // Check all children
        if (currentNode.children) {
            for (const childId in currentNode.children) {
                this.findNodesWithIdPrefixRecursive(currentNode.children[childId], idPrefix, results);
            }
        }
    }

    buildPathToNode(nodeId) {
        const path = [];
        if (this.buildPathToNodeRecursive(this.data, nodeId, path)) {
            return path;
        }
        return null;
    }


    // Recursively build a path to a node
    buildPathToNodeRecursive(currentNode, targetId, path) {
        // Check if any direct children have the target ID
        if (currentNode.children) {
            if (currentNode.children[targetId]) {
                path.push(targetId);
                return true;
            }

            // Check deeper in the hierarchy
            for (const childId in currentNode.children) {
                path.push(childId);
                if (this.buildPathToNodeRecursive(currentNode.children[childId], targetId, path)) {
                    return true;
                }
                path.pop();
            }
        }

        return false;
    }

    // Add this method to the CanvasModel class in model.js
    async toggleImagesLocked() {
        this.imagesLocked = !this.imagesLocked;
        OPTIMISM.log(`Images locked state set to: ${this.imagesLocked}`);
        await this.saveAppState();
        return this.imagesLocked;
    }

    // In model.js
    async addQuickLink(nodeId, nodeTitle) {
        // Don't add if already exists
        if (this.quickLinks.some(link => link.nodeId === nodeId)) {
            OPTIMISM.log(`Quick link for node ${nodeId} already exists`);
            return false;
        }

        // Check if we already have 3 links, if so, remove the oldest one
        if (this.quickLinks.length >= 3) {
            this.quickLinks.shift(); // Remove oldest
            OPTIMISM.log('Removed oldest quick link to make room for new one');
        }

        // Create new quick link with expiry timestamp
        const newLink = {
            nodeId,
            nodeTitle,
            addedAt: this.editCounter,
            expiresAt: this.editCounter + this.quickLinkExpiryCount
        };

        // Add to the end of the array
        this.quickLinks.push(newLink);
        OPTIMISM.log(`Added quick link to node ${nodeId} (${nodeTitle})`);

        // Save state
        await this.saveAppState();
        return true;
    }

    // Remove a quick link from the nav bar
    async removeQuickLink(nodeId) {
        const initialLength = this.quickLinks.length;
        this.quickLinks = this.quickLinks.filter(link => link.nodeId !== nodeId);

        if (initialLength !== this.quickLinks.length) {
            OPTIMISM.log(`Removed quick link to node ${nodeId}`);
            await this.saveAppState();
            return true;
        }

        OPTIMISM.log(`Quick link to node ${nodeId} not found`);
        return false;
    }

    // Check and remove expired links
    async cleanupExpiredQuickLinks() {
        const initialLength = this.quickLinks.length;

        // Filter out expired links
        this.quickLinks = this.quickLinks.filter(link =>
            link.expiresAt > this.editCounter
        );

        if (initialLength !== this.quickLinks.length) {
            OPTIMISM.log(`Removed ${initialLength - this.quickLinks.length} expired quick link(s)`);
            await this.saveAppState();
            return true;
        }

        return false;
    }

    // Add this method to the CanvasModel class in model.js
    async refreshQuickLinkExpiry(nodeId) {
        // Find the quick link
        const linkIndex = this.quickLinks.findIndex(link => link.nodeId === nodeId);
        if (linkIndex === -1) {
            OPTIMISM.log(`Quick link for node ${nodeId} not found to refresh`);
            return false;
        }

        // Reset the expiry counter to a new value based on the current edit counter
        this.quickLinks[linkIndex].expiresAt = this.editCounter + this.quickLinkExpiryCount;

        OPTIMISM.log(`Refreshed quick link to node ${nodeId} (will expire after edit #${this.quickLinks[linkIndex].expiresAt})`);

        // Save state
        await this.saveAppState();
        return true;
    }

    // Check if a card is locked
    isCardLocked(cardId) {
        return this.lockedCards.includes(cardId);
    }

    // Lock a card
    async lockCard(cardId) {
        if (!this.isCardLocked(cardId)) {
            this.lockedCards.push(cardId);
            OPTIMISM.log(`Card ${cardId} locked`);
            await this.saveAppState();
            return true;
        }
        return false;
    }

    // Unlock a card
    async unlockCard(cardId) {
        const index = this.lockedCards.indexOf(cardId);
        if (index !== -1) {
            this.lockedCards.splice(index, 1);
            OPTIMISM.log(`Card ${cardId} unlocked`);
            await this.saveAppState();
            return true;
        }
        return false;
    }

    // Toggle card lock state
    async toggleCardLock(cardId) {
        if (this.isCardLocked(cardId)) {
            return await this.unlockCard(cardId);
        } else {
            return await this.lockCard(cardId);
        }
    }

    // Add this method to the CanvasModel class in model.js
    async updateNavigationTitles(elementId, newText) {
        // Only update titles for text elements
        const element = this.findElement(elementId);
        if (!element || element.type !== 'text') return;

        OPTIMISM.log(`Updating navigation titles for element ${elementId}`);

        // Check if this element is a parent of any node in the navigation stack
        let updated = false;

        // Skip the root node (index 0)
        for (let i = 1; i < this.navigationStack.length; i++) {
            const navItem = this.navigationStack[i];

            // If this node's ID matches the element ID, update its title
            if (navItem.nodeId === elementId) {
                // Create a title from the text (limit to 60 characters)
                const newTitle = newText ?
                    (newText.trim() === "" ? "Untitled" : newText.substring(0, 60)) :
                    "Untitled";

                navItem.nodeTitle = newTitle;
                OPTIMISM.log(`Updated navigation title at level ${i} to "${newTitle}"`);
                updated = true;
            }

            // Also update any children nodes that have this element as parent
            // (in case we're editing an element that is a parent of navigation nodes)
            const node = navItem.node;
            if (node && node.parentId === elementId) {
                // Update the node title in the current node
                node.title = newText ?
                    (newText.trim() === "" ? "Untitled" : newText.substring(0, 60)) :
                    "Untitled";

                // Also update the title in the navigation stack
                navItem.nodeTitle = node.title;

                OPTIMISM.log(`Updated node title for child of ${elementId} to "${node.title}"`);
                updated = true;
            }
        }

        // Also update titles for any child nodes that aren't in the navigation stack
        if (this.currentNode.children && this.currentNode.children[elementId]) {
            const childNode = this.currentNode.children[elementId];
            childNode.title = newText ?
                (newText.trim() === "" ? "Untitled" : newText.substring(0, 60)) :
                "Untitled";

            OPTIMISM.log(`Updated title for child node ${elementId} to "${childNode.title}"`);
            updated = true;
        }

        // If we updated any titles, save the data
        if (updated) {
            await this.saveData();
        }

        return updated;
    }

    // Add methods to manage inbox cards
    async toggleInboxVisibility() {
        // --- REMOVED: Logic to close other panels ---
        /* if (this.isSettingsVisible) {
            this.isGridVisible = false;
        } */
        this.isInboxVisible = !this.isInboxVisible;
        OPTIMISM.log(`Inbox visibility set to: ${this.isInboxVisible}`);
        await this.saveAppState();
        return this.isInboxVisible;
    }

// --- Modify addToInbox in model.js ---
async addToInbox(element, childNodeData = null) { // Accept optional childNodeData
    OPTIMISM.log(`addToInbox: Adding element ${element.id}. Received childNodeData:`, childNodeData ? '{...}' : 'null');
    // Create a copy of the element with a new ID for the inbox
    const inboxCard = {
        ...element,
        id: crypto.randomUUID(), // Generate new ID for inbox card
        originalId: element.id, // Keep reference to original ID
        addedToInboxAt: new Date().toISOString(), // Track when added
        // --- NEW: Store nested data ---
        nestedData: childNodeData ? JSON.parse(JSON.stringify(childNodeData)) : null // Store a deep copy
    };

    // Add to inbox
    this.inboxCards.unshift(inboxCard); // Add to beginning of array
    // Log the actual stored data
    OPTIMISM.log(`Added card to inbox: ${inboxCard.id}. Stored nestedData:`, inboxCard.nestedData ? '{...}' : 'null');

    // Save state
    await this.saveAppState();
    return inboxCard;
}

    async removeFromInbox(cardId) {
        const initialLength = this.inboxCards.length;
        this.inboxCards = this.inboxCards.filter(card => card.id !== cardId);

        if (initialLength !== this.inboxCards.length) {
            OPTIMISM.log(`Removed card from inbox: ${cardId}`);
            await this.saveAppState();
            return true;
        }

        OPTIMISM.log(`Inbox card ${cardId} not found`);
        return false;
    }

    async addBlankCardToInbox() {
        // Create a new blank card at the top of the inbox
        const blankCard = {
            id: crypto.randomUUID(),
            type: 'text',
            text: '',
            addedToInboxAt: new Date().toISOString(),
            style: {
                textSize: 'small',
                textColor: 'default'
            }
        };

        // Add to beginning of inbox
        this.inboxCards.unshift(blankCard);
        OPTIMISM.log(`Added blank card to inbox: ${blankCard.id}`);

        // Save state
        await this.saveAppState();
        return blankCard;
    }

    // In model.js, add this method to handle moving from inbox
    async moveFromInboxToCanvas(cardId, x, y) { // Renamed for clarity
        // Find the card in the inbox
        const cardIndex = this.inboxCards.findIndex(card => card.id === cardId);
        if (cardIndex === -1) {
            OPTIMISM.logError(`Card ${cardId} not found in inbox`);
            await this.saveAppState(); // Save state even if card not found initially
            return false; // Card not found
        }
        const card = this.inboxCards[cardIndex];

        // Create a new element for the canvas
        const newElement = {
            id: crypto.randomUUID(), // New ID for the canvas element
            type: card.type,
            x: x,
            y: y,
            width: card.width || 200,
            height: card.height || 100,
        };



        // Copy necessary properties based on type
        if (card.type === 'text') {
            newElement.text = card.text || '';
            newElement.style = card.style || { textSize: 'small', textColor: 'default' };
        } else if (card.type === 'image' && card.imageDataId) {
            newElement.imageDataId = card.imageDataId; // Keep the same image data ID
            newElement.storageWidth = card.storageWidth;
            newElement.storageHeight = card.storageHeight;
        }

        // --- NEW: Handle nested data ---
        let newChildNodeData = null;
        OPTIMISM.log(`moveFromInboxToCanvas: Checking inbox card ${cardId} for nestedData:`, card.nestedData ? '{...}' : 'null');
        if (card.nestedData) {
            OPTIMISM.log(`Restoring nested data for element ${newElement.id} from inbox card ${cardId}`);
            newChildNodeData = JSON.parse(JSON.stringify(card.nestedData)); // Deep copy
            newChildNodeData.id = newElement.id; // Match the new element ID
            newChildNodeData.parentId = this.currentNode.id; // Set parent to current node
        }
        // --- END NEW ---

        // Add element to the current node
        if (!this.currentNode.elements) this.currentNode.elements = [];
        this.currentNode.elements.push(newElement);

        // Add nested data to the current node's children
        if (newChildNodeData) {
            if (!this.currentNode.children) this.currentNode.children = {};
            this.currentNode.children[newElement.id] = newChildNodeData;
        }

        // Remove card from inbox
        this.inboxCards.splice(cardIndex, 1);

        // Save both canvas data and app state
        await this.saveData();
        OPTIMISM.log(`moveFromInboxToCanvas: Saved canvasData after adding element ${newElement.id}.`);
        await this.saveAppState();

        OPTIMISM.log(`Moved card ${cardId} from inbox to canvas element ${newElement.id}${newChildNodeData ? ' (with nested data)' : ''}`);
        return newElement.id; // Return the ID of the newly created canvas element
    }


    async updateInboxCard(id, properties) {
        const card = this.inboxCards.find(card => card.id === id);
        if (card) {
            Object.assign(card, properties);

            // Delete card if text is empty (for text cards only)
            if (card.type === 'text' &&
                properties.text !== undefined &&
                (properties.text === '' || properties.text === null || properties.text.trim() === '')) {
                await this.removeFromInbox(id);
                return null; // Return null to indicate the card was deleted
            }

            await this.saveAppState();
            return card; // Return the updated card
        }
        return null; // Card not found
    }

    // In model.js, modify toggleArenaView() method
    async toggleArenaView() {
        // No longer disable other panels

        this.isArenaVisible = !this.isArenaVisible;
        OPTIMISM.log(`Are.na view set to: ${this.isArenaVisible}`);
        await this.saveAppState();
        return this.isArenaVisible;
    }

    async toggleNestingDisabled() {
        this.isNestingDisabled = !this.isNestingDisabled;
        OPTIMISM.log(`Nesting disabled state set to: ${this.isNestingDisabled}`);
        await this.saveAppState();
        return this.isNestingDisabled;
    }

    async toggleSettingsVisibility() {
        // --- REMOVED: Logic to close other panels ---
        this.isSettingsVisible = !this.isSettingsVisible;
        OPTIMISM.log(`Settings visibility set to: ${this.isSettingsVisible}`);
        await this.saveAppState();
        return this.isSettingsVisible;
    }

    // Then add a generic panel toggle method:
    async togglePanel(panelName) {
        // Close all other panels first
        for (const panel in this.panels) {
            if (panel !== panelName) {
                this.panels[panel] = false;
            }
        }

        // Toggle the requested panel
        this.panels[panelName] = !this.panels[panelName];
        OPTIMISM.log(`Panel '${panelName}' visibility set to: ${this.panels[panelName]}`);

        // Update legacy properties for backward compatibility
        this.isSettingsVisible = this.panels.settings;
        this.isInboxVisible = this.panels.inbox;
        this.isGridVisible = this.panels.grid;

        await this.saveAppState();
        return this.panels[panelName];
    }

    isCardPriority(cardId) {
        return this.priorityCards.includes(cardId);
    }

    // Toggle priority status
    async toggleCardPriority(cardId) {
        if (this.isCardPriority(cardId)) {
            // Remove from priorities
            const index = this.priorityCards.indexOf(cardId);
            if (index !== -1) {
                this.priorityCards.splice(index, 1);
                OPTIMISM.log(`Card ${cardId} removed from priorities`);
                await this.saveAppState();
                return false;
            }
        } else {
            // Add to priorities
            this.priorityCards.push(cardId);
            OPTIMISM.log(`Card ${cardId} added to priorities`);
            await this.saveAppState();
            return true;
        }
        return this.isCardPriority(cardId);
    }

    // Toggle priorities panel visibility
    async togglePrioritiesVisibility() {
        // --- REMOVED: Logic to close other panels ---

        this.isPrioritiesVisible = !this.isPrioritiesVisible;
        OPTIMISM.log(`Priorities visibility set to: ${this.isPrioritiesVisible}`);
        await this.saveAppState();
        return this.isPrioritiesVisible;
    }



}
