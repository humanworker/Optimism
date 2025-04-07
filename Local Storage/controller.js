// Controller to handle user actions
class CanvasController {
    constructor(model, view) {
        this.model = model;
        this.view = view;
        this.isInitialized = false;
        this.exportImportManager = null;
    }
    
    async initialize() {
        OPTIMISM.log('Initializing controller');
        this.view.showLoading();
        try {
            await this.model.initialize();
            
            // Initialize export/import manager
            this.exportImportManager = new ExportImportManager(this.model, this.view);
            
            this.view.renderWorkspace();
            this.view.setupEventListeners();
            this.view.setupDragListeners();
            this.view.setupStylePanel();
            this.view.setupThemeToggle();
            this.view.setupUndoRedoButtons();
            this.view.updateTheme(this.model.isDarkTheme);
            // Initialize debug panel state
            this.view.updateDebugPanelVisibility(this.model.isDebugVisible);
            this.isInitialized = true;
            OPTIMISM.log('Controller initialized successfully');
        } catch (error) {
            OPTIMISM.logError('Failed to initialize controller:', error);
            alert('Failed to initialize application. Please refresh the page and try again.');
        } finally {
            this.view.hideLoading();
        }
    }

    async createElement(x, y) {
        if (!this.isInitialized) {
            OPTIMISM.logError('Cannot create element: application not initialized');
            return;
        }
        
        try {
            OPTIMISM.log(`Creating text element at position (${x}, ${y})`);
            const element = {
                id: crypto.randomUUID(),
                type: 'text',
                x: x,
                y: y,
                text: '',
                width: 200,
                height: 100,
                style: {
                    textSize: 'small', // Default text size
                    textColor: 'default', // Default text color
                    hasHeader: false // Default header setting
                }
            };
            
            // Create an add element command
            const command = new AddElementCommand(this.model, element);
            
            // Execute the command
            await this.model.execute(command);
            
            const elemDOM = this.view.createTextElementDOM(element);
            
            // Find and focus the textarea inside the container
            const textarea = elemDOM.querySelector('.text-element');
            if (textarea) {
                textarea.style.display = 'block';
                const display = elemDOM.querySelector('.text-display');
                if (display) display.style.display = 'none';
                textarea.focus();
            }
            
            // Update undo/redo buttons
            this.view.updateUndoRedoButtons();
            OPTIMISM.log('Text element created successfully');
        } catch (error) {
            OPTIMISM.logError('Error creating element:', error);
        }
    }
    
    async addImage(file, x, y) {
        if (!this.isInitialized) {
            OPTIMISM.logError('Cannot add image: application not initialized');
            return;
        }
        
        try {
            OPTIMISM.log(`Adding image at position (${x}, ${y})`);
            // Compress and resize the image
            const processedImage = await OPTIMISM.resizeImage(file, 800);
            
            // Create unique IDs
            const elementId = crypto.randomUUID();
            const imageDataId = crypto.randomUUID();
            
            // Create element data
            const element = {
                id: elementId,
                type: 'image',
                imageDataId: imageDataId,
                x: x,
                y: y,
                width: processedImage.width,
                height: processedImage.height
            };
            
            // Create an add element command
            const command = new AddElementCommand(this.model, element);
            
            // Set the image data for the command
            command.setImageData(processedImage.data);
            
            // Execute the command
            await this.model.execute(command);
            
            // Create the DOM element
            await this.view.createImageElementDOM(element);
            
            // Update undo/redo buttons
            this.view.updateUndoRedoButtons();
            OPTIMISM.log('Image added successfully');
            
            return element.id;
        } catch (error) {
            OPTIMISM.logError('Error adding image:', error);
            throw error;
        }
    }
    
    async updateElement(id, properties) {
        if (!this.isInitialized) {
            OPTIMISM.logError('Cannot update element: application not initialized');
            return;
        }
        
        try {
            OPTIMISM.log(`Updating element ${id} with properties:`, properties);
            // Create an update element command
            const command = new UpdateElementCommand(this.model, id, properties);
            
            // Execute the command
            await this.model.execute(command);
            
            const element = this.model.findElement(id);
            if (!element) return; // Element might have been deleted
            
            // Handle additional updates based on element type
            if (element.type === 'text' && properties.text !== undefined) {
                // If text is empty, the element might have been deleted
                if (properties.text === '' || properties.text === null) {
                    OPTIMISM.log('Text was empty, element likely deleted');
                    // Just update UI since the element is gone
                    this.view.renderWorkspace();
                    return;
                }
                
                // Update the card title in all navigation stacks
                const elementIndex = this.model.navigationStack.findIndex(item => item.nodeId === id);
                if (elementIndex !== -1) {
                    const newTitle = properties.text.substring(0, 60);
                    OPTIMISM.log(`Updating navigation title to: ${newTitle}`);
                    this.model.navigationStack[elementIndex].nodeTitle = newTitle;
                    this.view.renderBreadcrumbs();
                    
                    // Update page title if we're on this level
                    if (elementIndex === this.model.navigationStack.length - 1) {
                        this.view.updatePageTitle();
                    }
                }
                
                // If this element is in the current view, update its display
                const container = document.querySelector(`.element-container[data-id="${id}"]`);
                if (container && container.dataset.type === 'text') {
                    const display = container.querySelector('.text-display');
                    if (display) {
                        // Check if we need to apply header formatting
                        if (element.style && element.style.hasHeader) {
                            display.innerHTML = this.view.formatTextWithHeader(properties.text || '', true);
                        } else {
                            display.innerHTML = this.view.convertUrlsToLinks(properties.text || '');
                        }
                    }
                }
            }
            
            // If dimensions were updated
            if (properties.width !== undefined || properties.height !== undefined) {
                const container = document.querySelector(`.element-container[data-id="${id}"]`);
                if (container) {
                    if (properties.width !== undefined) {
                        container.style.width = `${properties.width}px`;
                    }
                    if (properties.height !== undefined) {
                        container.style.height = `${properties.height}px`;
                    }
                    OPTIMISM.log(`Updated element dimensions: ${container.style.width} × ${container.style.height}`);
                }
            }
            
            // Update undo/redo buttons
            this.view.updateUndoRedoButtons();
        } catch (error) {
            OPTIMISM.logError('Error updating element:', error);
        }
    }
    
    async updateElementStyle(id, styleProperties) {
        if (!this.isInitialized) {
            OPTIMISM.logError('Cannot update element style: application not initialized');
            return;
        }
        
        try {
            OPTIMISM.log(`Updating element ${id} style:`, styleProperties);
            const element = this.model.findElement(id);
            if (element && element.type === 'text') {
                // Ensure style object exists
                if (!element.style) {
                    element.style = {};
                }
                
                // Create a proper update command
                const newProps = {
                    style: { ...element.style, ...styleProperties }
                };
                
                // Use the update element method to create proper command
                await this.updateElement(id, newProps);
                
                // Update the DOM to reflect style changes
                const container = document.querySelector(`.element-container[data-id="${id}"]`);
                if (!container || container.dataset.type !== 'text') return;
                
                const textarea = container.querySelector('.text-element');
                const display = container.querySelector('.text-display');
                if (!textarea || !display) return;
                
                // Reset all size classes
                textarea.classList.remove('size-small', 'size-large', 'size-huge');
                display.classList.remove('size-small', 'size-large', 'size-huge');
                
                // Apply the correct size class
                if (element.style.textSize === 'large') {
                    textarea.classList.add('size-large');
                    display.classList.add('size-large');
                } else if (element.style.textSize === 'huge') {
                    textarea.classList.add('size-huge');
                    display.classList.add('size-huge');
                }
                
                // Reset all color classes
                textarea.classList.remove('color-default', 'color-red', 'color-green');
                display.classList.remove('color-default', 'color-red', 'color-green');
                
                // Apply the correct color class
                if (element.style.textColor) {
                    textarea.classList.add(`color-${element.style.textColor}`);
                    display.classList.add(`color-${element.style.textColor}`);
                } else {
                    textarea.classList.add('color-default');
                    display.classList.add('color-default');
                }
                
                // Handle header formatting
                if (styleProperties.hasHeader !== undefined) {
                    if (styleProperties.hasHeader) {
                        display.classList.add('has-header');
                        display.innerHTML = this.view.formatTextWithHeader(element.text || '', true);
                    } else {
                        display.classList.remove('has-header');
                        display.innerHTML = this.view.convertUrlsToLinks(element.text || '');
                    }
                }
                
                OPTIMISM.log('Element style updated successfully');
            }
        } catch (error) {
            OPTIMISM.logError('Error updating element style:', error);
        }
    }
    
    async deleteElement(id) {
        if (!this.isInitialized) {
            OPTIMISM.logError('Cannot delete element: application not initialized');
            return false;
        }
        
        try {
            OPTIMISM.log(`Deleting element ${id}`);
            // Create a delete element command
            const command = new DeleteElementCommand(this.model, id);
            
            // Execute the command
            const result = await this.model.execute(command);
            
            if (result) {
                OPTIMISM.log('Element deleted successfully');
                this.view.renderWorkspace();
                this.view.updateUndoRedoButtons();
                return true;
            }
            OPTIMISM.log('Element deletion failed or element not found');
            return false;
        } catch (error) {
            OPTIMISM.logError('Error deleting element:', error);
            return false;
        }
    }
    
    async moveElement(elementId, targetElementId) {
        if (!this.isInitialized) {
            OPTIMISM.logError('Cannot move element: application not initialized');
            return false;
        }
        
        try {
            OPTIMISM.log(`Moving element ${elementId} to target ${targetElementId}`);
            // Create a move element command
            const command = new MoveElementCommand(this.model, elementId, targetElementId);
            
            // Execute the command
            const result = await this.model.execute(command);

            if (result) {
                OPTIMISM.log('Element moved successfully');
                this.view.renderWorkspace();
                this.view.updateUndoRedoButtons();
                return true;
            }
            OPTIMISM.log('Element move failed');
            return false;
        } catch (error) {
            OPTIMISM.logError('Error moving element:', error);
            return false;
        }
    }
    
    async navigateToElement(id) {
        if (!this.isInitialized) {
            OPTIMISM.logError('Cannot navigate: application not initialized');
            return false;
        }
        
        try {
            OPTIMISM.log(`Navigating to element ${id}`);
            if (await this.model.navigateToElement(id)) {
                OPTIMISM.log('Navigation successful');
                this.view.renderWorkspace();
                return true;
            }
            OPTIMISM.log('Navigation failed');
            return false;
        } catch (error) {
            OPTIMISM.logError('Error navigating to element:', error);
            return false;
        }
    }

    async navigateBack() {
        if (!this.isInitialized) {
            OPTIMISM.logError('Cannot navigate back: application not initialized');
            return false;
        }
        
        try {
            OPTIMISM.log('Navigating back');
            if (await this.model.navigateBack()) {
                OPTIMISM.log('Navigation back successful');
                this.view.renderWorkspace();
                return true;
            }
            OPTIMISM.log('Navigation back failed');
            return false;
        } catch (error) {
            OPTIMISM.logError('Error navigating back:', error);
            return false;
        }
    }

    async navigateToIndex(index) {
        if (!this.isInitialized) {
            OPTIMISM.logError('Cannot navigate to index: application not initialized');
            return false;
        }
        
        try {
            OPTIMISM.log(`Navigating to index ${index}`);
            if (await this.model.navigateToIndex(index)) {
                OPTIMISM.log('Navigation to index successful');
                this.view.renderWorkspace();
                return true;
            }
            OPTIMISM.log('Navigation to index failed');
            return false;
        } catch (error) {
            OPTIMISM.logError('Error navigating to index:', error);
            return false;
        }
    }
    
    async toggleDebugPanel() {
        if (!this.isInitialized) {
            OPTIMISM.logError('Cannot toggle debug panel: application not initialized');
            return;
        }
        
        try {
            OPTIMISM.log('Toggling debug panel');
            const isVisible = this.model.toggleDebugPanel();
            this.view.updateDebugPanelVisibility(isVisible);
            OPTIMISM.log(`Debug panel set to ${isVisible ? 'visible' : 'hidden'}`);
        } catch (error) {
            OPTIMISM.logError('Error toggling debug panel:', error);
        }
    }
    
    async exportData() {
        if (!this.isInitialized || !this.exportImportManager) {
            OPTIMISM.logError('Cannot export data: application not initialized');
            return;
        }
        
        try {
            OPTIMISM.log('Starting data export');
            await this.exportImportManager.exportData();
            OPTIMISM.log('Data export complete');
        } catch (error) {
            OPTIMISM.logError('Error exporting data:', error);
            alert('Failed to export data. Please try again.');
        }
    }
    
    async importData(file) {
        if (!this.isInitialized || !this.exportImportManager) {
            OPTIMISM.logError('Cannot import data: application not initialized');
            return;
        }
        
        try {
            OPTIMISM.log('Starting data import');
            const success = await this.exportImportManager.importData(file);
            if (success) {
                OPTIMISM.log('Data import complete');
                this.view.renderWorkspace();
            } else {
                OPTIMISM.logError('Data import failed');
                alert('Failed to import data. The file may be invalid or corrupted.');
            }
        } catch (error) {
            OPTIMISM.logError('Error importing data:', error);
            alert('Failed to import data. Please try again.');
        }
    }
    
    async undo() {
        if (!this.isInitialized) {
            OPTIMISM.logError('Cannot undo: application not initialized');
            return false;
        }
        
        try {
            OPTIMISM.log('Performing undo');
            if (await this.model.undo()) {
                OPTIMISM.log('Undo successful');
                this.view.renderWorkspace();
                return true;
            }
            OPTIMISM.log('Nothing to undo');
            return false;
        } catch (error) {
            OPTIMISM.logError('Error during undo:', error);
            return false;
        }
    }

    async redo() {
        if (!this.isInitialized) {
            OPTIMISM.logError('Cannot redo: application not initialized');
            return false;
        }
        
        try {
            OPTIMISM.log('Performing redo');
            if (await this.model.redo()) {
                OPTIMISM.log('Redo successful');
                this.view.renderWorkspace();
                return true;
            }
            OPTIMISM.log('Nothing to redo');
            return false;
        } catch (error) {
            OPTIMISM.logError('Error during redo:', error);
            return false;
        }
    }
    
    async toggleTheme() {
        if (!this.isInitialized) {
            OPTIMISM.logError('Cannot toggle theme: application not initialized');
            return this.model.isDarkTheme;
        }
        
        try {
            OPTIMISM.log('Toggling theme');
            const isDarkTheme = await this.model.toggleTheme();
            this.view.updateTheme(isDarkTheme);
            OPTIMISM.log(`Theme set to ${isDarkTheme ? 'dark' : 'light'}`);
            return isDarkTheme;
        } catch (error) {
            OPTIMISM.logError('Error toggling theme:', error);
            return this.model.isDarkTheme;
        }
    }
}