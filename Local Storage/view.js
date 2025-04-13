// View to handle UI interactions
class CanvasView {
    // Modify the constructor in CanvasView to remove the imagesLocked property initialization:
    constructor(model, controller) {
        this.model = model;
        this.controller = controller;
        this.workspace = document.getElementById('workspace');
        this.titleBar = document.getElementById('title-bar');
        this.breadcrumbContainer = document.getElementById('breadcrumb-container');
        this.stylePanel = document.getElementById('style-panel');
        this.settingsPanel = document.getElementById('settings-panel');
        this.themeToggle = document.getElementById('theme-toggle');
        this.settingsToggle = document.getElementById('settings-toggle');
        this.lockImagesButton = document.getElementById('lock-images-button');
        this.undoButton = document.getElementById('undo-button');
        this.redoButton = document.getElementById('redo-button');
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.dropZoneIndicator = document.getElementById('drop-zone-indicator');
        this.debugPanel = document.getElementById('debug-panel');
        this.debugToggle = document.getElementById('debug-toggle');
        this.progressContainer = document.getElementById('progress-container');
        this.progressBar = document.getElementById('progress-bar');
        this.progressText = document.getElementById('progress-text');
        this.exportButton = document.getElementById('export-button');
        this.importButton = document.getElementById('import-button');
        this.confirmationDialog = document.getElementById('confirmation-dialog');
        this.cancelImportButton = document.getElementById('cancel-import');
        this.confirmImportButton = document.getElementById('confirm-import');
        
        // Quick links container
        this.quickLinksContainer = null; // Will be created in setupQuickLinks method
        
        this.draggedElement = null;
        this.resizingElement = null;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.elemOffsetX = 0;
        this.elemOffsetY = 0;
        
        this.initialWidth = 0;
        this.initialHeight = 0;

        this.inboxPanel = document.getElementById('inbox-panel');
this.inboxToggle = document.getElementById('inbox-toggle');
this.inboxDragTarget = null;
        
        // Detect platform
        this.isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

        const styleElement = document.createElement('style');
        styleElement.textContent = `
            #style-panel, #settings-panel {
                z-index: 200; /* Higher than any content z-index */
               
            }
            
            /* Make sure text elements don't appear on top of panels */
            .text-element-container {
                z-index: 100 !important; /* Text elements have z-index 100 */
            }
            
            .image-element-container {
                z-index: 1; /* Base z-index for images - individual images can have 1-99 */
            }
        `;
        document.head.appendChild(styleElement);

         const cmdCursorStyle = document.createElement('style');
    cmdCursorStyle.textContent = `
        body.cmd-pressed .element-container:not(.card-locked) {
            cursor: pointer !important;
        }
        body.cmd-pressed .text-element {
            cursor: text !important;
        }
        body.cmd-pressed .text-display {
            cursor: pointer !important;
        }
    `;
    document.head.appendChild(cmdCursorStyle);

    }

    
    
    hideLoading() {
        OPTIMISM.log('Application loaded');
        this.loadingOverlay.style.display = 'none';
        this.progressContainer.style.display = 'none';
        this.progressText.style.display = 'none';
        this.progressBar.style.width = '0%';
    }
    
    showLoading(message = 'Loading...') {
        this.loadingOverlay.style.display = 'flex';
        document.getElementById('loading-status').textContent = message;
        this.progressContainer.style.display = 'none';
        this.progressText.style.display = 'none';
    }
    
    showProgress(message, percent) {
        this.loadingOverlay.style.display = 'flex';
        document.getElementById('loading-status').textContent = message;
        this.progressContainer.style.display = 'block';
        this.progressText.style.display = 'block';
        this.progressBar.style.width = `${percent}%`;
        this.progressText.textContent = `${percent}%`;
    }
    
    setupEventListeners() {
        OPTIMISM.log('Setting up event listeners');
        
        // Add global modifier key detection
        document.addEventListener('keydown', (e) => {
            // Check if CMD or CTRL key is pressed
            if (e.metaKey || e.ctrlKey) {
                document.body.classList.add('cmd-pressed');
            }
        });
        
        document.addEventListener('keyup', (e) => {
            // Check if CMD or CTRL key is released
            if (e.key === 'Meta' || e.key === 'Control') {
                document.body.classList.remove('cmd-pressed');
            }
        });
        
        // Add a blur handler to handle when the window loses focus
        window.addEventListener('blur', () => {
            document.body.classList.remove('cmd-pressed');
        });

        window.addEventListener('resize', () => {
            if (this.model.isGridVisible) {
                this.renderGrid();
            }
        });
    
        this.setupBackupReminderModal();
        this.setupSettingsPanel();
        this.setupLockImagesToggle();
        this.setupQuickLinks();
        this.setupQuickLinkDragEvents();
        this.setupInboxPanel(); // Set up the inbox panel
        
        // Close style panel when entering inbox link or panel during drag
        this.inboxToggle.addEventListener('mouseenter', (e) => {
            if (this.draggedElement) {
                // If we're dragging, ensure the style panel is hidden
                this.stylePanel.style.display = 'none';
                // Highlight the inbox toggle
                this.inboxToggle.classList.add('drag-highlight');
            }
        });
    
        this.inboxPanel.addEventListener('mouseenter', (e) => {
            if (this.draggedElement) {
                // If we're dragging, ensure the style panel is hidden
                this.stylePanel.style.display = 'none';
                // Highlight the inbox panel and toggle
                this.inboxPanel.classList.add('drag-highlight');
                this.inboxToggle.classList.add('drag-highlight');
            }
        });
        
        // Add Copy Link button
        const copyLinkButton = document.createElement('button');
        copyLinkButton.id = 'copy-link-button';
        copyLinkButton.className = 'nav-link';
        copyLinkButton.textContent = 'Copy Link';
        copyLinkButton.addEventListener('click', () => {
            navigator.clipboard.writeText(window.location.href)
                .then(() => {
                    OPTIMISM.log('URL copied to clipboard');
                })
                .catch(err => {
                    OPTIMISM.logError('Could not copy URL:', err);
                });
        });
        
        // Add the copy link button to the right controls section
        const rightControls = document.getElementById('right-controls');
        if (rightControls) {
            // Add before the first button (or at the start if no buttons)
            if (rightControls.firstChild) {
                rightControls.insertBefore(copyLinkButton, rightControls.firstChild);
            } else {
                rightControls.appendChild(copyLinkButton);
            }
        }
        
        // Workspace double-click to create new elements
        this.workspace.addEventListener('dblclick', (e) => {
            // Ignore if click was on an element or if modifier key is pressed
            if (e.target !== this.workspace || this.isModifierKeyPressed(e)) return;
            
            // Get correct coordinates relative to the workspace
            const rect = this.workspace.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            this.controller.createElement(x, y);
        });
        
        // Single click on workspace should deselect elements
        this.workspace.addEventListener('click', (e) => {
            if (e.target === this.workspace) {
                this.deselectAllElements();
            }
        });
        
        // Global keyboard handlers for deletion and navigation
        document.addEventListener('keydown', (e) => {
            // Delete/Backspace to delete selected element
            if ((e.key === 'Delete' || e.key === 'Backspace') && 
                this.model.selectedElement && 
                document.activeElement.tagName !== 'TEXTAREA') {
                this.controller.deleteElement(this.model.selectedElement);
                e.preventDefault(); // Prevent browser back navigation on backspace
            }
            
            // Up Arrow to navigate back (zoom out) - but not when editing text
            if (e.key === 'ArrowUp' && this.model.navigationStack.length > 1 && 
                document.activeElement.tagName !== 'TEXTAREA') {
                this.controller.navigateBack();
                e.preventDefault();
            }
            
            // Down Arrow to navigate into selected element (zoom in)
            if (e.key === 'ArrowDown' && 
                this.model.selectedElement && 
                this.model.hasChildren(this.model.selectedElement)) {
                this.controller.navigateToElement(this.model.selectedElement);
                e.preventDefault();
            }
            
            // Undo with Ctrl/Cmd+Z
            if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
                this.controller.undo();
                e.preventDefault();
            }
            
            // Redo with Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y
            if (((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey) && e.shiftKey) ||
                ((e.key === 'y' || e.key === 'Y') && (e.ctrlKey || e.metaKey))) {
                this.controller.redo();
                e.preventDefault();
            }

            // Toggle inbox panel with 'I' key
    if (e.key.toLowerCase() === 'i' && 
    document.activeElement.tagName !== 'TEXTAREA' && 
    document.activeElement.tagName !== 'INPUT') {
    e.preventDefault();
    this.controller.toggleInboxVisibility();
}
            
            // Style shortcuts (only when an element is selected and not in edit mode)
            if (this.model.selectedElement && 
                document.activeElement.tagName !== 'TEXTAREA') {
                
                const element = this.model.findElement(this.model.selectedElement);
                
                // Only apply styling to text elements
                if (element && element.type === 'text') {
                    let styleUpdated = false;
                    
                    // 0 = reset to default (small text, black, no header, no highlight, no border)
                    if (e.key === '0') {
                        this.controller.updateElementStyle(this.model.selectedElement, { 
                            textSize: 'small', 
                            textColor: 'default', 
                            hasHeader: false,
                            isHighlighted: false,
                            hasBorder: false
                        });
                        styleUpdated = true;
                        e.preventDefault();
                    }
                    
                    // 1 = small text size
                    else if (e.key === '1') {
                        // Only apply if not already small (small is default)
                        if (element.style && element.style.textSize !== 'small') {
                            this.controller.updateElementStyle(this.model.selectedElement, { textSize: 'small' });
                            styleUpdated = true;
                        }
                        e.preventDefault();
                    }
                    
                    // 2 = large text size
                    else if (e.key === '2') {
                        // Only apply if not already large
                        if (!element.style || element.style.textSize !== 'large') {
                            this.controller.updateElementStyle(this.model.selectedElement, { textSize: 'large' });
                            styleUpdated = true;
                        }
                        e.preventDefault();
                    }
                    
                    // 3 = huge text size
                    else if (e.key === '3') {
                        // Only apply if not already huge
                        if (!element.style || element.style.textSize !== 'huge') {
                            this.controller.updateElementStyle(this.model.selectedElement, { textSize: 'huge' });
                            styleUpdated = true;
                        }
                        e.preventDefault();
                    }
                    
                    // 4 = cycle through text colors (default -> red -> green -> default)
                    else if (e.key === '4') {
                        // Get current color
                        const currentColor = element.style && element.style.textColor ? element.style.textColor : 'default';
                        let nextColor;
                        
                        // Determine next color
                        if (currentColor === 'default') nextColor = 'red';
                        else if (currentColor === 'red') nextColor = 'green';
                        else nextColor = 'default'; // green or any other color goes back to default
                        
                        this.controller.updateElementStyle(this.model.selectedElement, { textColor: nextColor });
                        styleUpdated = true;
                        e.preventDefault();
                    }
                    
                    // 5 = toggle header
                    else if (e.key === '5') {
                        // Toggle current header setting
                        const hasHeader = element.style && element.style.hasHeader ? true : false;
                        this.controller.updateElementStyle(this.model.selectedElement, { hasHeader: !hasHeader });
                        styleUpdated = true;
                        e.preventDefault();
                    }
                    
                    // 6 = toggle highlight
                    else if (e.key === '6') {
                        // Get the current highlight setting
                        const isHighlighted = element.style && element.style.isHighlighted ? true : false;
                        this.controller.updateElementStyle(this.model.selectedElement, { isHighlighted: !isHighlighted });
                        styleUpdated = true;
                        e.preventDefault();
                    }
                    
                    // 7 = toggle border
                    else if (e.key === '7') {
                        // Toggle current border setting
                        const hasBorder = element.style && element.style.hasBorder ? true : false;
                        this.controller.updateElementStyle(this.model.selectedElement, { hasBorder: !hasBorder });
                        styleUpdated = true;
                        e.preventDefault();
                    }

                    // 8 = move to inbox
else if (e.key === '8') {
    // Only if an element is selected
    if (this.model.selectedElement) {
        this.controller.moveToInbox(this.model.selectedElement);
        this.stylePanel.style.display = 'none'; // Hide style panel after moving
        e.preventDefault();
    }
}
                    
                    // 9 = toggle card lock
                    else if (e.key === '9') {
                        // Toggle current lock setting
                        const isLocked = this.model.isCardLocked(this.model.selectedElement);
                        this.controller.updateElementStyle(this.model.selectedElement, { isLocked: !isLocked });
                        styleUpdated = true;
                        e.preventDefault();
                    }
                    
                    // Update style panel if any style changed
                    if (styleUpdated) {
                        // Get the updated element data after the style changes
                        const updatedElement = this.model.findElement(this.model.selectedElement);
                        if (updatedElement) {
                            this.updateStylePanel(updatedElement);
                        }
                    }
                }
            }
        });
        
        // Prevent right-click context menu
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
        
        // Close style panel when clicking outside
        // In setupEventListeners method in view.js, modify the document click handler
document.addEventListener('click', (e) => {
    // If clicking outside of both the style panel and any element
    if (!this.stylePanel.contains(e.target) && 
        !e.target.closest('.element-container') && 
        this.stylePanel.style.display === 'block') {
        this.stylePanel.style.display = 'none';
    }
    
    // Add this new section to close the settings panel
    if (!this.settingsPanel.contains(e.target) && 
        e.target !== this.settingsToggle && 
        this.settingsPanel.style.display === 'block') {
        this.settingsPanel.style.display = 'none';
    }
    
    // Close grid panel when clicking outside
    const gridPanel = document.getElementById('grid-panel');
    const gridToggle = document.getElementById('grid-toggle');
    if (gridPanel && 
        !gridPanel.contains(e.target) && 
        e.target !== gridToggle && 
        gridPanel.style.display === 'block') {
        gridPanel.style.display = 'none';
    }
    
    // Close inbox panel when clicking outside
    if (!this.inboxPanel.contains(e.target) && 
        e.target !== this.inboxToggle && 
        this.inboxPanel.style.display === 'block') {
        this.inboxPanel.style.display = 'none';
        this.model.isInboxVisible = false;
        this.model.saveAppState();
    }
});
        
        // Setup export/import buttons
        this.setupExportImport();
        
        // Setup drag and drop for images
        this.setupImageDropZone();
        
        // Setup debug panel toggle
        this.setupDebugToggle();
        
        OPTIMISM.log('Event listeners set up successfully');
    }
    
    setupExportImport() {
        OPTIMISM.log('Setting up export/import buttons');
        
        // Export button
        this.exportButton.addEventListener('click', () => {
            this.controller.exportData();
        });
        
        // Export without images button
        const exportNoImagesButton = document.getElementById('export-no-images-button');
        if (exportNoImagesButton) {
            exportNoImagesButton.addEventListener('click', () => {
                this.controller.exportDataWithoutImages();
            });
        }
        
        // Import button
        this.importButton.addEventListener('click', () => {
            // Show confirmation dialog
            this.confirmationDialog.style.display = 'block';
        });
        
        // Confirmation dialog buttons
        this.cancelImportButton.addEventListener('click', () => {
            this.confirmationDialog.style.display = 'none';
        });
        
        this.confirmImportButton.addEventListener('click', () => {
            this.confirmationDialog.style.display = 'none';
            
            // Create a file input element
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.json';
            fileInput.style.display = 'none';
            document.body.appendChild(fileInput);
            
            // Handle file selection
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    const file = e.target.files[0];
                    this.controller.importData(file);
                }
                
                // Remove the input element
                document.body.removeChild(fileInput);
            });
            
            // Trigger file selection dialog
            fileInput.click();
        });
        
        OPTIMISM.log('Export/import buttons set up successfully');
    }
    
    setupDebugToggle() {
        OPTIMISM.log('Setting up debug toggle');
        this.debugToggle.addEventListener('click', () => {
            this.controller.toggleDebugPanel();
        });
        OPTIMISM.log('Debug toggle set up successfully');
    }
    
    updateDebugPanelVisibility(isVisible) {
        if (isVisible) {
            this.debugPanel.style.display = 'block';
            this.debugToggle.textContent = 'Hide Debug';
        } else {
            this.debugPanel.style.display = 'none';
            this.debugToggle.textContent = 'Show Debug';
        }
    }
    
    setupImageDropZone() {
        OPTIMISM.log('Setting up image drop zone');
        const dropZoneIndicator = this.dropZoneIndicator;
        
        // Show drop zone when dragging over the document
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
            
            // Check if we are dragging from the inbox
            if (this.inboxDragTarget) {
                dropZoneIndicator.style.display = 'none';
                return;
            }
            
            // Don't show drop zone for internal drags
            if (this.draggedElement) {
                dropZoneIndicator.style.display = 'none';
                return;
            }
            
            // Don't show for quick links
            if (e.dataTransfer.types.includes('application/quicklink')) {
                dropZoneIndicator.style.display = 'none';
                return;
            }
            
            // Show for external files (like images)
            dropZoneIndicator.style.display = 'block';
        });
        
        // Hide drop zone when leaving the document
        document.addEventListener('dragleave', (e) => {
            if (e.relatedTarget === null || e.relatedTarget.nodeName === 'HTML') {
                dropZoneIndicator.style.display = 'none';
            }
        });
        
        // Handle drop events
        document.addEventListener('drop', async (e) => {
            e.preventDefault();
            dropZoneIndicator.style.display = 'none';
            
            // Skip if it's an internal drag operation
            if (this.draggedElement || this.inboxDragTarget) return;
            
            // Get correct coordinates relative to the workspace
            const rect = this.workspace.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            let handled = false;
            
            // First check if we have files (local files)
            if (e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                
                // Only handle image files
                if (file.type.startsWith('image/')) {
                    OPTIMISM.log(`Image file dropped: ${file.name} (${file.type})`);
                    this.showLoading();
                    
                    try {
                        // Process and add the image
                        await this.controller.addImage(file, x, y);
                        handled = true;
                    } catch (error) {
                        OPTIMISM.logError('Error adding image file:', error);
                        alert('Failed to add image file. Please try again.');
                    } finally {
                        this.hideLoading();
                    }
                }
            }
            
            // If already handled a file, don't continue
            if (handled) return;
            
            // Check all available types in the data transfer
            const types = e.dataTransfer.types;
            OPTIMISM.log("Available drop types: " + types.join(", "));
            
            // Look for HTML content first (most likely to contain image data when dragging from a webpage)
            if (types.includes('text/html')) {
                const html = e.dataTransfer.getData('text/html');
                OPTIMISM.log("Received HTML: " + html.substring(0, 100) + "...");
                
                // Look for image tags in the HTML
                const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
                if (imgMatch && imgMatch[1]) {
                    const imgSrc = imgMatch[1];
                    OPTIMISM.log(`Found image source in HTML: ${imgSrc}`);
                    
                    this.showLoading();
                    try {
                        await this.controller.addImageFromUrl(imgSrc, x, y);
                        handled = true;
                    } catch (error) {
                        OPTIMISM.logError('Error adding image from HTML source:', error);
                        // Don't alert here, try other methods
                    } finally {
                        this.hideLoading();
                    }
                }
                
                // Also check for base64 encoded images
                if (!handled) {
                    const base64Match = html.match(/src=["']data:image\/([^;]+);base64,([^"']+)["']/i);
                    if (base64Match) {
                        const imageType = base64Match[1];
                        const base64Data = base64Match[2];
                        
                        OPTIMISM.log(`Base64 image data found of type: ${imageType}`);
                        this.showLoading();
                        
                        try {
                            // Convert base64 to blob
                            const byteString = atob(base64Data);
                            const ab = new ArrayBuffer(byteString.length);
                            const ia = new Uint8Array(ab);
                            
                            for (let i = 0; i < byteString.length; i++) {
                                ia[i] = byteString.charCodeAt(i);
                            }
                            
                            const blob = new Blob([ab], { type: `image/${imageType}` });
                            const file = new File([blob], `image.${imageType}`, { type: `image/${imageType}` });
                            
                            // Add the image
                            await this.controller.addImage(file, x, y);
                            handled = true;
                        } catch (error) {
                            OPTIMISM.logError('Error adding base64 image:', error);
                            // Don't alert yet, try other methods
                        } finally {
                            this.hideLoading();
                        }
                    }
                }
            }
            
            // If not handled yet, check for URL or text containing an image URL
            if (!handled && (types.includes('text/uri-list') || types.includes('text/plain'))) {
                let url = '';
                
                // Try URI list first
                if (types.includes('text/uri-list')) {
                    url = e.dataTransfer.getData('text/uri-list');
                } 
                // If not available, try plain text
                else {
                    url = e.dataTransfer.getData('text/plain');
                }
                
                if (url) {
                    OPTIMISM.log(`Found URL: ${url}`);
                    
                    // Check if URL is for an image file
                    const isImageUrl = url.match(/\.(jpe?g|png|gif|bmp|webp|svg)(\?.*)?$/i);
                    
                    if (isImageUrl) {
                        this.showLoading();
                        try {
                            await this.controller.addImageFromUrl(url, x, y);
                            handled = true;
                        } catch (error) {
                            OPTIMISM.logError('Error adding image from URL:', error);
                        } finally {
                            this.hideLoading();
                        }
                    } else {
                        // Not obviously an image URL, but might be a dynamic image or an image
                        // without a file extension. Try to fetch it anyway.
                        this.showLoading();
                        try {
                            await this.controller.addImageFromUrl(url, x, y);
                            handled = true;
                        } catch (error) {
                            OPTIMISM.logError('URL does not appear to be an image:', error);
                        } finally {
                            this.hideLoading();
                        }
                    }
                }
            }
            
            // If we've tried everything and still couldn't process the drop
            if (!handled) {
                OPTIMISM.log('Could not process dropped content as an image');
                alert('The dropped content could not be processed as an image.');
            }
        });
        
        OPTIMISM.log('Image drop zone set up successfully');
    }
    
    setupUndoRedoButtons() {
        OPTIMISM.log('Setting up undo/redo buttons');
        this.undoButton.addEventListener('click', () => {
            this.controller.undo();
        });
        
        this.redoButton.addEventListener('click', () => {
            this.controller.redo();
        });
        
        // Initially disable buttons
        this.updateUndoRedoButtons();
        OPTIMISM.log('Undo/redo buttons set up successfully');
    }
    
    updateUndoRedoButtons() {
        this.undoButton.disabled = !this.model.canUndo();
        this.redoButton.disabled = !this.model.canRedo();
    }
    
    setupStylePanel() {
        OPTIMISM.log('Setting up style panel');
        
        // Replace the relevant part in setupStylePanel where we add the Move to Inbox option:

// Add the Move to Inbox option to the style panel
const stylePanel = document.getElementById('style-panel');
if (stylePanel) {
    // Check if the option already exists
    if (!document.getElementById('move-to-inbox-option')) {
        const moveToInboxOption = document.createElement('div');
        moveToInboxOption.className = 'style-option';
        moveToInboxOption.id = 'move-to-inbox-option';
        moveToInboxOption.innerHTML = `
            <div class="option-label">
                Move to Inbox
                <span class="shortcut-badges">
                    <span class="shortcut-badge" title="Move to Inbox">8</span>
                </span>
            </div>
            <div class="option-values">
                <a href="#" class="option-value move-to-inbox">Move selected card to Inbox</a>
            </div>
        `;
        
        // Add the option to the panel
        stylePanel.appendChild(moveToInboxOption);
        
        // Add click handler
        const moveToInboxButton = moveToInboxOption.querySelector('.move-to-inbox');
        if (moveToInboxButton) {
            moveToInboxButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation(); // Prevent closing the panel
                
                // Only apply if an element is selected
                if (!this.model.selectedElement) return;
                
                OPTIMISM.log(`Moving selected element ${this.model.selectedElement} to inbox via style panel`);
                
                // Get a reference to the selected element ID before it's moved
                const selectedId = this.model.selectedElement;
                
                // Move the element to inbox
                this.controller.moveToInbox(selectedId);
                
                // Hide the style panel
                this.stylePanel.style.display = 'none';
            });
        }
    }
}
        
        // Get all size option elements
        const sizeOptions = document.querySelectorAll('.option-value[data-size]');
        
        // Add click event listeners to each size option
        sizeOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation(); // Prevent closing the panel
                
                // Only apply if an element is selected
                if (!this.model.selectedElement) return;
                
                // Get the selected size
                const size = option.dataset.size;
                
                // Update the element's style
                this.controller.updateElementStyle(this.model.selectedElement, { textSize: size });
                
                // Update the UI to show which option is selected
                sizeOptions.forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
            });
        });
        
        // Set up color options
        const colorOptions = document.querySelectorAll('.option-value[data-color]');
        
        // Add click event listeners to each color option
        colorOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation(); // Prevent closing the panel
                
                // Only apply if an element is selected
                if (!this.model.selectedElement) return;
                
                // Get the selected color
                const color = option.dataset.color;
                
                // Update the element's style
                this.controller.updateElementStyle(this.model.selectedElement, { textColor: color });
                
                // Update the UI to show which option is selected
                colorOptions.forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
            });
        });
        
        // Set up header option
        const headerOptions = document.querySelectorAll('.option-value[data-header]');
        
        // Add click event listeners to each header option
        headerOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation(); // Prevent closing the panel
                
                // Only apply if an element is selected
                if (!this.model.selectedElement) return;
                
                // Get the selected header setting
                const hasHeader = option.dataset.header === 'true';
                
                // Update the element's style
                this.controller.updateElementStyle(this.model.selectedElement, { hasHeader: hasHeader });
                
                // Update the UI to show which option is selected
                headerOptions.forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
            });
        });
        
        // Set up highlight option
        const highlightOptions = document.querySelectorAll('.option-value[data-highlight]');
        
        // Add click event listeners to each highlight option
        highlightOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation(); // Prevent closing the panel
                
                // Only apply if an element is selected
                if (!this.model.selectedElement) return;
                
                // Get the selected highlight setting
                const isHighlighted = option.dataset.highlight === 'true';
                
                // Update the element's style
                this.controller.updateElementStyle(this.model.selectedElement, { isHighlighted: isHighlighted });
                
                // Update the UI to show which option is selected
                highlightOptions.forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
            });
        });
    
        // Set up border option
        const borderOptions = document.querySelectorAll('.option-value[data-border]');
    
        // Add click event listeners to each border option
        borderOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation(); // Prevent closing the panel
                
                // Only apply if an element is selected
                if (!this.model.selectedElement) return;
                
                // Get the selected border setting
                const hasBorder = option.dataset.border === 'true';
                
                // Update the element's style
                this.controller.updateElementStyle(this.model.selectedElement, { hasBorder: hasBorder });
                
                // Update the UI to show which option is selected
                borderOptions.forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
            });
        });
        
        // Set up card lock option
        const lockOptions = document.querySelectorAll('.option-value[data-lock]');
    
        // Add click event listeners to each lock option
        lockOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation(); // Prevent closing the panel
                
                // Only apply if an element is selected
                if (!this.model.selectedElement) return;
                
                // Get the selected lock setting
                const isLocked = option.dataset.lock === 'true';
                
                // Update the element's style
                this.controller.updateElementStyle(this.model.selectedElement, { isLocked: isLocked });
                
                // Update the UI to show which option is selected
                lockOptions.forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
            });
        });
        
        // Set up reset style option
        const resetOption = document.querySelector('.option-value.reset-style');
        if (resetOption) {
            resetOption.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation(); // Prevent closing the panel
                
                // Only apply if an element is selected
                if (!this.model.selectedElement) return;
                
                // Reset the element's style
                this.controller.updateElementStyle(this.model.selectedElement, { 
                    textSize: 'small', 
                    textColor: 'default', 
                    hasHeader: false,
                    isHighlighted: false
                });
                
                // Update the UI to show which options are selected
                const updatedElement = this.model.findElement(this.model.selectedElement);
                if (updatedElement) {
                    this.updateStylePanel(updatedElement);
                }
            });
        }
        
        OPTIMISM.log('Style panel set up successfully');
    }
    
    setupThemeToggle() {
        OPTIMISM.log('Setting up theme toggle');
        this.themeToggle.addEventListener('click', () => {
            this.controller.toggleTheme();
        });
        OPTIMISM.log('Theme toggle set up successfully');
    }
    
    isModifierKeyPressed(e) {
        return this.isMac ? e.metaKey : e.ctrlKey;
    }
    
    // Modify this method in CanvasView to use the model's imagesLocked state
renderWorkspace() {
    OPTIMISM.log('Rendering workspace');
    // Clear workspace
    this.workspace.innerHTML = '';
    
    // Update breadcrumbs
    this.renderBreadcrumbs();

     // Update quick links
     this.renderQuickLinks();
    
    // Render elements
    if (this.model.currentNode.elements) {
        const elementsCount = this.model.currentNode.elements.length;
        OPTIMISM.log(`Rendering ${elementsCount} element(s)`);
        
        // Sort elements: 1. First by type (images before text)
        // 2. Then by z-index for images
        const sortedElements = [...this.model.currentNode.elements].sort((a, b) => {
            if (a.type === 'image' && b.type === 'text') return -1;
            if (a.type === 'text' && b.type === 'image') return 1;
            if (a.type === 'image' && b.type === 'image') {
                // Higher z-index comes later (on top)
                return (a.zIndex || 1) - (b.zIndex || 1);
            }
            return 0;
        });
        
        sortedElements.forEach(element => {
            try {
                if (element.type === 'text') {
                    this.createTextElementDOM(element);
                } else if (element.type === 'image') {
                    this.createImageElementDOM(element);
                } else {
                    OPTIMISM.logError(`Unknown element type: ${element.type}`);
                }
            } catch (error) {
                OPTIMISM.logError(`Error rendering element ${element.id}:`, error);
            }
        });
    } else {
        OPTIMISM.log('No elements to render');
    }

    // Apply locked state to cards if needed
this.model.lockedCards.forEach(cardId => {
    const container = document.querySelector(`.element-container[data-id="${cardId}"]`);
    if (container) {
        container.classList.add('card-locked');
    }
    if (this.model.isGridVisible) {
        this.renderGrid();
    }
});

// Update styles for locked cards
this.updateLockedCardStyles();

    // Apply locked state to images if needed
    if (this.model.imagesLocked) {
        this.updateImagesLockState();
    }
    
    // Hide style panel when no element is selected
    if (!this.model.selectedElement) {
        this.stylePanel.style.display = 'none';
    }
    
    // Update undo/redo buttons
    this.updateUndoRedoButtons();
    
    // Update page title
    this.updatePageTitle();
    
    OPTIMISM.log('Workspace rendering complete');
}
    
    // In view.js, ensure the updatePageTitle method is correctly implemented
updatePageTitle() {
    if (this.model.navigationStack.length === 1) {
        // At root level, use default title
        document.title = 'OPTIMISM';
    } else {
        // Get the current node title
        const currentNode = this.model.navigationStack[this.model.navigationStack.length - 1];
        let title = currentNode.nodeTitle || 'Untitled';
        
        // Truncate to 20 characters if needed
        if (title.length > 20) {
            title = title.substring(0, 20) + '...';
        }
        
        document.title = title;
    }
}
    
    renderBreadcrumbs() {
        OPTIMISM.log('Rendering breadcrumbs');
        this.breadcrumbContainer.innerHTML = '';
        
        // Create breadcrumb elements - only show navigable ones
        for (let i = 0; i < this.model.navigationStack.length - 1; i++) {
            const navItem = this.model.navigationStack[i];
            
            // Create breadcrumb item
            const breadcrumb = document.createElement('span');
            breadcrumb.className = 'breadcrumb-item';
            breadcrumb.style.textDecoration = 'underline';
            breadcrumb.style.cursor = 'pointer';
            breadcrumb.dataset.index = i; // Add index attribute for drag and drop
            
            const title = i === 0 ? 'Home' : (navItem.nodeTitle || 'Untitled');
            breadcrumb.textContent = title.length > 10 ? 
                title.substring(0, 10) + '...' : title;
            breadcrumb.title = title; // Full title on hover
            
            breadcrumb.addEventListener('click', () => {
                this.controller.navigateToIndex(i);
            });
            
            this.breadcrumbContainer.appendChild(breadcrumb);
            
            // Add separator
            const separator = document.createElement('span');
            separator.className = 'breadcrumb-separator';
            separator.textContent = '➔';
            this.breadcrumbContainer.appendChild(separator);
        }
        
        // Add current (last) item without link styling
        if (this.model.navigationStack.length > 0) {
            const currentItem = this.model.navigationStack[this.model.navigationStack.length - 1];
            const currentBreadcrumb = document.createElement('span');
            currentBreadcrumb.className = 'breadcrumb-item';
            currentBreadcrumb.style.textDecoration = 'none';
            // We don't need to add dataset.index for the current level since we won't drop onto it
            
            const title = this.model.navigationStack.length === 1 ? 
                'Home' : (currentItem.nodeTitle || 'Untitled');
                
            currentBreadcrumb.textContent = title.length > 10 ? 
                title.substring(0, 10) + '...' : title;
            currentBreadcrumb.title = title;
            
            this.breadcrumbContainer.appendChild(currentBreadcrumb);
        }
        
        OPTIMISM.log('Breadcrumbs rendered successfully');
    }
    
    // Format text with header if needed
    formatTextWithHeader(text, hasHeader, isHighlighted = false) {
        if (!text || !hasHeader) return this.convertUrlsToLinks(text || '', isHighlighted);
        
        const lines = text.split('\n');
        if (lines.length === 0) return '';
        
        // Extract first line as header
        const headerLine = lines[0];
        const restOfText = lines.slice(1).join('\n');
        
        let formattedHeader = this.convertUrlsToLinks(headerLine, isHighlighted);
        let formattedText = this.convertUrlsToLinks(restOfText, isHighlighted);
        
        return `<span class="first-line">${formattedHeader}</span>${formattedText}`;
    }
    
    // In view.js, update the convertUrlsToLinks method
convertUrlsToLinks(text, isHighlighted = false) {
    if (!text) return '';
    
    // Escape HTML characters to prevent XSS
    let safeText = text.replace(/[&<>"']/g, function(match) {
        switch (match) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '"': return '&quot;';
            case "'": return '&#39;';
            default: return match;
        }
    });
    
    // Replace newlines with <br> tags
    safeText = safeText.replace(/\n/g, '<br>');
    
    // Process the text to find and replace URLs with proper anchor tags
    let result = '';
    let lastIndex = 0;
    
    // Updated regex to handle file URLs with encoded spaces (%20), email addresses, and hash symbols
    const urlRegex = /(\bfile:\/\/\/[a-z0-9\-._~:/?#[\]@!$&'()*+,;=%\\\s]+[a-z0-9\-_~:/[\]@!$&'()*+,;=%\\#]|\bhttps?:\/\/[a-z0-9\-._~:/?#[\]@!$&'()*+,;=]+[a-z0-9\-_~:/[\]@!$&'()*+,;=]|\bwww\.[a-z0-9\-._~:/?#[\]@!$&'()*+,;=]+[a-z0-9\-_~:/[\]@!$&'()*+,;=])/gi;
    
    let match;
    while ((match = urlRegex.exec(safeText)) !== null) {
        // Add text before the URL
        result += safeText.substring(lastIndex, match.index);
        
        // Get the URL
        let url = match[0];
        
        // Different handling for different URL types
        if (url.toLowerCase().startsWith('file:///')) {
            // For file URLs, keep everything including hash
            // But remove trailing punctuation except when part of valid characters
            url = url.replace(/[.,;:!?)]+$/, '');
        } else {
            // For other URLs, remove any trailing punctuation that shouldn't be part of the URL
            url = url.replace(/[.,;:!?)]+$/, '');
        }
        
        // Create the proper href attribute
        let href = url;
        if (url.toLowerCase().startsWith('www.')) {
            href = 'https://' + url;
        }
        
        // Add the anchor tag
        result += `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`;
        
        // Update lastIndex to end of current match
        lastIndex = match.index + url.length;
        
        // Adjust the regex lastIndex if we modified the URL
        if (url.length !== match[0].length) {
            urlRegex.lastIndex = lastIndex;
        }
    }
    
    // Add any remaining text after the last URL
    result += safeText.substring(lastIndex);
    
    // Apply highlighting if needed
    if (isHighlighted) {
        result = `<mark>${result}</mark>`;
    }
    
    return result;
}
    
createTextElementDOM(elementData) {
    OPTIMISM.log(`Creating text element DOM for ${elementData.id}`);
    
    // Create container for the element
    const container = document.createElement('div');
    container.className = 'element-container text-element-container';
    container.dataset.id = elementData.id;
    container.dataset.type = 'text';
    container.style.left = `${elementData.x}px`;
    container.style.top = `${elementData.y}px`;
    container.dataset.numX = parseFloat(elementData.x);
    container.dataset.numY = parseFloat(elementData.y);
    
    // Check if this element has children
    const hasChildren = this.model.hasChildren(elementData.id);
    
    // Set dimensions if they exist in the data
    if (elementData.width) {
        container.style.width = `${elementData.width}px`;
    } else {
        container.style.width = `200px`; // Default width
    }
    
    if (elementData.height) {
        container.style.height = `${elementData.height}px`;
    } else {
        container.style.height = `100px`; // Default height
    }
    
    // Apply border if defined
    if (elementData.style && elementData.style.hasBorder) {
        container.classList.add('has-permanent-border');
    }
    
    // Check if this card is locked - ADD THIS HERE
    if (this.model.isCardLocked(elementData.id)) {
        container.classList.add('card-locked');
    }
    
    // Create the text editor (hidden by default)
    const textEditor = document.createElement('textarea');
    textEditor.className = 'text-element';
    // ... rest of the method continues
    if (hasChildren) {
        textEditor.classList.add('has-children');
    }
    textEditor.value = elementData.text || '';
    textEditor.style.display = 'none'; // Hide by default
    
    // Apply highlight directly to textarea background if needed
    if (elementData.style && elementData.style.isHighlighted) {
        textEditor.style.backgroundColor = 'rgb(255, 255, 176)';
    }
    
    // Create the text display (shown by default)
    const textDisplay = document.createElement('div');
    textDisplay.className = 'text-display';
    if (hasChildren) {
        textDisplay.classList.add('has-children');
    }
    
    // Apply header formatting if set
    const hasHeader = elementData.style && elementData.style.hasHeader;
    const isHighlighted = elementData.style && elementData.style.isHighlighted;

    if (hasHeader) {
        textDisplay.classList.add('has-header');
        textDisplay.innerHTML = this.formatTextWithHeader(elementData.text || '', true, isHighlighted);
    } else {
        textDisplay.innerHTML = this.convertUrlsToLinks(elementData.text || '', isHighlighted);
    }
    
    // Apply text size if defined
    if (elementData.style && elementData.style.textSize) {
        if (elementData.style.textSize === 'large') {
            textEditor.classList.add('size-large');
            textDisplay.classList.add('size-large');
        } else if (elementData.style.textSize === 'huge') {
            textEditor.classList.add('size-huge');
            textDisplay.classList.add('size-huge');
        }
    }
    
    // Apply text color if defined
    if (elementData.style && elementData.style.textColor) {
        textEditor.classList.add(`color-${elementData.style.textColor}`);
        textDisplay.classList.add(`color-${elementData.style.textColor}`);
    }

    // Apply highlight if defined
    if (elementData.style && elementData.style.isHighlighted) {
        textEditor.classList.add('is-highlighted');
        textDisplay.classList.add('is-highlighted');
    }
    
    // Create resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    
    // Setup content listeners
    textEditor.addEventListener('input', () => {
        // We don't immediately update the model on every keystroke anymore
        // Just update display for immediate feedback if needed
    });

    textEditor.addEventListener('mousedown', (e) => {
        // Stop propagation to prevent the container's mousedown handler from firing
        e.stopPropagation();
    });
    
    textEditor.addEventListener('click', (e) => {
        // Stop propagation to prevent the container's click handler from firing
        e.stopPropagation();
    });
    
    textEditor.addEventListener('input', () => {
        // We don't immediately update the model on every keystroke anymore
        // Just update display for immediate feedback if needed
    });
    
    // In view.js, modify the blur event handler in the createTextElementDOM method
// In view.js, modify the blur event handler in the createTextElementDOM method
textEditor.addEventListener('blur', () => {
    // Get the original element's text before any changes
    const element = this.model.findElement(elementData.id);
    const originalText = element ? element.text : '';
    const newText = textEditor.value;
    
    // Check if text is now empty (including whitespace-only)
    if (newText.trim() === '') {
        // The text is empty, delete the element
        this.controller.deleteElement(elementData.id);
        return; // Don't continue since the element is deleted
    }
    
    // Only create an undo command if the text actually changed
    if (originalText !== newText) {
        this.controller.updateElementWithUndo(elementData.id, {
            text: newText
        }, {
            text: originalText
        });
    }
    
    // Don't process if element was deleted due to empty text
    if (!this.model.findElement(elementData.id)) {
        return;
    }
    
    // Update display content with converted links and header format if needed
    const updatedElement = this.model.findElement(elementData.id);
    const hasHeader = updatedElement.style && updatedElement.style.hasHeader;
    const isHighlighted = updatedElement.style && updatedElement.style.isHighlighted;
    
    if (hasHeader) {
        textDisplay.innerHTML = this.formatTextWithHeader(textEditor.value, true, isHighlighted);
    } else {
        textDisplay.innerHTML = this.convertUrlsToLinks(textEditor.value, isHighlighted);
    }
    
    // Toggle visibility
    textEditor.style.display = 'none';
    textDisplay.style.display = 'block';
});

    // Handle link clicks within the display div
    textDisplay.addEventListener('click', (e) => {
        // Check if we clicked on a link
        if (e.target.tagName === 'A') {
            e.stopPropagation(); // Don't bubble up to select the container
            return true; // Allow default link behavior
        }
    });
    
    // This is the click handler for text elements:
    container.addEventListener('click', (e) => {
        // If CMD/CTRL is pressed, navigate into the element regardless of lock state
        if (this.isModifierKeyPressed(e)) {
            this.controller.navigateToElement(elementData.id);
            e.stopPropagation();
            return;
        }
        
        // Don't select if images are locked and this is an image
        if (this.model.imagesLocked && elementData.type === 'image') {
            return;
        }
        
        this.selectElement(container, elementData);
    });
    
    // Handle double-click to edit text
    container.addEventListener('dblclick', (e) => {
        // Don't handle dblclicks on links
        if (e.target.tagName === 'A') return;
        
        // Switch to edit mode
        textDisplay.style.display = 'none';
        textEditor.style.display = 'block';
        textEditor.focus();
        e.stopPropagation(); // Prevent creating a new element
    });
    
    // For both text and image element containers:
    container.addEventListener('mousedown', (e) => {
        // Don't handle if card is locked
        if (this.model.isCardLocked(elementData.id)) return;
        
        // Don't handle if not left mouse button
        if (e.button !== 0) return;
        
        // Don't start drag when on resize handle
        if (e.target === resizeHandle) return;
        
        // Select the element but don't show style panel while dragging
        this.selectElement(container, elementData, true); // Pass true to indicate we're dragging
        
        this.draggedElement = container;
        this.model.selectedElement = elementData.id;
        
        // Store original position for potential snap back
        container.dataset.originalLeft = container.style.left;
        container.dataset.originalTop = container.style.top;
        
        // Get current numerical position values
        const currentX = parseFloat(container.dataset.numX) || parseFloat(container.style.left);
        const currentY = parseFloat(container.dataset.numY) || parseFloat(container.style.top);
        
        // Calculate the offset from the current position
        this.elemOffsetX = e.clientX - currentX;
        this.elemOffsetY = e.clientY - currentY;
        
        container.classList.add('dragging');
        e.preventDefault();
    });
    
    resizeHandle.addEventListener('mousedown', (e) => {
        // Don't check image lock status for text elements
        // Text elements should always be resizable regardless of image lock
        
        e.stopPropagation(); // Prevent other mouse handlers
        
        this.selectElement(container, elementData);
        this.resizingElement = container;
        
        // Save initial dimensions
        this.initialWidth = container.offsetWidth;
        this.initialHeight = container.offsetHeight;
        
        // Save initial mouse position
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        
        e.preventDefault();
    });
    
    // Append all elements to the container
    container.appendChild(textEditor);
    container.appendChild(textDisplay);
    container.appendChild(resizeHandle);
    
    // Add to workspace
    this.workspace.appendChild(container);
    return container;
}
    
async createImageElementDOM(elementData) {
    OPTIMISM.log(`Creating image element DOM for ${elementData.id}`);
    
    // Create container for the element
    const container = document.createElement('div');
    container.className = 'element-container image-element-container';
    container.dataset.id = elementData.id;
    container.dataset.type = 'image';
    container.style.left = `${elementData.x}px`;
    container.style.top = `${elementData.y}px`;
    container.dataset.numX = parseFloat(elementData.x);
    container.dataset.numY = parseFloat(elementData.y);
    
    // Check if this element has children
    const hasChildren = this.model.hasChildren(elementData.id);
    if (hasChildren) {
        container.classList.add('has-children');
    }
    
    // Set dimensions if they exist in the data
    if (elementData.width) {
        container.style.width = `${elementData.width}px`;
    }
    
    if (elementData.height) {
        container.style.height = `${elementData.height}px`;
    }
    
    if (elementData.zIndex) {
        // Ensure z-index stays below text elements
        container.style.zIndex = Math.min(parseInt(elementData.zIndex), 99);
    } else {
        container.style.zIndex = '1'; // Default z-index for images
    }
    
    // Check if this card is locked - ADD THIS HERE
    if (this.model.isCardLocked(elementData.id)) {
        container.classList.add('card-locked');
    }
    
    // Create the image element
    const imageElement = document.createElement('img');
    // ... rest of the method continues
    imageElement.className = 'image-element';
    // Make the image take up the full container size while maintaining aspect ratio
    imageElement.style.width = '100%';
    imageElement.style.height = '100%';
    imageElement.style.objectFit = 'contain';
    
    // Load image data
    try {
        OPTIMISM.log(`Loading image data for ${elementData.imageDataId}`);
        const imageData = await this.model.getImageData(elementData.imageDataId);
        if (imageData) {
            imageElement.src = imageData;
            OPTIMISM.log('Image data loaded successfully');
        } else {
            OPTIMISM.logError(`Image data not found for ${elementData.imageDataId}`);
            imageElement.alt = 'Image could not be loaded';
        }
    } catch (error) {
        OPTIMISM.logError('Error loading image data:', error);
        imageElement.alt = 'Error loading image';
    }
    
    // Create resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    
    // This is the click handler for image elements:
    container.addEventListener('click', (e) => {
        // If CMD/CTRL is pressed, navigate into the element regardless of lock state
        if (this.isModifierKeyPressed(e)) {
            this.controller.navigateToElement(elementData.id);
            e.stopPropagation();
            return;
        }
        
        // Don't select if images are locked
        if (this.model.imagesLocked) {
            return;
        }
        
        this.selectElement(container, elementData);
    });
    
    // For both text and image element containers:
    container.addEventListener('mousedown', (e) => {
        // Don't handle if card is locked
        if (this.model.isCardLocked(elementData.id)) return;
        
        // Don't handle if not left mouse button
        if (e.button !== 0) return;
        
        // Don't start drag when on resize handle
        if (e.target === resizeHandle) return;
        
        // Select the element but don't show style panel while dragging
        this.selectElement(container, elementData, true); // Pass true to indicate we're dragging
        
        this.draggedElement = container;
        this.model.selectedElement = elementData.id;
        
        // Store original position for potential snap back
        container.dataset.originalLeft = container.style.left;
        container.dataset.originalTop = container.style.top;
        
        // Get current numerical position values
        const currentX = parseFloat(container.dataset.numX) || parseFloat(container.style.left);
        const currentY = parseFloat(container.dataset.numY) || parseFloat(container.style.top);
        
        // Calculate the offset from the current position
        this.elemOffsetX = e.clientX - currentX;
        this.elemOffsetY = e.clientY - currentY;
        
        container.classList.add('dragging');
        e.preventDefault();
    });
    
    // Updated resize handle event listener
    resizeHandle.addEventListener('mousedown', (e) => {
        // Don't allow resizing for images if images are locked
        // For text elements, always allow resizing regardless of lock state
        if (this.model.imagesLocked && elementData.type === 'image') return;
        
        e.stopPropagation(); // Prevent other mouse handlers
        
        this.selectElement(container, elementData);
        this.resizingElement = container;
        
        // Save initial dimensions
        this.initialWidth = container.offsetWidth;
        this.initialHeight = container.offsetHeight;
        
        // Save initial mouse position
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        
        e.preventDefault();
    });
    
    // Append all elements to the container
    container.appendChild(imageElement);
    container.appendChild(resizeHandle);
    
    // Add to workspace
    this.workspace.appendChild(container);
    return container;
}
    
// In view.js, update the selectElement method to hide the grid panel
selectElement(element, elementData, isDragging = false) {
    // Check if this is an image and images are locked
    if (elementData.type === 'image' && this.model.imagesLocked) {
        OPTIMISM.log(`Cannot select locked image ${elementData.id}`);
        return;
    }
    
    OPTIMISM.log(`Selecting element ${elementData.id} of type ${elementData.type}`);
    this.deselectAllElements();
    element.classList.add('selected');
    this.model.selectedElement = element.dataset.id;
    
    // Close settings panel and grid panel
    this.settingsPanel.style.display = 'none';
    
    // Hide grid panel
    const gridPanel = document.getElementById('grid-panel');
    if (gridPanel) {
        gridPanel.style.display = 'none';
    }
    
    // Only show style panel if we're not dragging
    if (element.dataset.type === 'text' && !isDragging) {
        this.stylePanel.style.display = 'block';
        
        // Update the selected option in the style panel
        this.updateStylePanel(elementData);
    } else {
        this.stylePanel.style.display = 'none';
    }
}
    
    updateStylePanel(elementData) {
        // Only update style panel for text elements
        if (elementData.type !== 'text') return;
        
        OPTIMISM.log('Updating style panel');
        
        // Reset all selected options
        document.querySelectorAll('.option-value').forEach(opt => opt.classList.remove('selected'));
        
        // Set the correct text size option as selected
        let selectedSize = 'small'; // Default
        if (elementData.style && elementData.style.textSize) {
            selectedSize = elementData.style.textSize;
        }
        
        const sizeOption = document.querySelector(`.option-value[data-size="${selectedSize}"]`);
        if (sizeOption) {
            sizeOption.classList.add('selected');
        }
        
        // Set the correct text color option as selected
        let selectedColor = 'default'; // Default
        if (elementData.style && elementData.style.textColor) {
            selectedColor = elementData.style.textColor;
        }
        
        const colorOption = document.querySelector(`.option-value[data-color="${selectedColor}"]`);
        if (colorOption) {
            colorOption.classList.add('selected');
        }
        
        // Set the correct header option as selected
        const hasHeader = elementData.style && elementData.style.hasHeader ? 'true' : 'false';
        const headerOption = document.querySelector(`.option-value[data-header="${hasHeader}"]`);
        if (headerOption) {
            headerOption.classList.add('selected');
        }
    
        // Set the correct highlight option as selected
        const isHighlighted = elementData.style && elementData.style.isHighlighted ? 'true' : 'false';
        const highlightOption = document.querySelector(`.option-value[data-highlight="${isHighlighted}"]`);
        if (highlightOption) {
            highlightOption.classList.add('selected');
        }
        
        // Set the correct border option as selected
        const hasBorder = elementData.style && elementData.style.hasBorder ? 'true' : 'false';
        const borderOption = document.querySelector(`.option-value[data-border="${hasBorder}"]`);
        if (borderOption) {
            borderOption.classList.add('selected');
        }
// Set the correct lock option as selected
const isLocked = this.model.isCardLocked(elementData.id) ? 'true' : 'false';
const lockOption = document.querySelector(`.option-value[data-lock="${isLocked}"]`);
if (lockOption) {
    lockOption.classList.add('selected');
}

    }

    
    
    deselectAllElements() {
        document.querySelectorAll('.element-container.selected').forEach(el => {
            el.classList.remove('selected');
        });
        this.model.selectedElement = null;
    }
    
    // In view.js - full method with changes
    setupDragListeners() {
        OPTIMISM.log('Setting up drag listeners');
        
        // Add workspace drop handler for inbox cards
        this.workspace.addEventListener('dragover', (e) => {
            e.preventDefault();
            
            // If we're dragging from inbox, add a subtle visual indicator
            if (this.isDraggingFromInbox) {
                // Hide image drop zone
                if (this.dropZoneIndicator) {
                    this.dropZoneIndicator.style.display = 'none';
                }
                
                // We could add a custom visual indicator here if desired
            }
        });
        
        this.workspace.addEventListener('drop', (e) => {
            e.preventDefault();
            
            OPTIMISM.log('Drop event on workspace');
            
            // Handle drops from inbox to canvas
            if (this.isDraggingFromInbox) {
                const cardId = e.dataTransfer.getData('text/plain');
                if (cardId) {
                    // Get position relative to workspace
                    const rect = this.workspace.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    
                    OPTIMISM.log(`Moving inbox card ${cardId} to canvas at position (${x}, ${y})`);
                    this.controller.moveFromInboxToCanvas(cardId, x, y);
                    
                    // Reset drag state
                    this.isDraggingFromInbox = false;
                    
                    // Ensure drop zone indicator is hidden
                    if (this.dropZoneIndicator) {
                        this.dropZoneIndicator.style.display = 'none';
                    }
                    
                    // Stop propagation to prevent other handlers
                    e.stopPropagation();
                }
            }
        });

    // Add this inside setupDragListeners in view.js (before or after existing code)
// This will ensure we properly remove quick links when dragged off
document.addEventListener('drop', (e) => {
    const navControls = document.getElementById('nav-controls');
    if (e.dataTransfer && e.dataTransfer.types.includes('application/quicklink')) {
        e.preventDefault();
        
        const nodeId = e.dataTransfer.getData('application/quicklink');
        const navRect = navControls.getBoundingClientRect();
        
        if (nodeId && (e.clientX < navRect.left || e.clientX > navRect.right ||
                        e.clientY < navRect.top || e.clientY > navRect.bottom)) {
            OPTIMISM.log(`Removing quick link ${nodeId} (dropped outside navbar)`);
            this.controller.removeQuickLink(nodeId);
        }
    }
});
    
    // Add drag events to nav-controls for quick link addition
    const navControls = document.getElementById('nav-controls');
    
    navControls.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Check if we're dragging an element from the workspace
        if (this.draggedElement) {
            // Only highlight if not over a breadcrumb (which has its own drop behavior)
            const breadcrumbTarget = this.findBreadcrumbDropTarget(e);
            if (!breadcrumbTarget) {
                navControls.classList.add('nav-drag-highlight');
            }
        }
        
        // Allow dropping of quick links for removal
        const quickLinkBeing = e.dataTransfer && e.dataTransfer.types.includes('text/plain');
        if (quickLinkBeing && !navControls.contains(e.target)) {
            const linkElement = e.target.closest('.quick-link');
            if (linkElement) {
                linkElement.classList.add('drag-over');
            }
        }
    });
    
    navControls.addEventListener('dragleave', (e) => {
        e.preventDefault();
        
        // Check if leaving the nav controls entirely
        if (!navControls.contains(e.relatedTarget)) {
            navControls.classList.remove('nav-drag-highlight');
        }
        
        // Clear highlight on links
        document.querySelectorAll('.quick-link.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });
    });
    
    navControls.addEventListener('drop', (e) => {
        e.preventDefault();
        navControls.classList.remove('nav-drag-highlight');
        
        // If dragging from the workspace to the nav bar (not over a breadcrumb)
        if (this.draggedElement) {
            const breadcrumbTarget = this.findBreadcrumbDropTarget(e);
            if (!breadcrumbTarget) {
                // Add as a quick link if it's in the nav area
                const draggedId = this.draggedElement.dataset.id;
                const element = this.model.findElement(draggedId);
                
                if (element) {
                    let title = "Untitled";
                    if (element.type === 'text' && element.text) {
                        title = element.text.substring(0, 60);
                    } else if (element.type === 'image') {
                        title = "Image";
                    }
                    
                    OPTIMISM.log(`Adding ${draggedId} (${title}) as quick link`);
                    this.controller.addQuickLink(draggedId, title);
                }
            }
        } else if (e.dataTransfer && e.dataTransfer.types.includes('text/plain')) {
            // Handle dropping a quick link outside the nav bar for removal
            const nodeId = e.dataTransfer.getData('text/plain');
            if (nodeId && !navControls.contains(e.target)) {
                OPTIMISM.log(`Removing quick link ${nodeId}`);
                this.controller.removeQuickLink(nodeId);
            }
        }
        
        // Clear all drag highlights
        document.querySelectorAll('.quick-link.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });
    });
    
    document.addEventListener('mousemove', (e) => {
        // Handle resizing
        if (this.resizingElement) {
            // Get element type
            const elementType = this.resizingElement.dataset.type;
            
            // Don't resize images if they're locked
            if (this.model.imagesLocked && elementType === 'image') {
                return;
            }
            
            // Calculate size delta
            const deltaWidth = e.clientX - this.dragStartX;
            const deltaHeight = e.clientY - this.dragStartY;
            
            // Apply new dimensions with constraints based on element type
            let newWidth, newHeight;
            
            if (elementType === 'image') {
                // For images, limit max size to 600px while maintaining aspect ratio
                const aspectRatio = this.initialHeight / this.initialWidth;
                
                // Calculate new dimensions without enforcing aspect ratio yet
                newWidth = Math.max(50, this.initialWidth + deltaWidth);
                newHeight = Math.max(50, this.initialHeight + deltaHeight);
                
                // Now enforce the 600px max dimension
                if (newWidth > newHeight) {
                    // Width is longest dimension
                    if (newWidth > 600) {
                        newWidth = 600;
                        newHeight = Math.round(newWidth * aspectRatio);
                    }
                } else {
                    // Height is longest dimension
                    if (newHeight > 600) {
                        newHeight = 600;
                        newWidth = Math.round(newHeight / aspectRatio);
                    }
                }
            } else {
                // For text elements, use original constraints
                newWidth = Math.max(100, this.initialWidth + deltaWidth);
                newHeight = Math.max(30, this.initialHeight + deltaHeight);
            }
            
            this.resizingElement.style.width = `${newWidth}px`;
            this.resizingElement.style.height = `${newHeight}px`;
            
            return;
        }
        
        // Handle dragging
// Modify the mousemove event handler in setupDragListeners method in view.js
// Find the section handling dragging in document.addEventListener('mousemove', (e) => {...})

// Replace or modify the dragging section to add snapping:
// Handle dragging
if (!this.draggedElement) return;

// Don't drag images if they're locked
if (this.model.imagesLocked && this.draggedElement.dataset.type === 'image') {
    return;
}

// Calculate new position
let newX = e.clientX - this.elemOffsetX;
let newY = e.clientY - this.elemOffsetY;

// Check for grid snapping if grid is visible
if (this.model.isGridVisible) {
    // Get grid lines
    const gridContainer = document.getElementById('grid-container');
    if (gridContainer) {
        const vertLines = gridContainer.querySelectorAll('.grid-line-vertical');
        const horzLines = gridContainer.querySelectorAll('.grid-line-horizontal');
        
        // Check for vertical line snapping
        vertLines.forEach(line => {
            const lineX = parseInt(line.style.left);
            // If within 10px of the line, snap to it
            if (Math.abs(newX - lineX) < 10) {
                newX = lineX;
            }
        });
        
        // Check for horizontal line snapping
        horzLines.forEach(line => {
            const lineY = parseInt(line.style.top);
            // If within 10px of the line, snap to it
            if (Math.abs(newY - lineY) < 10) {
                newY = lineY;
            }
        });
    }
}

// Update both style and dataset for consistency
this.draggedElement.style.left = `${newX}px`;
this.draggedElement.style.top = `${newY}px`;
this.draggedElement.dataset.numX = newX;
this.draggedElement.dataset.numY = newY;

// Highlight potential drop targets
this.handleDragOver(e);
    });
    
    // In view.js - partial update to the mouseup event handler in setupDragListeners
document.addEventListener('mouseup', (e) => {
    // Handle end of resizing
    if (this.resizingElement) {
        // Get element type
        const elementType = this.resizingElement.dataset.type;
        
        // Don't update locked images
        if (this.model.imagesLocked && elementType === 'image') {
            this.resizingElement = null;
            return;
        }
        
        const id = this.resizingElement.dataset.id;
        const width = parseFloat(this.resizingElement.style.width);
        const height = parseFloat(this.resizingElement.style.height);
        
        OPTIMISM.log(`Resize complete for element ${id}: ${width}x${height}`);
        this.controller.updateElement(id, { width, height });
        
        this.resizingElement = null;
        return;
    }
    
    // Handle end of dragging
    if (!this.draggedElement) return;
    
    // Don't update locked images
    if (this.model.imagesLocked && this.draggedElement.dataset.type === 'image') {
        this.draggedElement.classList.remove('dragging');
        this.draggedElement = null;
        
        // Remove highlights
        const highlighted = document.querySelectorAll('.drag-over');
        highlighted.forEach(el => el.classList.remove('drag-over'));
        return;
    }
    
    const draggedId = this.draggedElement.dataset.id;
    
    // Check if this is an image element
    const isImage = this.draggedElement.dataset.type === 'image';
    
    // If this is an image, bring it to front of other images
    if (isImage) {
        const newZIndex = this.findHighestImageZIndex() + 1;
        // Make sure we don't exceed our maximum for images
        const cappedZIndex = Math.min(newZIndex, 99);
        this.draggedElement.style.zIndex = cappedZIndex;
    }
    
    // First check if dragged over a breadcrumb
    const breadcrumbTarget = this.findBreadcrumbDropTarget(e);
    if (breadcrumbTarget) {
        const navIndex = parseInt(breadcrumbTarget.dataset.index);
        
        OPTIMISM.log(`Element ${draggedId} dropped onto breadcrumb at index ${navIndex}`);
        
        // Deselect all elements before moving
        this.deselectAllElements();
        
        // Move the element to the target navigation level
        this.controller.moveElementToBreadcrumb(draggedId, navIndex);
    } 
    // If not on a breadcrumb, check if dragged over the quick links area to create a bookmark
    else if (this.isOverQuickLinksArea(e)) {
        // Add as a quick link
        const element = this.model.findElement(draggedId);
        
        if (element) {
            let title = "Untitled";
            if (element.type === 'text' && element.text) {
                title = element.text.substring(0, 60);
            } else if (element.type === 'image') {
                title = "Image";
            }
            
            OPTIMISM.log(`Adding ${draggedId} (${title}) as quick link`);
            this.controller.addQuickLink(draggedId, title);
            
            // Snap back to the original position
            if (this.draggedElement.dataset.originalLeft && this.draggedElement.dataset.originalTop) {
                this.draggedElement.style.left = this.draggedElement.dataset.originalLeft;
                this.draggedElement.style.top = this.draggedElement.dataset.originalTop;
                OPTIMISM.log(`Snapping card back to original position`);
            }
        }
    }
    // If not on a breadcrumb or for a quick link, check if dragged over another element
    else {
        const dropTarget = this.findDropTarget(e);
        if (dropTarget && dropTarget !== this.draggedElement) {
            const targetId = dropTarget.dataset.id;
            
            OPTIMISM.log(`Element ${draggedId} dropped onto ${targetId}`);
            
            // Deselect all elements before moving
            this.deselectAllElements();
            
            this.controller.moveElement(draggedId, targetId);
        } else {
            // Not dropped on any target, just update position
            const newX = parseFloat(this.draggedElement.style.left);
            const newY = parseFloat(this.draggedElement.style.top);
            
            OPTIMISM.log(`Element ${draggedId} moved to position (${newX}, ${newY})`);
            
            // If it's an image, also update z-index
            if (isImage) {
                this.controller.updateElement(draggedId, { 
                    x: newX, 
                    y: newY,
                    zIndex: parseInt(this.draggedElement.style.zIndex) || 1
                });
            } else {
                this.controller.updateElement(draggedId, { x: newX, y: newY });
            }
        }
    }
    
    // Reset drag state
    this.draggedElement.classList.remove('dragging');
    this.draggedElement = null;
    
    // Remove highlights
    const highlighted = document.querySelectorAll('.drag-over');
    highlighted.forEach(el => el.classList.remove('drag-over'));
    
    // Remove nav controls highlight
    document.getElementById('nav-controls').classList.remove('nav-drag-highlight');
});
    
    OPTIMISM.log('Drag listeners set up successfully');
}
    
    
handleDragOver(e) {
    // Remove previous highlights - remove both highlight classes
    const highlighted = document.querySelectorAll('.drag-highlight, .drag-over');
    highlighted.forEach(el => {
        el.classList.remove('drag-highlight');
        el.classList.remove('drag-over');
    });
    
    // First check for breadcrumb targets
    const breadcrumbTarget = this.findBreadcrumbDropTarget(e);
    if (breadcrumbTarget) {
        // Add green text highlight class
        breadcrumbTarget.classList.add('drag-highlight');
        return;
    }
    
    // Check if dragging over the quick links area
    if (this.isOverQuickLinksArea(e)) {
        // Highlight the quick links by turning them green
        if (this.quickLinksContainer) {
            // Highlight placeholder if no links
            const placeholder = this.quickLinksContainer.querySelector('.quick-link-placeholder');
            if (placeholder) {
                placeholder.classList.add('drag-highlight');
            } else {
                // Highlight all quick links
                const quickLinks = this.quickLinksContainer.querySelectorAll('.quick-link');
                quickLinks.forEach(link => {
                    link.classList.add('drag-highlight');
                });
            }
        }
        return;
    }
    
    // Then check for element targets
    const dropTarget = this.findDropTarget(e);
    if (dropTarget && dropTarget !== this.draggedElement) {
        dropTarget.classList.add('drag-over');  // Keep original style for elements
    }
}
    
findDropTarget(e) {
    const elements = document.elementsFromPoint(e.clientX, e.clientY);
    for (const element of elements) {
        if (element.classList.contains('element-container') && element !== this.draggedElement) {
            // Don't allow dropping onto images if images are locked
            if (this.model.imagesLocked && element.dataset.type === 'image') {
                continue;
            }
            
            // Don't allow dropping onto locked cards
            if (this.model.isCardLocked(element.dataset.id)) {
                continue;
            }
            
            return element;
        }
    }
    return null;
}
    
    updateTheme(isDarkTheme) {
        OPTIMISM.log(`Updating theme to ${isDarkTheme ? 'dark' : 'light'}`);
        if (isDarkTheme) {
            document.body.classList.remove('light-theme');
        } else {
            document.body.classList.add('light-theme');
        }
    }

    showBackupReminderModal() {
        document.getElementById('backup-reminder-modal').style.display = 'flex';
    }
    
    hideBackupReminderModal() {
        document.getElementById('backup-reminder-modal').style.display = 'none';
    }
    
    setupBackupReminderModal() {
        OPTIMISM.log('Setting up backup reminder modal');
        
        // Get modal elements
        const modal = document.getElementById('backup-reminder-modal');
        const remindLaterButton = document.getElementById('remind-later-button');
        const backupNowButton = document.getElementById('backup-now-button');
        
        // Setup event listeners
        remindLaterButton.addEventListener('click', () => {
            this.hideBackupReminderModal();
            this.model.resetBackupReminder();
        });
        
        backupNowButton.addEventListener('click', () => {
            this.hideBackupReminderModal();
            this.model.resetBackupReminder();
            this.controller.exportData();
        });
        
        OPTIMISM.log('Backup reminder modal set up successfully');
    }

    // In view.js - full findBreadcrumbDropTarget method
findBreadcrumbDropTarget(e) {
    const breadcrumbs = document.querySelectorAll('.breadcrumb-item');
    for (let i = 0; i < breadcrumbs.length - 1; i++) { // Skip the last one (current level)
        const breadcrumb = breadcrumbs[i];
        const rect = breadcrumb.getBoundingClientRect();
        
        // Add a bit more tolerance around the element
        const tolerance = 5; // 5px tolerance
        if (e.clientX >= rect.left - tolerance && e.clientX <= rect.right + tolerance &&
            e.clientY >= rect.top - tolerance && e.clientY <= rect.bottom + tolerance) {
            return breadcrumb;
        }
    }
    return null;
}

setupSettingsPanel() {
    OPTIMISM.log('Setting up settings panel');
    
    // Toggle settings panel visibility when settings button is clicked
    this.settingsToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = this.settingsPanel.style.display === 'block';
        
        // Toggle visibility
        this.settingsPanel.style.display = isVisible ? 'none' : 'block';
        
        // Close style panel if settings panel is opening
        if (!isVisible) {
            this.stylePanel.style.display = 'none';
        }
    });
    
    // Set up settings panel options - remove all instances of hiding the panel
    document.getElementById('settings-undo-button').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.controller.undo();
        // Remove: this.settingsPanel.style.display = 'none';
    });
    
    document.getElementById('settings-redo-button').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.controller.redo();
        // Remove: this.settingsPanel.style.display = 'none';
    });
    
    document.getElementById('settings-export-button').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.controller.exportData();
        // Remove: this.settingsPanel.style.display = 'none';
    });
    
    document.getElementById('settings-export-no-images-button').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.controller.exportDataWithoutImages();
        // Remove: this.settingsPanel.style.display = 'none';
    });
    
    document.getElementById('settings-import-button').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.confirmationDialog.style.display = 'block';
        // Remove: this.settingsPanel.style.display = 'none';
    });
    
    document.getElementById('settings-debug-toggle').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.controller.toggleDebugPanel();
        // Remove: this.settingsPanel.style.display = 'none';
    });
    
    document.getElementById('settings-theme-toggle').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.controller.toggleTheme();
        // Remove: this.settingsPanel.style.display = 'none';
    });
    
    OPTIMISM.log('Settings panel set up successfully');
}

    // Add this method to the CanvasView class in view.js
// In view.js
findHighestImageZIndex() {
    const imageElements = document.querySelectorAll('.image-element-container');
    let maxZIndex = 1; // Default z-index for images
    
    imageElements.forEach(elem => {
        const zIndex = parseInt(elem.style.zIndex) || 1;
        if (zIndex > maxZIndex) {
            maxZIndex = zIndex;
        }
    });
    
    // Cap at 99 to ensure we're always below text elements (which are at 100+)
    return Math.min(maxZIndex, 99);
}

// Update the setupLockImagesToggle method in CanvasView
setupLockImagesToggle() {
    OPTIMISM.log('Setting up lock images toggle');
    
    // Create the lock images button
    const lockImagesButton = document.createElement('button');
    lockImagesButton.id = 'lock-images-button';
    lockImagesButton.className = 'nav-link';
    lockImagesButton.textContent = this.model.imagesLocked ? 'Unlock Images' : 'Lock Images';
    
    // Add click event listener
    lockImagesButton.addEventListener('click', () => {
        this.toggleImagesLocked();
    });
    
    // Add button to the right controls section
    const rightControls = document.getElementById('right-controls');
    if (rightControls) {
        // Add after the Copy Link button
        const copyLinkButton = document.getElementById('copy-link-button');
        if (copyLinkButton && copyLinkButton.nextSibling) {
            rightControls.insertBefore(lockImagesButton, copyLinkButton.nextSibling);
        } else if (copyLinkButton) {
            rightControls.insertBefore(lockImagesButton, rightControls.firstChild.nextSibling);
        } else {
            rightControls.insertBefore(lockImagesButton, rightControls.firstChild);
        }
    }
    
    // Store reference to the button
    this.lockImagesButton = lockImagesButton;
    
    OPTIMISM.log('Lock images toggle set up successfully');
}

// Modify the toggleImagesLocked method in CanvasView to use the controller
toggleImagesLocked() {
    this.controller.toggleImagesLocked().then(isLocked => {
        this.lockImagesButton.textContent = isLocked ? "Unlock Images" : "Lock Images";
        this.updateImagesLockState();
    });
}

// Modify the updateImagesLockState method in CanvasView to accept an optional parameter
updateImagesLockState(isLocked) {
    // Use the provided isLocked value if passed, otherwise use the model's value
    const imagesLocked = isLocked !== undefined ? isLocked : this.model.imagesLocked;
    
    const imageContainers = document.querySelectorAll('.image-element-container');
    
    imageContainers.forEach(container => {
        if (imagesLocked) {
            // Add a class to indicate locked state - we'll use CSS for styling
            container.classList.add('image-locked');
            
            // If an image is currently selected, deselect it
            if (container.classList.contains('selected')) {
                container.classList.remove('selected');
                if (this.model.selectedElement === container.dataset.id) {
                    this.model.selectedElement = null;
                    // Also hide style panel if it was showing
                    this.stylePanel.style.display = 'none';
                }
            }
        } else {
            // Remove locked class
            container.classList.remove('image-locked');
        }
    });
    
    // Add CSS to handle pointer events more reliably
    let styleElem = document.getElementById('image-lock-style');
    if (!styleElem) {
        styleElem = document.createElement('style');
        styleElem.id = 'image-lock-style';
        document.head.appendChild(styleElem);
    }
    
    if (imagesLocked) {
        styleElem.textContent = `
            .image-locked .resize-handle {
                display: none !important;
            }
            .image-locked {
                cursor: default !important;
            }
        `;
    } else {
        styleElem.textContent = '';
    }
}

// In view.js
// In view.js
// In view.js - full setupQuickLinks method
setupQuickLinks() {
    OPTIMISM.log('Setting up quick links container');
    
    // Create the quick links container if it doesn't exist
    if (!this.quickLinksContainer) {
        // Create a fixed-position container for the links
        this.quickLinksContainer = document.createElement('div');
        this.quickLinksContainer.id = 'quick-links-container';
        this.quickLinksContainer.className = 'quick-links-container';
        
        // Style the container for center positioning
        this.quickLinksContainer.style.position = 'absolute';
        this.quickLinksContainer.style.left = '50%';
        this.quickLinksContainer.style.transform = 'translateX(-50%)';
        this.quickLinksContainer.style.display = 'flex';
        this.quickLinksContainer.style.justifyContent = 'center';
        this.quickLinksContainer.style.alignItems = 'center';
        this.quickLinksContainer.style.height = '100%';
        this.quickLinksContainer.style.top = '0';
        this.quickLinksContainer.style.pointerEvents = 'auto';
        
        // Add it to the title bar
        this.titleBar.appendChild(this.quickLinksContainer);
        
        // Add styles
        // In view.js - update the CSS portion of setupQuickLinks method
const styleElem = document.createElement('style');
styleElem.textContent = `
    .quick-link {
        padding: 4px 8px;
        color: var(--element-text-color);
        text-decoration: underline;
        margin: 0 10px;
        cursor: pointer;
        font-size: 14px;
        display: inline-block;
        max-width: 120px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        position: relative; top: 1px;
       
    }
        .quick-link-placeholder {
        color: var(--element-text-color);
        font-size: 14px;
        padding: 4px 8px;
        opacity: 0.7;
        position: relative;
        top: 1px; /* Move text down by 1px */
    }
    .quick-links-container {
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 5;
    }
    .breadcrumb-item.drag-highlight,
    .quick-link.drag-highlight,
    .quick-link-placeholder.drag-highlight {
        color: var(--green-text-color) !important;
       
       
    }
    .quick-link.shift-hover {
        color: var(--red-text-color) !important;
       
    }
    .element-container.drag-over {
        border: 2px dashed var(--element-border-color) !important;
    }
`;
document.head.appendChild(styleElem);
    }
    
    // Render the current quick links
    this.renderQuickLinks();
    
    OPTIMISM.log('Quick links container set up successfully');
}


// In view.js - full renderQuickLinks method
// In view.js - update the renderQuickLinks method
renderQuickLinks() {
    OPTIMISM.log('Rendering quick links');
    
    if (!this.quickLinksContainer) {
        this.setupQuickLinks();
        return;
    }
    
    // Clear existing links
    this.quickLinksContainer.innerHTML = '';
    
    // Check if we have any quick links
    if (this.model.quickLinks.length === 0) {
        // Show placeholder text
        const placeholderText = document.createElement('span');
        placeholderText.className = 'quick-link-placeholder';
        placeholderText.textContent = 'Drag cards here to bookmark';
        placeholderText.style.color = 'var(--element-text-color)';
        placeholderText.style.fontSize = '14px';  // Match other nav links
        placeholderText.style.padding = '4px 8px';
        placeholderText.style.opacity = '0.7';  // Slightly faded
        
        this.quickLinksContainer.appendChild(placeholderText);
        OPTIMISM.log('No quick links, showing placeholder text');
        return;
    }
    
    // Create a flex container for centered alignment
    const linksWrapper = document.createElement('div');
    linksWrapper.style.display = 'flex';
    linksWrapper.style.justifyContent = 'center';
    linksWrapper.style.alignItems = 'center';
    linksWrapper.style.gap = '20px'; // Space between links
    
    // Create a variable to track shift key state
    const shiftKeyState = { pressed: false };
    
    // Add global event listeners for shift key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Shift') {
            shiftKeyState.pressed = true;
            // Update all quick links
            document.querySelectorAll('.quick-link:hover').forEach(link => {
                link.classList.add('shift-hover');
            });
        }
    });
    
    document.addEventListener('keyup', (e) => {
        if (e.key === 'Shift') {
            shiftKeyState.pressed = false;
            // Update all quick links
            document.querySelectorAll('.quick-link.shift-hover').forEach(link => {
                link.classList.remove('shift-hover');
            });
        }
    });
    
    // Render each quick link
    this.model.quickLinks.forEach(link => {
        const quickLink = document.createElement('a');
        quickLink.className = 'quick-link';
        quickLink.dataset.nodeId = link.nodeId;
        
        // Truncate title if needed
        let displayTitle = link.nodeTitle || 'Untitled';
        if (displayTitle.length > 10) {
            displayTitle = displayTitle.substring(0, 10) + '...';
        }
        
        // Add expiry info to title attribute
        const editsUntilExpiry = link.expiresAt - this.model.editCounter;
        quickLink.title = `${link.nodeTitle} (expires in ${editsUntilExpiry} edits) - Shift+click to remove`;
        
        quickLink.textContent = displayTitle;
        
        // Check if we're in the critical last 10 edits
        if (editsUntilExpiry <= 10) {
            // For the last 10 edits, use red text and full opacity
            quickLink.style.color = 'var(--red-text-color)';
            quickLink.style.opacity = '1.0'; // Full opacity
        } else {
            // Calculate opacity based on remaining lifetime for non-critical links
            const remainingLifePercentage = editsUntilExpiry / this.model.quickLinkExpiryCount;
            const opacity = Math.max(0.3, remainingLifePercentage);
            quickLink.style.opacity = opacity.toFixed(2);
        }
        
        // Add hover event listeners for shift key state
        quickLink.addEventListener('mouseenter', () => {
            if (shiftKeyState.pressed) {
                quickLink.classList.add('shift-hover');
            }
        });
        
        quickLink.addEventListener('mouseleave', () => {
            quickLink.classList.remove('shift-hover');
        });
        
        // In view.js - update the click handler in renderQuickLinks method
quickLink.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if shift key is pressed for removal
    if (e.shiftKey) {
      try {
        OPTIMISM.log(`Removing quick link via shift+click: ${link.nodeId}`);
        this.controller.removeQuickLink(link.nodeId);
      } catch (error) {
        OPTIMISM.logError(`Error removing quick link: ${error}`);
      }
      return;
    }
    
    // Refresh the expiry of the link when clicked
    try {
      OPTIMISM.log(`Refreshing quick link expiry on click: ${link.nodeId}`);
      this.controller.refreshQuickLinkExpiry(link.nodeId);
    } catch (error) {
      OPTIMISM.logError(`Error refreshing quick link expiry: ${error}`);
    }
    
    // Normal click - navigate to the node
    try {
      OPTIMISM.log(`Navigating to quick link node: ${link.nodeId}`);
      // Use navigateToNode instead of navigateToElement
      this.controller.navigateToNode(link.nodeId);
    } catch (error) {
      OPTIMISM.logError(`Error navigating to quick link: ${error}`);
    }
  });
        
        linksWrapper.appendChild(quickLink);
    });
    
    // Add the wrapper to the container
    this.quickLinksContainer.appendChild(linksWrapper);
    
    OPTIMISM.log(`Rendered ${this.model.quickLinks.length} quick links`);
}


setupQuickLinkDragEvents() {
    // We no longer need drag and drop for quick links
    // This method is now mostly empty since we're using shift+click instead
    
    // Prevent quick links from being draggable
    document.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('quick-link')) {
            e.preventDefault();
            e.stopPropagation();
        }
    });
    
    OPTIMISM.log('Quick link drag events set up successfully');
}

// Add this method to view.js
isOverQuickLinksArea(e) {
    // Check if the event is over the title bar (where the quick links are)
    const titleBar = document.getElementById('title-bar');
    if (!titleBar) return false;
    
    const rect = titleBar.getBoundingClientRect();
    
    // Check if mouse position is within the title bar bounds
    if (e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top && e.clientY <= rect.bottom) {
        
        // Check if it's in the middle third of the title bar (approximate quick links area)
        const leftBound = rect.left + rect.width * 0.3;
        const rightBound = rect.right - rect.width * 0.3;
        
        return e.clientX >= leftBound && e.clientX <= rightBound;
    }
    
    return false;
}

// Update the lock state of a specific card
updateCardLockState(cardId, isLocked) {
    const container = document.querySelector(`.element-container[data-id="${cardId}"]`);
    if (!container) return;
    
    if (isLocked) {
        container.classList.add('card-locked');
    } else {
        container.classList.remove('card-locked');
    }
    
    // Update style panel if the card is currently selected
    if (this.model.selectedElement === cardId) {
        const lockOption = document.querySelector(`.option-value[data-lock="${isLocked ? 'true' : 'false'}"]`);
        if (lockOption) {
            document.querySelectorAll('.option-value[data-lock]').forEach(opt => opt.classList.remove('selected'));
            lockOption.classList.add('selected');
        }
    }
    
    // Add CSS to handle locked cards
    this.updateLockedCardStyles();
}

updateLockedCardStyles() {
    let styleElem = document.getElementById('card-lock-style');
    if (!styleElem) {
        styleElem = document.createElement('style');
        styleElem.id = 'card-lock-style';
        document.head.appendChild(styleElem);
    }
    
    styleElem.textContent = `
        .card-locked {
            cursor: default !important;
            pointer-events: none;
        }
        .card-locked .resize-handle {
            display: none !important;
        }
        .card-locked.selected::after {
            content: '🔒';
            position: absolute;
            top: 5px;
            right: 5px;
            font-size: 14px;
            opacity: 0.6;
            z-index: 10;
            pointer-events: none;
        }
        /* Override pointer-events for selecting locked cards */
        .card-locked {
            pointer-events: auto;
        }
        .card-locked * {
            pointer-events: none;
        }
    `;
}

setupInboxPanel() {
    OPTIMISM.log('Setting up inbox panel');
    
    // Create the inbox toggle button if it doesn't exist
    if (!this.inboxToggle) {
        this.inboxToggle = document.createElement('button');
        this.inboxToggle.id = 'inbox-toggle';
        this.inboxToggle.className = 'nav-link';
        this.inboxToggle.textContent = 'Inbox';
        
        // Insert before the settings toggle
        const rightControls = document.getElementById('right-controls');
        if (rightControls && this.settingsToggle) {
            rightControls.insertBefore(this.inboxToggle, this.settingsToggle);
        } else if (rightControls) {
            rightControls.appendChild(this.inboxToggle);
        }
    }
    
    // Create the inbox panel if it doesn't exist
    if (!this.inboxPanel) {
        this.inboxPanel = document.createElement('div');
        this.inboxPanel.id = 'inbox-panel';
        this.inboxPanel.className = 'side-panel';
        this.inboxPanel.innerHTML = `
            <div class="panel-heading">Inbox</div>
            <div class="inbox-container"></div>
        `;
        document.body.appendChild(this.inboxPanel);
        
        // Add CSS for inbox panel
        const styleElem = document.createElement('style');
        styleElem.textContent = `
            #inbox-panel {
                position: fixed;
                top: 41px;
                right: 0;
                width: var(--panel-width);
                height: calc(100vh - 40px);
                background-color: var(--bg-color);
                padding: 20px;
                padding-top: 60px;
                box-sizing: border-box;
                overflow-y: auto;
                display: none;
                z-index: 200;
            }
            
            .inbox-container {
                display: flex;
                flex-direction: column;
                gap: 15px;
            }
            
            .inbox-card {
                border: 1px solid var(--element-border-color);
                border-radius: 4px;
                padding: 10px;
                font-size: 14px;
                cursor: move;
                position: relative;
                background-color: var(--bg-color);
                overflow: hidden;
                max-height: 80px;
            }
            
            .inbox-card-content {
                white-space: pre-wrap;
                overflow: hidden;
                text-overflow: ellipsis;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                max-height: 40px;
            }
            
            .inbox-card-image {
                max-height: 60px;
                max-width: 100%;
                object-fit: contain;
                display: block;
                margin: 0 auto;
            }
            
            .inbox-card.dragging {
                opacity: 0.5;
            }
            
            .inbox-card-edit {
                width: 100%;
                height: 100%;
                background-color: transparent;
                color: var(--element-text-color);
                border: none;
                padding: 0;
                resize: none;
                overflow: auto;
                font-family: inherit;
                box-sizing: border-box;
                font-size: 14px;
                min-height: 60px;
            }
            
            .inbox-card-edit:focus {
                outline: none;
            }
            
            .inbox-hint {
                color: var(--element-text-color);
                opacity: 0.7;
                text-align: center;
                margin: 20px 0;
                font-style: italic;
            }
        `;
        document.head.appendChild(styleElem);
    }
    
    // Set up click event for toggle
    this.inboxToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        this.controller.toggleInboxVisibility();
    });
    
    // Initial rendering based on current state
    this.updateInboxVisibility(this.model.isInboxVisible);
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Only handle when not in text input
        if (document.activeElement.tagName !== 'TEXTAREA' && 
            document.activeElement.tagName !== 'INPUT') {
                
            // Add blank card with 'A' key
            if (e.key.toLowerCase() === 'a') {
                e.preventDefault();
                this.controller.addBlankCardToInbox();
            }
            
            
        }

        if (e.key.toLowerCase() === 'g' && 
    document.activeElement.tagName !== 'TEXTAREA' && 
    document.activeElement.tagName !== 'INPUT') {
    e.preventDefault();
    this.controller.toggleGridVisibility();
}

if (e.key.toLowerCase() === 'i' && 
document.activeElement.tagName !== 'TEXTAREA' && 
document.activeElement.tagName !== 'INPUT') {
e.preventDefault();
this.controller.toggleInboxVisibility();
}

    });
    
    // Set up workspace drop handler for inbox cards
    this.workspace.addEventListener('dragover', (e) => {
        e.preventDefault();
        
        // Check if we're dragging an inbox card (by checking the source element)
        const inboxCard = e.target.closest && e.target.closest('.inbox-card');
        if (inboxCard) {
            // Hide the image drop zone
            if (this.dropZoneIndicator) {
                this.dropZoneIndicator.style.display = 'none';
            }
        }
    });
    
    this.workspace.addEventListener('drop', (e) => {
        // If we're dragging from inbox, handle the drop
        if (this.inboxDragTarget) {
            e.preventDefault();
            e.stopPropagation();
            
            // Get the card ID from the dataTransfer object
            const cardId = e.dataTransfer.getData('text/plain');
            
            if (cardId) {
                // Get the position relative to the workspace
                const rect = this.workspace.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                OPTIMISM.log(`Dropping inbox card ${cardId} onto workspace at (${x}, ${y})`);
                
                // Move the card from the inbox to the canvas
                this.controller.moveFromInboxToCanvas(cardId, x, y);
            }
        }
    });
    
    OPTIMISM.log('Inbox panel set up successfully');
}

updateInboxVisibility(isVisible) {
    if (!this.inboxPanel) {
        this.setupInboxPanel();
        return;
    }
    
    if (isVisible) {
        // Close other panels first
        this.stylePanel.style.display = 'none';
        this.settingsPanel.style.display = 'none';
        
        // Show inbox panel
        this.inboxPanel.style.display = 'block';
        this.renderInboxPanel();
    } else {
        this.inboxPanel.style.display = 'none';
    }
}

renderInboxPanel() {
    if (!this.inboxPanel) {
        this.setupInboxPanel();
        return;
    }
    
    const container = this.inboxPanel.querySelector('.inbox-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (this.model.inboxCards.length === 0) {
        const hint = document.createElement('div');
        hint.className = 'inbox-hint';
        hint.textContent = 'Press "A" to add a new card';
        container.appendChild(hint);
        return;
    }
    
    // Render each inbox card
    this.model.inboxCards.forEach(card => {
        const cardElement = document.createElement('div');
        cardElement.className = 'inbox-card';
        cardElement.dataset.id = card.id;
        cardElement.dataset.type = card.type;
        
        if (card.type === 'text') {
            // Special handling for the first card if it's empty (new blank card)
            if (card.id === this.model.inboxCards[0].id && (!card.text || card.text.trim() === '')) {
                // Create textarea for editing
                const textarea = document.createElement('textarea');
                textarea.className = 'inbox-card-edit';
                textarea.placeholder = 'Type here...';
                
                // Handle blur event to save content
                textarea.addEventListener('blur', () => {
                    const text = textarea.value;
                    this.controller.updateInboxCard(card.id, { text });
                });
                
                cardElement.appendChild(textarea);
                
                // Focus the textarea after rendering
                setTimeout(() => {
                    textarea.focus();
                }, 0);
            } else {
                // Regular text card - show truncated content
                const content = document.createElement('div');
                content.className = 'inbox-card-content';
                // Truncate text even more for the display
                const truncatedText = card.text ? 
                    (card.text.length > 100 ? card.text.substring(0, 100) + '...' : card.text) : '';
                content.textContent = truncatedText;
                cardElement.appendChild(content);
            }
        } else if (card.type === 'image' && card.imageDataId) {
            // Image card
            const img = document.createElement('img');
            img.className = 'inbox-card-image';
            
            // Load image data
            this.model.getImageData(card.imageDataId)
                .then(imageData => {
                    if (imageData) {
                        img.src = imageData;
                    } else {
                        img.alt = 'Image not found';
                    }
                })
                .catch(error => {
                    OPTIMISM.logError(`Error loading image for inbox card ${card.id}:`, error);
                    img.alt = 'Error loading image';
                });
            
            cardElement.appendChild(img);
        }
        
        // Make card draggable
        cardElement.draggable = true;
        
        // Add drag event handlers
        cardElement.addEventListener('dragstart', (e) => {
            OPTIMISM.log(`Starting drag of inbox card ${card.id}`);
            
            // Store the card ID in the dataTransfer object
            e.dataTransfer.setData('text/plain', card.id);
            
            // Set drag effect
            e.dataTransfer.effectAllowed = 'move';
            
            // Add visual indicator
            cardElement.classList.add('dragging');
            
            // Store reference to dragged element
            this.inboxDragTarget = cardElement;
            
            // Hide drop zone indicator
            if (this.dropZoneIndicator) {
                this.dropZoneIndicator.style.display = 'none';
            }
        });
        
        cardElement.addEventListener('dragend', (e) => {
            OPTIMISM.log(`Ending drag of inbox card ${card.id}`);
            cardElement.classList.remove('dragging');
            this.inboxDragTarget = null;
        });
        
        // Double-click to edit text cards
        if (card.type === 'text') {
            cardElement.addEventListener('dblclick', (e) => {
                // Replace content with textarea
                cardElement.innerHTML = '';
                const textarea = document.createElement('textarea');
                textarea.className = 'inbox-card-edit';
                textarea.value = card.text || '';
                
                // Handle blur event to save content
                textarea.addEventListener('blur', () => {
                    const text = textarea.value;
                    this.controller.updateInboxCard(card.id, { text });
                });
                
                cardElement.appendChild(textarea);
                textarea.focus();
            });
        }
        
        container.appendChild(cardElement);
    });
}

setupInboxDragEvents() {
    OPTIMISM.log('Setting up inbox drag events');
    
    // Set up workspace drop handler for inbox cards
    this.workspace.addEventListener('dragover', (e) => {
        e.preventDefault();
        
        // Check if we're dragging an inbox card
        const inboxCard = e.target.closest && e.target.closest('.inbox-card');
        if (inboxCard) {
            // Hide the image drop zone
            if (this.dropZoneIndicator) {
                this.dropZoneIndicator.style.display = 'none';
            }
        }
    });
    
    this.workspace.addEventListener('drop', (e) => {
        e.preventDefault();
        
        // Get the inbox card element that was dragged (if any)
        const inboxCard = e.target.closest && e.target.closest('.inbox-card');
        if (inboxCard) {
            const cardId = inboxCard.dataset.id;
            if (cardId) {
                // Get position relative to workspace
                const rect = this.workspace.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                OPTIMISM.log(`Moving inbox card ${cardId} to canvas at position (${x}, ${y})`);
                this.controller.moveFromInboxToCanvas(cardId, x, y);
            }
        }
    });
    
    OPTIMISM.log('Inbox drag events setup complete');
}

// Add these methods to the CanvasView class in view.js

setupGridPanel() {
    OPTIMISM.log('Setting up grid panel');
    
    // Create the grid toggle button
    const gridToggle = document.createElement('button');
    gridToggle.id = 'grid-toggle';
    gridToggle.className = 'nav-link';
    gridToggle.textContent = 'Grid';
    
    // Add to the right controls before the inbox toggle
    const rightControls = document.getElementById('right-controls');
    if (rightControls && this.inboxToggle) {
        rightControls.insertBefore(gridToggle, this.inboxToggle);
    } else if (rightControls) {
        rightControls.appendChild(gridToggle);
    }
    
    // Update the click event to toggle panel visibility instead of grid state
    gridToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleGridPanel(); // Call a new method to toggle panel visibility
    });
    
    // Set up grid panel options
    const gridOptions = document.querySelectorAll('.option-value[data-grid]');
    gridOptions.forEach(option => {
        option.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const isVisible = option.dataset.grid === 'on';
            if (isVisible !== this.model.isGridVisible) {
                this.controller.toggleGridVisibility();
            }
            
            // Update selected option
            gridOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
        });
    });
    
    // Set up grid layout options
    const layoutOptions = document.querySelectorAll('.option-value[data-grid-layout]');
    layoutOptions.forEach(option => {
        option.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const layout = option.dataset.gridLayout;
            this.controller.setGridLayout(layout);
        });
    });
    
    // Set initial selection states
    this.updateGridVisibility(this.model.isGridVisible);
    this.updateGridLayoutSelection(this.model.gridLayout);
    
    OPTIMISM.log('Grid panel setup complete');
}

updateGridVisibility(isVisible) {
    // Update the panel options to show the current grid state
    const gridOptions = document.querySelectorAll('.option-value[data-grid]');
    gridOptions.forEach(option => {
        option.classList.remove('selected');
        if ((option.dataset.grid === 'on' && isVisible) || 
            (option.dataset.grid === 'off' && !isVisible)) {
            option.classList.add('selected');
        }
    });
    
    // Show or hide the grid
    if (isVisible) {
        this.renderGrid();
    } else {
        this.clearGrid();
    }
    
    // Note: We no longer toggle panel visibility here
    // Panel visibility is controlled separately in toggleGridPanel
}

updateGridLayoutSelection(layout) {
    const layoutOptions = document.querySelectorAll('.option-value[data-grid-layout]');
    layoutOptions.forEach(option => {
        option.classList.remove('selected');
        if (option.dataset.gridLayout === layout) {
            option.classList.add('selected');
        }
    });
}

renderGrid() {
    OPTIMISM.log(`Rendering grid with layout: ${this.model.gridLayout}`);
    
    // Clear any existing grid
    this.clearGrid();
    
    // If grid is not visible, don't render
    if (!this.model.isGridVisible) return;
    
    // Create grid container if it doesn't exist
    let gridContainer = document.getElementById('grid-container');
    if (!gridContainer) {
        gridContainer = document.createElement('div');
        gridContainer.id = 'grid-container';
        gridContainer.style.position = 'absolute';
        gridContainer.style.top = '0';
        gridContainer.style.left = '0';
        gridContainer.style.width = '100%';
        gridContainer.style.height = '100%';
        gridContainer.style.zIndex = '0';
        gridContainer.style.pointerEvents = 'none';
        this.workspace.appendChild(gridContainer);
    }
    
    // Get workspace dimensions
    const workspaceWidth = this.workspace.clientWidth;
    const workspaceHeight = this.workspace.clientHeight;
    
    // Parse layout pattern (rows x columns)
    const [rows, columns] = this.model.gridLayout.split('x').map(num => parseInt(num, 10));
    
    // Create vertical grid lines (for columns)
    if (columns > 1) {
        for (let i = 1; i < columns; i++) {
            const position = (workspaceWidth / columns) * i;
            const vertLine = document.createElement('div');
            vertLine.className = 'grid-line grid-line-vertical';
            vertLine.style.left = `${position}px`;
            gridContainer.appendChild(vertLine);
        }
    }
    
    // Create horizontal grid lines (for rows)
    if (rows > 1) {
        for (let i = 1; i < rows; i++) {
            const position = (workspaceHeight / rows) * i;
            const horzLine = document.createElement('div');
            horzLine.className = 'grid-line grid-line-horizontal';
            horzLine.style.top = `${position}px`;
            gridContainer.appendChild(horzLine);
        }
    }
    
    OPTIMISM.log('Grid rendered successfully');
}

clearGrid() {
    const gridContainer = document.getElementById('grid-container');
    if (gridContainer) {
        gridContainer.innerHTML = '';
        OPTIMISM.log('Grid cleared');
    }
}

toggleGridPanel() {
    OPTIMISM.log('Toggling grid panel visibility');
    
    const gridPanel = document.getElementById('grid-panel');
    if (gridPanel) {
        const isVisible = gridPanel.style.display === 'block';
        
        // Toggle visibility
        gridPanel.style.display = isVisible ? 'none' : 'block';
        
        // If opening the panel, refresh selection states
        if (!isVisible) {
            // Close other panels
            this.stylePanel.style.display = 'none';
            this.settingsPanel.style.display = 'none';
            if (this.inboxPanel) {
                this.inboxPanel.style.display = 'none';
            }
            
            // Update selection states to reflect current settings
            this.updateGridVisibility(this.model.isGridVisible);
            this.updateGridLayoutSelection(this.model.gridLayout);
        }
        
        OPTIMISM.log(`Grid panel visibility set to: ${!isVisible}`);
    }
}
    
}