// Controller to handle user actions
class CanvasController {
    constructor(model, view) {
        this.model = model;
        this.view = view;
        this.isInitialized = false;
        this.exportImportManager = null;
    }

// Update the initialize method in controller.js to call our new setup method
async initialize() {
    OPTIMISM.log('Initializing controller');
    this.view.showLoading();
    try {
        await this.model.initialize();

        // Initialize export/import manager
        this.exportImportManager = new ExportImportManager(this.model, this.view);


        this.view.setupEventListeners();
        this.view.setupDragListeners();
        this.view.setupStylePanel();
        this.view.setupThemeToggle();
        this.view.setupUndoRedoButtons();
        this.view.setupGridPanel();
        this.view.setupArenaToggle(); // Add this line
        this.view.setupPrioritiesPanel(); // Add this line
        this.view.setupPrioritiesPanel();
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

        // Calculate default width as 30% of the window width
        const maxWidth = Math.floor(window.innerWidth * 0.3);

        const element = {
            id: crypto.randomUUID(),
            type: 'text',
            x: x,
            y: y,
            text: '',
            width: 200,
            height: 100,
            style: {
                textSize: 'small',
                textColor: 'default',
                textAlign: 'left', // Make sure alignment default is here too
                hasHeader: false,
                cardBgColor: 'none' // Add default background color
            },
            autoSize: true
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

        // Update spacer position AFTER the element is added to the DOM
        this.view.updateSpacerPosition();

        // Show backup reminder if needed
        if (showBackupReminder) {
            this.view.showBackupReminderModal();
        }

        this.updateSpacerPosition();

        OPTIMISM.log('Text element created successfully');
    } catch (error) {
        OPTIMISM.logError('Error creating element:', error);
    }
}

// In controller.js - update the addImage method
async addImage(file, x, y) {
    if (!this.isInitialized) {
        OPTIMISM.logError('Cannot add image: application not initialized');
        throw new Error('Application not initialized');
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

        // Update spacer position AFTER the element is added to the DOM
        this.view.updateSpacerPosition();

        // Show backup reminder if needed
        if (showBackupReminder) {
            this.view.showBackupReminderModal();
        }

        OPTIMISM.log('Image added successfully');

        return element.id;
    } catch (error) {
        OPTIMISM.logError('Error adding image:', error);
        throw error; // Re-throw to allow caller to handle
    }
}

    // In controller.js, modify the updateElement method
// In controller.js, modify the updateElement method
// In controller.js, update the updateElement method to call updateNavigationTitles
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
        const element = this.model.findElement(id); // Get element BEFORE update for comparison/check

        // Check if the element exists before proceeding
        if (!element) {
            OPTIMISM.logError(`Element ${id} not found for style update.`);
            return;
        }

        // Ensure style object exists in the current element data
        const currentStyle = element.style || {};
        const newStyle = { ...currentStyle, ...styleProperties };

        // Create a proper update command using the main update method
        const newProps = { style: newStyle };
        // *** Execute the command to update the model and handle undo/redo ***
        await this.updateElement(id, newProps);

        // --- START: Direct DOM Manipulation for Immediate Visual Update ---

        const container = document.querySelector(`.element-container[data-id="${id}"]`);
        if (!container) {
            OPTIMISM.logError(`Container for element ${id} not found in DOM.`);
            return; // Exit if container not found
        }

        // Get the *updated* element data from the model after the command execution
        const updatedElement = this.model.findElement(id);
        if (!updatedElement) {
             OPTIMISM.logError(`Element ${id} not found in model AFTER update command.`);
             return; // Should not happen normally, but good check
        }
        const finalStyle = updatedElement.style || {}; // Use updated style

        // Handle TEXT SPECIFIC styles (Size, Color, Align, Header, Highlight)
        if (element.type === 'text') { // Check original element type
            const textarea = container.querySelector('.text-element');
            const display = container.querySelector('.text-display');
            if (!textarea || !display) {
                 OPTIMISM.logError(`Textarea or display not found for text element ${id}`);
                 // Continue to update container styles even if inner elements are missing
            } else {
                // Text Size
                if (styleProperties.textSize !== undefined) {
                    textarea.classList.remove('size-small', 'size-large', 'size-huge');
                    display.classList.remove('size-small', 'size-large', 'size-huge');
                    if (finalStyle.textSize) {
                        textarea.classList.add(`size-${finalStyle.textSize}`);
                        display.classList.add(`size-${finalStyle.textSize}`);
                    }
                }

                // Text Color
                if (styleProperties.textColor !== undefined) {
                    textarea.classList.remove('color-default', 'color-red', 'color-green');
                    display.classList.remove('color-default', 'color-red', 'color-green');
                    const colorClass = `color-${finalStyle.textColor || 'default'}`;
                    textarea.classList.add(colorClass);
                    display.classList.add(colorClass);
                }

                // Text Alignment
                if (styleProperties.textAlign !== undefined) {
                    textarea.classList.remove('align-left', 'align-centre', 'align-right');
                    display.classList.remove('align-left', 'align-centre', 'align-right');
                    const alignClass = `align-${finalStyle.textAlign || 'left'}`;
                    textarea.classList.add(alignClass);
                    display.classList.add(alignClass);
                }

                // Header Formatting (Needs to re-render text display)
                if (styleProperties.hasHeader !== undefined) {
                    if (finalStyle.hasHeader) {
                        display.classList.add('has-header');
                        // Pass highlight status when re-rendering
                        display.innerHTML = this.view.formatTextWithHeader(updatedElement.text || '', true, finalStyle.isHighlighted);
                    } else {
                        display.classList.remove('has-header');
                        // Pass highlight status when re-rendering
                        display.innerHTML = this.view.convertUrlsToLinks(updatedElement.text || '', finalStyle.isHighlighted);
                    }
                }

                // Highlight Formatting (Also needs to re-render text display)
                 if (styleProperties.isHighlighted !== undefined) {
                    if (finalStyle.isHighlighted) {
                        textarea.classList.add('is-highlighted');
                        textarea.style.backgroundColor = 'rgb(255, 255, 176)';
                        display.classList.add('is-highlighted');
                    } else {
                        textarea.classList.remove('is-highlighted');
                        textarea.style.backgroundColor = '';
                        display.classList.remove('is-highlighted');
                    }
                    // Re-render display content for highlight changes
                    const hasHeader = finalStyle.hasHeader; // Use updated style
                    if (hasHeader) {
                        display.innerHTML = this.view.formatTextWithHeader(updatedElement.text || '', true, finalStyle.isHighlighted);
                    } else {
                        display.innerHTML = this.view.convertUrlsToLinks(updatedElement.text || '', finalStyle.isHighlighted);
                    }
                }
            } // end if textarea/display exist
        } // End TEXT specific styles

        // Handle styles applicable to BOTH Text and Image Containers

        // Card Background Color (THIS IS THE KEY PART)
        if (styleProperties.cardBgColor !== undefined) {
            container.classList.remove('card-bg-none', 'card-bg-yellow', 'card-bg-red'); // Clear existing
            const bgColor = finalStyle.cardBgColor || 'none'; // Get the final color
            if (bgColor !== 'none') {
                 container.classList.add(`card-bg-${bgColor}`); // Add the new class if not 'none'
            }
             OPTIMISM.log(`Applied background class: card-bg-${bgColor} to container ${id}`);
        }

        // Card Border
        if (styleProperties.hasBorder !== undefined) {
            if (finalStyle.hasBorder) {
                container.classList.add('has-permanent-border');
            } else {
                container.classList.remove('has-permanent-border');
            }
        }

        // Card Lock (The model update already happened via updateElement, this syncs the View's perception)
        if (styleProperties.isLocked !== undefined) {
            // We don't need to call model.lock/unlock again here
            // Just update the view's class and potentially the style panel selection
            this.view.updateCardLockState(id, finalStyle.isLocked);
        }

        // --- END: Direct DOM Manipulation ---

        OPTIMISM.log('Element style updated successfully (including immediate DOM update)');

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
            const gridWasVisible = this.model.isGridVisible; // Store grid state

            // Create a delete element command
            const command = new DeleteElementCommand(this.model, id);

            // Execute the command
            const { result, showBackupReminder } = await this.model.execute(command);

            if (result) {
                OPTIMISM.log('Element deleted successfully');

                // Clear the selected element in the model since it's been deleted
                this.model.selectedElement = null;

                // Hide the style panel since no element is selected
                this.view.stylePanel.style.display = 'none';

                // renderWorkspace handles the spacer update now
                this.view.renderWorkspace();

                // Restore grid if it was visible
                if (gridWasVisible && !this.model.isGridVisible) {
                    this.model.isGridVisible = true;
                    this.view.updateGridVisibility(true);
                    await this.model.saveAppState();
                }

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
            const gridWasVisible = this.model.isGridVisible; // Store grid state

            if (await this.model.navigateToElement(id)) {
                OPTIMISM.log('Navigation successful');

                // Deselect any selected elements
                this.model.selectedElement = null;

                // Render the workspace
                this.view.renderWorkspace();

                // Restore grid if it was visible
                if (gridWasVisible && !this.model.isGridVisible) {
                    this.model.isGridVisible = true;
                    this.view.updateGridVisibility(true);
                    await this.model.saveAppState();
                }

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
            const gridWasVisible = this.model.isGridVisible; // Store grid state

            if (await this.model.navigateBack()) {
                OPTIMISM.log('Navigation back successful');
                this.view.renderWorkspace();

                // Restore grid if it was visible
                if (gridWasVisible && !this.model.isGridVisible) {
                    this.model.isGridVisible = true;
                    this.view.updateGridVisibility(true);
                    await this.model.saveAppState();
                }

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
            const gridWasVisible = this.model.isGridVisible; // Store grid state

            if (await this.model.navigateToIndex(index)) {
                OPTIMISM.log('Navigation to index successful');
                this.view.renderWorkspace();

                // Restore grid if it was visible
                if (gridWasVisible && !this.model.isGridVisible) {
                    this.model.isGridVisible = true;
                    this.view.updateGridVisibility(true);
                    await this.model.saveAppState();
                }

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

    // In controller.js - update the addImageFromUrl method
async addImageFromUrl(url, x, y) {
    if (!this.isInitialized) {
        OPTIMISM.logError('Cannot add image: application not initialized');
        throw new Error('Application not initialized');
    }

    try {
        OPTIMISM.log(`Adding image from URL: ${url} at position (${x}, ${y})`);

        // Clean up Are.na URLs (remove query parameters)
        if (url.includes('d2w9rnfcy7mm78.cloudfront.net')) {
            const cleanUrl = url.split('?')[0];
            OPTIMISM.log(`Cleaned up Are.na URL: ${cleanUrl}`);
            url = cleanUrl;
        }

        // Use a reliable imgproxy service
        const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(url)}&default=default`;
        OPTIMISM.log(`Using image proxy: ${proxyUrl}`);

        // Create a new Image element to load the image through the proxy
        const img = new Image();

        // Create a promise that resolves when the image loads
        const imageLoaded = new Promise((resolve, reject) => {
            img.onload = () => {
                OPTIMISM.log(`Image loaded successfully via proxy: ${img.width}x${img.height}`);
                resolve(img);
            };

            img.onerror = (err) => {
                OPTIMISM.logError('Error loading image via proxy:', err);
                reject(new Error('Failed to load image via proxy'));
            };
        });

        // Set a timeout to handle cases where the image might never load
        const imageLoadTimeout = new Promise((resolve, reject) => {
            setTimeout(() => reject(new Error('Image load timed out')), 15000);
        });

        // Set the source to start loading
        img.crossOrigin = 'anonymous';
        img.src = proxyUrl;

        // Wait for the image to load or timeout
        const loadedImg = await Promise.race([imageLoaded, imageLoadTimeout]);

        // Create a canvas to convert the image to a blob
        const canvas = document.createElement('canvas');
        canvas.width = loadedImg.width;
        canvas.height = loadedImg.height;

        // Draw the image on the canvas
        const ctx = canvas.getContext('2d');
        ctx.drawImage(loadedImg, 0, 0);

        // Convert canvas to blob
        const blob = await new Promise((resolve) => {
            canvas.toBlob(resolve, 'image/png');
        });

        if (!blob) {
            throw new Error('Failed to convert image to blob');
        }

        // Create a File object from the blob
        const filename = 'arena-image.png';
        const file = new File([blob], filename, { type: 'image/png' });

        OPTIMISM.log(`Successfully created file from image: ${filename}, size: ${file.size} bytes`);

        // Now use the existing method to add the image
        return await this.addImage(file, x, y);
    } catch (error) {
        OPTIMISM.logError('Error adding image from URL:', error);
        throw error; // Re-throw to allow caller to handle
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

// Add this method to the CanvasController class in controller.js
async refreshQuickLinkExpiry(nodeId) {
    if (!this.isInitialized) {
      OPTIMISM.logError('Cannot refresh quick link: application not initialized');
      return false;
    }

    try {
      OPTIMISM.log(`Refreshing expiry for quick link ${nodeId}`);
      const success = await this.model.refreshQuickLinkExpiry(nodeId);
      if (success) {
        this.view.renderQuickLinks();
        return true;
      }
      return false;
    } catch (error) {
      OPTIMISM.logError('Error refreshing quick link expiry:', error);
      return false;
    }
  }

  async toggleCardLock(cardId) {
    if (!this.isInitialized) {
        OPTIMISM.logError('Cannot toggle card lock: application not initialized');
        return false;
    }

    try {
        OPTIMISM.log(`Toggling lock state for card ${cardId}`);
        const isLocked = await this.model.toggleCardLock(cardId);
        this.view.updateCardLockState(cardId, isLocked);
        OPTIMISM.log(`Card lock state set to ${isLocked}`);
        return isLocked;
    } catch (error) {
        OPTIMISM.logError('Error toggling card lock state:', error);
        return this.model.isCardLocked(cardId);
    }
}

// In controller.js, add these methods
async toggleInboxVisibility() {
    if (!this.isInitialized) {
        OPTIMISM.logError('Cannot toggle inbox: application not initialized');
        return this.model.isInboxVisible;
    }

    try {
        OPTIMISM.log('Toggling inbox panel visibility');
        const isVisible = await this.model.toggleInboxVisibility();
        this.view.updateInboxVisibility(isVisible);
        OPTIMISM.log(`Inbox panel visibility set to ${isVisible}`);
        return isVisible;
    } catch (error) {
        OPTIMISM.logError('Error toggling inbox visibility:', error);
        return this.model.isInboxVisible;
    }
}

async moveToInbox(elementId) {
    if (!this.isInitialized) {
        OPTIMISM.logError('Cannot move to inbox: application not initialized');
        return false;
    }

    try {
        OPTIMISM.log(`Moving element ${elementId} to inbox`);
        const element = this.model.findElement(elementId);
        if (!element) {
            OPTIMISM.logError(`Element ${elementId} not found`);
            return false;
        }

        // Make sure inbox is visible when adding an item
        // Commenting this out - let user manage inbox visibility separately
        // if (!this.model.isInboxVisible) {
        //     await this.toggleInboxVisibility();
        // }

        // Create and execute the MoveToInboxCommand
        const command = new MoveToInboxCommand(this.model, elementId);
        const { result, showBackupReminder } = await this.model.execute(command);

        if (!result) {
             OPTIMISM.logError(`Move to inbox command failed for element ${elementId}`);
             return false;
        }

        // Render inbox
        this.view.renderInboxPanel();

        // Show backup reminder if needed
        if (showBackupReminder) { this.view.showBackupReminderModal(); }

        // Update undo/redo buttons
        this.view.updateUndoRedoButtons();

        return true; // Indicate success
    } catch (error) {
        OPTIMISM.logError('Error executing move to inbox command:', error);
        // Attempt to re-render to potentially fix UI state
        this.view.renderWorkspace();
        this.view.renderInboxPanel();
        return false; // Indicate failure
    }
}

async moveFromInboxToCanvas(cardId, x, y) {
    if (!this.isInitialized) {
        OPTIMISM.logError('Cannot move from inbox: application not initialized');
        return false;
    }

    try {
        OPTIMISM.log(`Moving card ${cardId} from inbox to canvas at position (${x}, ${y})`);

        // Find the card in the inbox
        const card = this.model.inboxCards.find(card => card.id === cardId);
        if (!card) {
            OPTIMISM.logError(`Card ${cardId} not found in inbox`);
            return false;
        }

        // Create a new element for the canvas
        const newElement = {
            id: crypto.randomUUID(),
            type: card.type,
            x: x,
            y: y,
            width: card.width || 200,
            height: card.height || 100,
        };

        // Copy necessary properties based on type
        if (card.type === 'text') {
            newElement.text = card.text || '';
            newElement.style = card.style || {
                textSize: 'small',
                textColor: 'default'
            };
        } else if (card.type === 'image' && card.imageDataId) {
            // For image cards, copy image data ID and dimensions
            // The width/height are already set above based on card.width/height
            newElement.imageDataId = card.imageDataId;
            newElement.storageWidth = card.storageWidth;
            newElement.storageHeight = card.storageHeight;
        }

        // Create an add element command
        const command = new AddElementCommand(this.model, newElement);

        // For image elements, retrieve the image data and set it for the command
        if (card.type === 'image' && card.imageDataId) {
            try {
                const imageData = await this.model.getImageData(card.imageDataId);
                if (imageData) {
                    // The AddElementCommand needs the actual image data (base64 string)
                    // to potentially save it if it's treated as a new addition to the canvas.
                    command.setImageData(imageData);
                    OPTIMISM.log(`Retrieved and set image data for command (cardId: ${cardId}, imageDataId: ${card.imageDataId})`);
                } else {
                    OPTIMISM.logError(`Could not retrieve image data for inbox card ${cardId} (imageDataId: ${card.imageDataId})`);
                    // Optionally, decide if the move should fail here or continue without image data
                }
            } catch (error) {
                OPTIMISM.logError(`Error copying image data for inbox card ${cardId}:`, error);
                // Optionally, decide if the move should fail here
            }
        }

        // Execute the command to add the element to the canvas
        await this.model.execute(command);

        // Remove from inbox
        await this.model.removeFromInbox(cardId);

        // Render workspace and inbox
        this.view.renderWorkspace();
        this.view.renderInboxPanel();

        return true;
    } catch (error) {
        OPTIMISM.logError('Error moving card from inbox to canvas:', error);
        return false;
    }
}

async updateInboxCard(id, properties) {
    if (!this.isInitialized) {
        OPTIMISM.logError('Cannot update inbox card: application not initialized');
        return false;
    }

    try {
        OPTIMISM.log(`Updating inbox card ${id} with properties:`, properties);

        // Special case for text cards with empty text
        const card = this.model.inboxCards.find(card => card.id === id);
        if (card && card.type === 'text' &&
            properties.text !== undefined &&
            (properties.text === '' || properties.text === null || properties.text.trim() === '')) {

            // Delete the card if text is empty
            OPTIMISM.log(`Text is empty, deleting inbox card ${id}`);
            await this.model.removeFromInbox(id);
            this.view.renderInboxPanel();
            return true;
        }

        // Update the card
        const result = await this.model.updateInboxCard(id, properties);

        // Render inbox panel
        this.view.renderInboxPanel();

        return result !== null;
    } catch (error) {
        OPTIMISM.logError('Error updating inbox card:', error);
        return false;
    }
}

async addBlankCardToInbox() {
    if (!this.isInitialized) {
        OPTIMISM.logError('Cannot add blank card: application not initialized');
        return null;
    }

    try {
        OPTIMISM.log('Adding blank card to inbox');
        const card = await this.model.addBlankCardToInbox();

        // Ensure inbox is visible
        if (!this.model.isInboxVisible) {
            await this.toggleInboxVisibility();
        }

        // Render inbox panel
        this.view.renderInboxPanel();

        return card;
    } catch (error) {
        OPTIMISM.logError('Error adding blank card to inbox:', error);
        return null;
    }
}

// Add to CanvasController class in controller.js
async toggleGridVisibility() {
    if (!this.isInitialized) {
        OPTIMISM.logError('Cannot toggle grid: application not initialized');
        return this.model.isGridVisible;
    }

    try {
        OPTIMISM.log('Toggling grid visibility');
        this.model.isGridVisible = !this.model.isGridVisible;
        this.view.updateGridVisibility(this.model.isGridVisible);

        // Save state
        await this.model.saveAppState();

        OPTIMISM.log(`Grid visibility set to: ${this.model.isGridVisible}`);
        return this.model.isGridVisible;
    } catch (error) {
        OPTIMISM.logError('Error toggling grid visibility:', error);
        return this.model.isGridVisible;
    }
}

async setGridLayout(layout) {
    if (!this.isInitialized) {
        OPTIMISM.logError('Cannot set grid layout: application not initialized');
        return false;
    }

    try {
        OPTIMISM.log(`Setting grid layout to: ${layout}`);
        this.model.gridLayout = layout;

        // Render grid with new layout
        if (this.model.isGridVisible) {
            this.view.renderGrid();
        }

        // Save state
        await this.model.saveAppState();

        // Update UI to show current values
        this.view.updateGridInputValues();

        return true;
    } catch (error) {
        OPTIMISM.logError('Error setting grid layout:', error);
        return false;
    }
}

// Add to CanvasController class in controller.js
async toggleArenaView() {
    if (!this.isInitialized) {
        OPTIMISM.logError('Cannot toggle Are.na view: application not initialized');
        return this.model.isArenaVisible;
    }

    try {
        OPTIMISM.log('Toggling Are.na view');
        const isVisible = await this.model.toggleArenaView();

        // Update UI with new state
        this.view.updateArenaViewLayout(isVisible);

        // Get direct reference to the toggle button and update its text
        const arenaToggle = document.getElementById('arena-toggle');
        if (arenaToggle) {
            arenaToggle.textContent = isVisible ? 'Hide Are.na' : 'Show Are.na';
        }

        OPTIMISM.log(`Are.na view set to ${isVisible}`);
        return isVisible;
    } catch (error) {
        OPTIMISM.logError('Error toggling Are.na view:', error);
        return this.model.isArenaVisible;
    }
}

async toggleNestingDisabled() {
    if (!this.isInitialized) {
        OPTIMISM.logError('Cannot toggle nesting disabled: application not initialized');
        return this.model.isNestingDisabled;
    }

    try {
        OPTIMISM.log('Toggling nesting disabled state');
        const isDisabled = await this.model.toggleNestingDisabled();
        this.view.updateNestingDisabledState(isDisabled);
        OPTIMISM.log(`Nesting disabled state set to ${isDisabled}`);
        return isDisabled;
    } catch (error) {
        OPTIMISM.logError('Error toggling nesting disabled state:', error);
        return this.model.isNestingDisabled;
    }
}

// In controller.js, add this method
async toggleSettingsVisibility() {
    if (!this.isInitialized) {
        OPTIMISM.logError('Cannot toggle settings: application not initialized');
        return this.model.isSettingsVisible;
    }

    try {
        OPTIMISM.log('Toggling settings panel visibility');
        const isVisible = await this.model.toggleSettingsVisibility();
        this.view.updateSettingsVisibility(isVisible);
        OPTIMISM.log(`Settings panel visibility set to ${isVisible}`);
        return isVisible;
    } catch (error) {
        OPTIMISM.logError('Error toggling settings visibility:', error);
        return this.model.isSettingsVisible;
    }
}

// In controller.js:
async togglePanel(panelName) {
    if (!this.isInitialized) {
        OPTIMISM.logError(`Cannot toggle panel '${panelName}': application not initialized`);
        return false;
    }

    try {
        OPTIMISM.log(`Toggling panel '${panelName}'`);
        const isVisible = await this.model.togglePanel(panelName);
        this.view.updatePanelVisibility(panelName, isVisible);
        return isVisible;
    } catch (error) {
        OPTIMISM.logError(`Error toggling panel '${panelName}':`, error);
        return false;
    }
}

async toggleCardPriority(cardId) {
    if (!this.isInitialized) {
        OPTIMISM.logError('Cannot toggle card priority: application not initialized');
        return false;
    }

    try {
        OPTIMISM.log(`Toggling priority state for card ${cardId}`);
        const isPriority = await this.model.toggleCardPriority(cardId);

        // Update the card's appearance immediately
        const container = document.querySelector(`.element-container[data-id="${cardId}"]`);
        if (container) {
            if (isPriority) {
                container.classList.add('has-priority-border');
                OPTIMISM.log(`Added priority border to card ${cardId}`);
            } else {
                container.classList.remove('has-priority-border');
                OPTIMISM.log(`Removed priority border from card ${cardId}`);
            }
        } else {
            OPTIMISM.log(`Could not find container for card ${cardId} to update border`);
        }

        OPTIMISM.log(`Card priority state set to ${isPriority}`);
        return isPriority;
    } catch (error) {
        OPTIMISM.logError('Error toggling card priority state:', error);
        return this.model.isCardPriority(cardId);
    }
}

async togglePrioritiesVisibility() {
    if (!this.isInitialized) {
        OPTIMISM.logError('Cannot toggle priorities: application not initialized');
        return this.model.isPrioritiesVisible;
    }

    try {
        OPTIMISM.log('Toggling priorities panel visibility');
        const isVisible = await this.model.togglePrioritiesVisibility();
        this.view.updatePrioritiesVisibility(isVisible);
        OPTIMISM.log(`Priorities panel visibility set to ${isVisible}`);
        return isVisible;
    } catch (error) {
        OPTIMISM.logError('Error toggling priorities visibility:', error);
        return this.model.isPrioritiesVisible;
    }
}

}
