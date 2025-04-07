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
        
        // Command history for undo/redo
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistorySize = 50; // Limit history size to prevent memory issues
        
        // Debug panel visibility state
        this.isDebugVisible = false;
    }

    async initialize() {
        try {
            OPTIMISM.log('Initializing database...');
            await this.db.open();
            
            OPTIMISM.log('Loading data...');
            await this.loadData();
            
            OPTIMISM.log('Loading theme...');
            await this.loadTheme();
            
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
    
    // Command pattern for undo/redo
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
            
            return result;
        } catch (error) {
            OPTIMISM.logError('Error executing command:', error);
            throw error;
        }
    }
    
    async undo() {
        if (this.undoStack.length === 0) return false;
        
        try {
            OPTIMISM.log('Undoing last action');
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
            
            return true;
        } catch (error) {
            OPTIMISM.logError('Error during undo:', error);
            return false;
        }
    }
    
    async redo() {
        if (this.redoStack.length === 0) return false;
        
        try {
            OPTIMISM.log('Redoing last undone action');
            // Get the last command from the redo stack
            const command = this.redoStack.pop();
            
            // Execute the command again
            await command.execute();
            
            // Add back to undo stack
            this.undoStack.push(command);
            
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
        
        await this.saveData();
        return true;
    }

    async navigateBack() {
        if (this.navigationStack.length <= 1) return false;
        
        // Get the current node ID before navigation
        const currentNodeId = this.navigationStack[this.navigationStack.length - 1].nodeId;
        
        // Remove the current level
        this.navigationStack.pop();
        
        // Set current node to the previous level
        this.currentNode = this.navigationStack[this.navigationStack.length - 1].node;
        
        // Check if the node we just left has no children anymore
        const isEmpty = this.checkIfNodeIsEmpty(currentNodeId);
        
        // Clear selected element when navigating
        this.selectedElement = null;
        
        // Update hasChildren status for the card we just came out of
        if (this.currentNode.elements) {
            const parentElement = this.currentNode.elements.find(el => el.id === currentNodeId);
            if (parentElement) {
                // Update the display to not show it as having children if empty
                if (isEmpty) {
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

    async navigateToIndex(index) {
        if (index >= this.navigationStack.length || index < 0) return false;
        
        // Keep only up to the specified index
        this.navigationStack = this.navigationStack.slice(0, index + 1);
        
        // Set current node
        this.currentNode = this.navigationStack[index].node;
        
        // Clear selected element when navigating
        this.selectedElement = null;
        
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
    
    // New helper method to navigate directly to a node by ID
    async navigateToNode(nodeId) {
        // Handle case where we're navigating to root
        if (nodeId === 'root') {
            // Reset to just the root node
            this.navigationStack = [this.navigationStack[0]];
            this.currentNode = this.navigationStack[0].node;
            this.selectedElement = null;
            return true;
        }
        
        // Search through the navigation stack
        for (let i = 0; i < this.navigationStack.length; i++) {
            if (this.navigationStack[i].nodeId === nodeId) {
                // Truncate the stack to this point
                this.navigationStack = this.navigationStack.slice(0, i + 1);
                this.currentNode = this.navigationStack[i].node;
                this.selectedElement = null;
                return true;
            }
        }
        
        // If not found in the stack, we'd need to do a more complex search
        // through the node hierarchy, but for now we'll return false
        OPTIMISM.logError(`Node ${nodeId} not found in navigation stack`);
        return false;
    }
    
    async toggleTheme() {
        this.isDarkTheme = !this.isDarkTheme;
        await this.saveTheme();
        return this.isDarkTheme;
    }
}