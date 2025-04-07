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
this.backupReminderThreshold = 100;

// Add this line:
this.deletedImageQueue = []; // Queue of deleted image IDs with edit counters
        
        // Command history for undo/redo
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistorySize = 50; // Limit history size to prevent memory issues
        
        // Debug panel visibility state
        this.isDebugVisible = false;
    }

    // In model.js, modify the initialize method to add edit counter logging
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
    
    // In model.js, modify the loadData method
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
                
                if (appState.lastBackupReminder !== undefined) {
                    this.lastBackupReminder = appState.lastBackupReminder;
                    OPTIMISM.log(`Loaded last backup reminder: ${this.lastBackupReminder}`);
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

    async deleteElement(id) {
        if (!this.currentNode.elements) return false;
        
        const index = this.currentNode.elements.findIndex(el => el.id === id);
        if (index !== -1) {
            const element = this.currentNode.elements[index];
            
            // If it's an image element, also delete the stored image data
            if (element.type === 'image') {
                await this.deleteImageData(element.imageDataId);
            }
            
            // Remove element from array
            this.currentNode.elements.splice(index, 1);
            
            // Save canvas data
            await this.saveData();
            
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

    // Update the navigateBack method in model.js
// Modify the navigateBack method to update URL
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
    
    checkIfNodeIsEmpty(nodeId) {
        // Find the node in the current level's children
        const node = this.currentNode.children[nodeId];
        
        if (!node) return true;
        
        // Check if node has no elements and no children with content
        const hasNoElements = !node.elements || node.elements.length === 0;
        const hasNoChildren = !node.children || Object.keys(node.children).length === 0;
        
        return hasNoElements && hasNoChildren;
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
    
    // Update URL hash
    this.updateUrlHash();
    
    // Update browser history
    const nodeId = this.navigationStack[index].nodeId;
    window.history.pushState({ nodeId: nodeId }, '', this.generateUrlHash(nodeId));
    
    return true;
}

    async moveElement(elementId, targetElementId) {
        try {
            // Find source element
            const sourceElement = this.findElement(elementId);
            if (!sourceElement) return false;
            
            // Find target element and its node
            const targetElement = this.findElement(targetElementId);
            if (!targetElement) return false;
            
            // Make sure target has children node
            if (!this.currentNode.children) {
                this.currentNode.children = {};
            }
            
            // Create child node for target if it doesn't exist
            if (!this.currentNode.children[targetElementId]) {
                let nodeTitle = "Untitled";
                
                if (targetElement.type === 'text') {
                    nodeTitle = targetElement.text ? 
                        (targetElement.text.trim() === "" ? "Untitled" : targetElement.text.substring(0, 60)) : 
                        "Untitled";
                } else if (targetElement.type === 'image') {
                    nodeTitle = "Image";
                }
                    
                this.currentNode.children[targetElementId] = {
                    id: targetElementId,
                    parentId: this.currentNode.id,
                    title: nodeTitle,
                    elements: [],
                    children: {}
                };
            }
            
            // Add source element to target's elements
            const newElement = {...sourceElement};
            newElement.id = crypto.randomUUID();
            
            // For image elements, we need to handle the image data separately
            if (sourceElement.type === 'image') {
                // Generate a new image data ID
                const newImageDataId = crypto.randomUUID();
                
                // Get the original image data
                const imageData = await this.getImageData(sourceElement.imageDataId);
                
                // Save with the new ID
                await this.saveImageData(newImageDataId, imageData);
                
                // Update the reference in the new element
                newElement.imageDataId = newImageDataId;
            }
            
            this.currentNode.children[targetElementId].elements.push(newElement);
            
            // Save data before attempting to delete
            await this.saveData();
            
            // Remove source element from current node
            const deleteResult = await this.deleteElement(elementId);
            
            return true;
        } catch (error) {
            OPTIMISM.logError('Error in moveElement:', error);
            return false;
        }
    }
    
    async moveElementToBreadcrumb(elementId, navIndex) {
        try {
            // Find source element
            const sourceElement = this.findElement(elementId);
            if (!sourceElement) return false;
            
            // Ensure the navigation index is valid
            if (navIndex < 0 || navIndex >= this.navigationStack.length - 1) {
                OPTIMISM.log(`Invalid navigation index: ${navIndex}`);
                return false;
            }
            
            // Get the target node from the navigation stack
            const targetNode = this.navigationStack[navIndex].node;
            if (!targetNode) {
                OPTIMISM.log(`Target node not found at index: ${navIndex}`);
                return false;
            }
            
            // Initialize the elements array if it doesn't exist
            if (!targetNode.elements) {
                targetNode.elements = [];
            }
            
            // Create a copy of the element for the target node
            const newElement = {...sourceElement};
            newElement.id = crypto.randomUUID();
            
            // For image elements, we need to handle the image data separately
            if (sourceElement.type === 'image') {
                // Generate a new image data ID
                const newImageDataId = crypto.randomUUID();
                
                // Get the original image data
                const imageData = await this.getImageData(sourceElement.imageDataId);
                
                // Save with the new ID
                await this.saveImageData(newImageDataId, imageData);
                
                // Update the reference in the new element
                newElement.imageDataId = newImageDataId;
            }
            
            // Add the new element to the target node
            targetNode.elements.push(newElement);
            
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
// In model.js, modify the incrementEditCounter method
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

    // In model.js, update the saveAppState method
async saveAppState() {
    try {
        const appState = {
            id: 'appState',
            deletedImageQueue: this.deletedImageQueue,
            editCounter: this.editCounter,
            lastBackupReminder: this.lastBackupReminder
        };
        
        OPTIMISM.log(`Saving app state (edit counter: ${this.editCounter}, last backup: ${this.lastBackupReminder})`);
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

}