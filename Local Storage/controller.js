// Controller to handle user actions
class CanvasController {
    constructor(model, view) {
        this.model = model;
        this.view = view;
        this.isInitialized = false;
        this.exportImportManager = null;
    }
    
// In controller.js, remove the updateUrlHash from initialize
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
        
        // Don't update URL hash on initialization
        // Let the core init function handle it
        
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
            const { result, showBackupReminder } = await this.model.execute(command);
            
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
            
            // Show backup reminder if needed
            if (showBackupReminder) {
                this.view.showBackupReminderModal();
            }
            
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
            // Compress and resize the image to 1200px max storage dimension, 600px max display dimension, with 0.7 quality
            const processedImage = await OPTIMISM.resizeImage(file, 1200, 0.95, 600);
            
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
                height: processedImage.height,
                storageWidth: processedImage.storageWidth,
                storageHeight: processedImage.storageHeight
            };
            
            // Create an add element command
            const command = new AddElementCommand(this.model, element);
            
            // Set the image data for the command
            command.setImageData(processedImage.data);
            
            // Execute the command
            const { result, showBackupReminder } = await this.model.execute(command);
            
            // Create the DOM element
            await this.view.createImageElementDOM(element);
            
            // Update undo/redo buttons
            this.view.updateUndoRedoButtons();
            
            // Show backup reminder if needed
            if (showBackupReminder) {
                this.view.showBackupReminderModal();
            }
            
            OPTIMISM.log('Image added successfully');
            
            return element.id;
        } catch (error) {
            OPTIMISM.logError('Error adding image:', error);
            throw error;
        }
    }
    
    // In controller.js, modify the updateElement method
// In controller.js, modify the updateElement method
async updateElement(id, properties) {
    if (!this.isInitialized) {
        OPTIMISM.logError('Cannot update element: application not initialized');
        return false;
    }
    
    try {
        OPTIMISM.log(`Updating element ${id} with properties:`, properties);
        
        // Special case for text elements with empty text
        const element = this.model.findElement(id);
        if (element && element.type === 'text' && 
            properties.text !== undefined && 
            (properties.text === '' || properties.text === null || properties.text.trim() === '')) {
            
            // Create a delete command instead of an update command
            OPTIMISM.log(`Text is empty, deleting element ${id}`);
            return await this.deleteElement(id);
        }
        
        // Create an update element command
        const command = new UpdateElementCommand(this.model, id, properties);
        
        // Execute the command
        const { result, showBackupReminder } = await this.model.execute(command);
        
        const updatedElement = this.model.findElement(id);
        if (!updatedElement) {
            OPTIMISM.log('Element deleted during update');
            this.view.renderWorkspace();
            return false;
        }
        
        // Handle additional updates based on element type
        if (updatedElement.type === 'text' && properties.text !== undefined) {
            // Update the navigation titles if this element appears in any navigation paths
            await this.model.updateNavigationTitles(id, properties.text);
            
            // Render breadcrumbs to show updated titles
            this.view.renderBreadcrumbs();
            
            // Update page title
            this.view.updatePageTitle();
            
            // If this element is in the current view, update its display
            const container = document.querySelector(`.element-container[data-id="${id}"]`);
            if (container && container.dataset.type === 'text') {
                const display = container.querySelector('.text-display');
                if (display) {
                    // Check if we need to apply header formatting
                    if (updatedElement.style && updatedElement.style.hasHeader) {
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
        
        // Show backup reminder if needed
        if (showBackupReminder) {
            this.view.showBackupReminderModal();
        }
        
        // Update undo/redo buttons
        this.view.updateUndoRedoButtons();
        return true;
    } catch (error) {
        OPTIMISM.logError('Error updating element:', error);
        return false;
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
    
                // Handle highlight formatting
                if (styleProperties.isHighlighted !== undefined) {
                    if (styleProperties.isHighlighted) {
                        textarea.classList.add('is-highlighted');
                        textarea.style.backgroundColor = 'rgb(255, 255, 176)';
                        display.classList.add('is-highlighted');
                    } else {
                        textarea.classList.remove('is-highlighted');
                        textarea.style.backgroundColor = '';
                        display.classList.remove('is-highlighted');
                    }
                    
                    // Update the display content to add or remove highlighting
                    const hasHeader = element.style && element.style.hasHeader;
                    const isHighlighted = styleProperties.isHighlighted;
                    
                    if (hasHeader) {
                        display.innerHTML = this.view.formatTextWithHeader(element.text || '', true, isHighlighted);
                    } else {
                        display.innerHTML = this.view.convertUrlsToLinks(element.text || '', isHighlighted);
                    }
                }
                
                // Handle border setting
if (styleProperties.hasBorder !== undefined) {
    if (styleProperties.hasBorder) {
        container.classList.add('has-permanent-border');
    } else {
        container.classList.remove('has-permanent-border');
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
            const { result, showBackupReminder } = await this.model.execute(command);
            
            if (result) {
                OPTIMISM.log('Element deleted successfully');
                this.view.renderWorkspace();
                this.view.updateUndoRedoButtons();
                
                // Show backup reminder if needed
                if (showBackupReminder) {
                    this.view.showBackupReminderModal();
                }
                
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
            const { result, showBackupReminder } = await this.model.execute(command);
    
            if (result) {
                OPTIMISM.log('Element moved successfully');
                this.view.renderWorkspace();
                this.view.updateUndoRedoButtons();
                
                // Show backup reminder if needed
                if (showBackupReminder) {
                    this.view.showBackupReminderModal();
                }
                
                return true;
            }
            OPTIMISM.log('Element move failed');
            return false;
        } catch (error) {
            OPTIMISM.logError('Error moving element:', error);
            return false;
        }
    }
    
    async moveElementToBreadcrumb(elementId, navIndex) {
        if (!this.isInitialized) {
            OPTIMISM.logError('Cannot move element: application not initialized');
            return false;
        }
        
        try {
            OPTIMISM.log(`Moving element ${elementId} to navigation level ${navIndex}`);
            
            // Create a breadcrumb move command
            const command = new MoveElementToBreadcrumbCommand(this.model, elementId, navIndex);
            
            // Execute the command
            const { result, showBackupReminder } = await this.model.execute(command);
            
            if (result) {
                OPTIMISM.log('Element moved to breadcrumb level successfully');
                this.view.renderWorkspace();
                this.view.updateUndoRedoButtons();
                
                // Show backup reminder if needed
                if (showBackupReminder) {
                    this.view.showBackupReminderModal();
                }
                
                return true;
            }
            OPTIMISM.log('Element move to breadcrumb failed');
            return false;
        } catch (error) {
            OPTIMISM.logError('Error moving element to breadcrumb:', error);
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

    async exportDataWithoutImages() {
        if (!this.isInitialized || !this.exportImportManager) {
            OPTIMISM.logError('Cannot export data: application not initialized');
            return;
        }
        
        try {
            OPTIMISM.log('Starting data export without images');
            await this.exportImportManager.exportData(false); // Pass false to exclude images
            OPTIMISM.log('Data export without images complete');
        } catch (error) {
            OPTIMISM.logError('Error exporting data without images:', error);
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

    // In controller.js, add this new method:

    // In controller.js, modify the updateElementWithUndo method
// In controller.js, modify the updateElementWithUndo method
async updateElementWithUndo(id, newProperties, oldProperties) {
    if (!this.isInitialized) {
        OPTIMISM.logError('Cannot update element: application not initialized');
        return;
    }
    
    try {
        OPTIMISM.log(`Updating element ${id} with properties for undo:`, newProperties);
        // Create an update element command with explicit old properties
        const command = new UpdateElementCommand(this.model, id, newProperties, oldProperties);
        
        // Execute the command
        const { result, showBackupReminder } = await this.model.execute(command);
        
        const element = this.model.findElement(id);
        if (!element) return; // Element might have been deleted
        
        // Handle additional updates based on element type
        if (element.type === 'text' && newProperties.text !== undefined) {
            // If text is empty, the element might have been deleted
            if (newProperties.text === '' || newProperties.text === null || newProperties.text.trim() === '') {
                OPTIMISM.log('Text was empty, element likely deleted');
                // Just update UI since the element is gone
                this.view.renderWorkspace();
                return;
            }
            
            // Update the navigation titles if this element appears in any navigation paths
            await this.model.updateNavigationTitles(id, newProperties.text);
            
            // Render breadcrumbs to show updated titles
            this.view.renderBreadcrumbs();
            
            // Update page title
            this.view.updatePageTitle();
            
            // If this element is in the current view, update its display
            const container = document.querySelector(`.element-container[data-id="${id}"]`);
            if (container && container.dataset.type === 'text') {
                const display = container.querySelector('.text-display');
                if (display) {
                    // Check if we need to apply header formatting
                    if (element.style && element.style.hasHeader) {
                        display.innerHTML = this.view.formatTextWithHeader(newProperties.text || '', true);
                    } else {
                        display.innerHTML = this.view.convertUrlsToLinks(newProperties.text || '');
                    }
                }
            }
        }
        
        // If dimensions were updated
        if (newProperties.width !== undefined || newProperties.height !== undefined) {
            const container = document.querySelector(`.element-container[data-id="${id}"]`);
            if (container) {
                if (newProperties.width !== undefined) {
                    container.style.width = `${newProperties.width}px`;
                }
                if (newProperties.height !== undefined) {
                    container.style.height = `${newProperties.height}px`;
                }
                OPTIMISM.log(`Updated element dimensions: ${container.style.width} × ${container.style.height}`);
            }
        }
        
        // Show backup reminder if needed
        if (showBackupReminder) {
            this.view.showBackupReminderModal();
        }
        
        // Update undo/redo buttons
        this.view.updateUndoRedoButtons();
    } catch (error) {
        OPTIMISM.logError('Error updating element:', error);
    }
}

    // For controller.js - Updated addImageFromUrl method
async addImageFromUrl(url, x, y) {
    if (!this.isInitialized) {
        OPTIMISM.logError('Cannot add image: application not initialized');
        return;
    }
    
    try {
        OPTIMISM.log(`Adding image from URL: ${url} at position (${x}, ${y})`);
        
        // Handle relative URLs by converting to absolute
        if (url.startsWith('/')) {
            // This assumes the URL is relative to the current domain
            const base = window.location.origin;
            url = base + url;
            OPTIMISM.log(`Converted to absolute URL: ${url}`);
        } else if (!url.match(/^https?:\/\//i) && !url.startsWith('data:')) {
            // If not absolute and not a data URL, assume it's relative to the current page
            const base = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
            url = base + url;
            OPTIMISM.log(`Converted to absolute URL: ${url}`);
        }
        
        // For data URLs, convert directly to a blob
        if (url.startsWith('data:image/')) {
            OPTIMISM.log('Processing data URL');
            const parts = url.split(',');
            const mimeMatch = parts[0].match(/data:(image\/[^;]+)/);
            
            if (!mimeMatch) {
                throw new Error('Invalid data URL format');
            }
            
            const mimetype = mimeMatch[1];
            const imageData = parts[1];
            let binary;
            
            // Check if it's base64 encoded
            if (parts[0].includes('base64')) {
                binary = atob(imageData);
            } else {
                // Decode the URL-encoded data
                binary = decodeURIComponent(imageData);
            }
            
            // Create array buffer
            const buffer = new ArrayBuffer(binary.length);
            const view = new Uint8Array(buffer);
            
            for (let i = 0; i < binary.length; i++) {
                view[i] = binary.charCodeAt(i);
            }
            
            const blob = new Blob([buffer], { type: mimetype });
            const filename = 'image.' + mimetype.split('/')[1];
            const file = new File([blob], filename, { type: mimetype });
            
            // Use the existing method to process the file
            return await this.addImage(file, x, y);
        }
        
        // For regular URLs, fetch the image
        OPTIMISM.log(`Fetching image from URL: ${url}`);
        const response = await fetch(url, {
            // Add these options to handle CORS issues when possible
            mode: 'cors',
            credentials: 'same-origin'
        }).catch(error => {
            // If CORS error, try without CORS (might work for some images)
            OPTIMISM.logError('CORS fetch failed, trying without CORS:', error);
            return fetch(url, { mode: 'no-cors' });
        });
        
        // If we couldn't fetch the URL, throw an error
        if (!response || !response.ok) {
            throw new Error(`Failed to fetch image: ${response?.statusText || 'Network error'}`);
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.startsWith('image/')) {
            OPTIMISM.log(`Content-Type is not an image: ${contentType}`);
            
            // If the response doesn't explicitly say it's an image,
            // we'll still try to process it as one
            OPTIMISM.log('Attempting to process as image anyway');
        }
        
        const blob = await response.blob();
        
        // Determine file extension from content type or URL
        const extension = contentType ? 
            contentType.split('/')[1].split(';')[0] : 
            url.split('.').pop().split('?')[0];
        
        const filename = `web-image.${extension || 'jpg'}`;
        
        // Create a File object from the blob
        const file = new File([blob], filename, { 
            type: contentType || 'image/jpeg' 
        });
        
        // Now use the existing method to add the image
        return await this.addImage(file, x, y);
    } catch (error) {
        OPTIMISM.logError('Error adding image from URL:', error);
        throw error;
    }
}

// Add this method to the CanvasController class in controller.js
async toggleImagesLocked() {
    if (!this.isInitialized) {
        OPTIMISM.logError('Cannot toggle images locked: application not initialized');
        return this.model.imagesLocked;
    }
    
    try {
        OPTIMISM.log('Toggling images locked state');
        const isLocked = await this.model.toggleImagesLocked();
        this.view.updateImagesLockState(isLocked);
        OPTIMISM.log(`Images locked state set to ${isLocked}`);
        return isLocked;
    } catch (error) {
        OPTIMISM.logError('Error toggling images locked state:', error);
        return this.model.imagesLocked;
    }
}

async addQuickLink(nodeId, nodeTitle) {
    if (!this.isInitialized) {
        OPTIMISM.logError('Cannot add quick link: application not initialized');
        return false;
    }
    
    try {
        OPTIMISM.log(`Adding quick link for node ${nodeId}`);
        const success = await this.model.addQuickLink(nodeId, nodeTitle);
        if (success) {
            this.view.renderQuickLinks();
            return true;
        }
        return false;
    } catch (error) {
        OPTIMISM.logError('Error adding quick link:', error);
        return false;
    }
}

async removeQuickLink(nodeId) {
    if (!this.isInitialized) {
        OPTIMISM.logError('Cannot remove quick link: application not initialized');
        return false;
    }
    
    try {
        OPTIMISM.log(`Removing quick link for node ${nodeId}`);
        const success = await this.model.removeQuickLink(nodeId);
        if (success) {
            this.view.renderQuickLinks();
            return true;
        }
        return false;
    } catch (error) {
        OPTIMISM.logError('Error removing quick link:', error);
        return false;
    }
}

// In controller.js
async navigateToNode(nodeId) {
    if (!this.isInitialized) {
        OPTIMISM.logError('Cannot navigate to node: application not initialized');
        return false;
    }
    
    try {
        OPTIMISM.log(`Navigating to node ${nodeId}`);
        if (await this.model.navigateToNode(nodeId)) {
            OPTIMISM.log('Navigation successful');
            this.view.renderWorkspace();
            return true;
        }
        OPTIMISM.log('Navigation failed');
        return false;
    } catch (error) {
        OPTIMISM.logError('Error navigating to node:', error);
        return false;
    }
}

}