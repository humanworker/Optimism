// View to handle UI interactions
class CanvasView {
    constructor(model, controller) {
        this.model = model;
        this.controller = controller;
        this.workspace = document.getElementById('workspace');
        this.titleBar = document.getElementById('title-bar');
        this.breadcrumbContainer = document.getElementById('breadcrumb-container');
        this.stylePanel = document.getElementById('style-panel');
        this.themeToggle = document.getElementById('theme-toggle');
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
        
        this.draggedElement = null;
        this.resizingElement = null;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.elemOffsetX = 0;
        this.elemOffsetY = 0;
        
        this.initialWidth = 0;
        this.initialHeight = 0;
        
        // Detect platform
        this.isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
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

        this.setupBackupReminderModal();
        
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
            
            // Up Arrow to navigate back (zoom out)
            if (e.key === 'ArrowUp' && this.model.navigationStack.length > 1) {
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
        });

        // Prevent right-click context menu
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
        
        // Close style panel when clicking outside
        document.addEventListener('click', (e) => {
            // If clicking outside of both the style panel and any element
            if (!this.stylePanel.contains(e.target) && 
                !e.target.closest('.element-container') && 
                this.stylePanel.style.display === 'block') {
                this.stylePanel.style.display = 'none';
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
            
            if (e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                
                // Only handle image files
                if (file.type.startsWith('image/')) {
                    OPTIMISM.log(`Image dropped: ${file.name} (${file.type})`);
                    this.showLoading();
                    
                    try {
                        // Get correct coordinates relative to the workspace
                        const rect = this.workspace.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const y = e.clientY - rect.top;
                        
                        // Process and add the image
                        await this.controller.addImage(file, x, y);
                    } catch (error) {
                        OPTIMISM.logError('Error adding image:', error);
                        alert('Failed to add image. Please try again.');
                    } finally {
                        this.hideLoading();
                    }
                }
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
    
    renderWorkspace() {
        OPTIMISM.log('Rendering workspace');
        // Clear workspace
        this.workspace.innerHTML = '';
        
        // Update breadcrumbs
        this.renderBreadcrumbs();
        
        // Render elements
        if (this.model.currentNode.elements) {
            const elementsCount = this.model.currentNode.elements.length;
            OPTIMISM.log(`Rendering ${elementsCount} element(s)`);
            
            // Sort elements so images are rendered before text (lower z-index)
            const sortedElements = [...this.model.currentNode.elements].sort((a, b) => {
                if (a.type === 'image' && b.type === 'text') return -1;
                if (a.type === 'text' && b.type === 'image') return 1;
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
    formatTextWithHeader(text, hasHeader) {
        if (!text || !hasHeader) return this.convertUrlsToLinks(text || '');
        
        const lines = text.split('\n');
        if (lines.length === 0) return '';
        
        // Extract first line as header
        const headerLine = lines[0];
        const restOfText = lines.slice(1).join('\n');
        
        return `<span class="first-line">${this.convertUrlsToLinks(headerLine)}</span>${this.convertUrlsToLinks(restOfText)}`;
    }
    
    // URL detection and conversion to clickable links
    convertUrlsToLinks(text) {
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
        
        // More comprehensive URL regex
        const urlRegex = /(\bhttps?:\/\/[a-z0-9\-._~:/?#[\]@!$&'()*+,;=]+[a-z0-9\-_~:/[\]@!$&'()*+,;=]|\bwww\.[a-z0-9\-._~:/?#[\]@!$&'()*+,;=]+[a-z0-9\-_~:/[\]@!$&'()*+,;=])/gi;
        
        let match;
        while ((match = urlRegex.exec(safeText)) !== null) {
            // Add text before the URL
            result += safeText.substring(lastIndex, match.index);
            
            // Get the URL
            let url = match[0];
            
            // Remove any trailing punctuation that shouldn't be part of the URL
            url = url.replace(/[.,;:!?)]+$/, '');
            
            // Create the proper href attribute
            let href = url;
            if (url.toLowerCase().startsWith('www.')) {
                href = 'https://' + url;
            }
            
            // Add the anchor tag
            result += `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`;
            
            // Update lastIndex to end of current match
            lastIndex = match.index + url.length;
            
            // Adjust the regex lastIndex if we modified the URL (removed trailing punctuation)
            if (url.length !== match[0].length) {
                urlRegex.lastIndex = lastIndex;
            }
        }
        
        // Add any remaining text after the last URL
        result += safeText.substring(lastIndex);
        
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

        // Create the text editor (hidden by default)
        const textEditor = document.createElement('textarea');
        textEditor.className = 'text-element';
        if (hasChildren) {
            textEditor.classList.add('has-children');
        }
        textEditor.value = elementData.text || '';
        textEditor.style.display = 'none'; // Hide by default
        
        // Create the text display (shown by default)
        const textDisplay = document.createElement('div');
        textDisplay.className = 'text-display';
        if (hasChildren) {
            textDisplay.classList.add('has-children');
        }
        
        // Apply header formatting if set
        const hasHeader = elementData.style && elementData.style.hasHeader;
        if (hasHeader) {
            textDisplay.classList.add('has-header');
            textDisplay.innerHTML = this.formatTextWithHeader(elementData.text || '', true);
        } else {
            textDisplay.innerHTML = this.convertUrlsToLinks(elementData.text || '');
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
        
        // Create resize handle
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        
        // Setup content listeners
        textEditor.addEventListener('input', () => {
            // We don't immediately update the model on every keystroke anymore
            // Just update display for immediate feedback if needed
        });
        
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
            
            if (hasHeader) {
                textDisplay.innerHTML = this.formatTextWithHeader(textEditor.value, true);
            } else {
                textDisplay.innerHTML = this.convertUrlsToLinks(textEditor.value);
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
        
        // In createTextElementDOM method, update the click handler
container.addEventListener('click', (e) => {
    // Don't handle clicks on links
    if (e.target.tagName === 'A') return;
    
    this.selectElement(container, elementData);
    
    // If cmd/ctrl is pressed, navigate into the element regardless of whether it has children
    if (this.isModifierKeyPressed(e)) {
        this.controller.navigateToElement(elementData.id);
        e.stopPropagation();
    }
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
        
        container.addEventListener('mousedown', (e) => {
            // Don't handle if not left mouse button or if clicking a link
            if (e.button !== 0 || e.target.tagName === 'A') return;
            
            // Don't start drag when on resize handle
            if (e.target === resizeHandle) return;
            
            this.selectElement(container, elementData);
            
            // Don't start dragging if we're in edit mode
            if (textEditor.style.display === 'block') return;
            
            this.draggedElement = container;
            this.model.selectedElement = elementData.id;
            
            // Calculate offset
            const rect = container.getBoundingClientRect();
            this.elemOffsetX = e.clientX - rect.left;
            this.elemOffsetY = e.clientY - rect.top;
            
            container.classList.add('dragging');
            e.preventDefault();
        });
        
        // Setup resize handle event listeners
        resizeHandle.addEventListener('mousedown', (e) => {
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
    
        // Create the image element
        const imageElement = document.createElement('img');
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
    
        // In createImageElementDOM method, update the click handler
        container.addEventListener('click', (e) => {
            this.selectElement(container, elementData);
            
            // If cmd/ctrl is pressed, navigate into the element regardless of whether it has children
            if (this.isModifierKeyPressed(e)) {
                this.controller.navigateToElement(elementData.id);
                e.stopPropagation();
            }
        });
        
        container.addEventListener('mousedown', (e) => {
            // Don't handle if not left mouse button
            if (e.button !== 0) return;
            
            // Don't start drag when on resize handle
            if (e.target === resizeHandle) return;
            
            this.selectElement(container, elementData);
            
            this.draggedElement = container;
            this.model.selectedElement = elementData.id;
            
            // Calculate offset
            const rect = container.getBoundingClientRect();
            this.elemOffsetX = e.clientX - rect.left;
            this.elemOffsetY = e.clientY - rect.top;
            
            container.classList.add('dragging');
            e.preventDefault();
        });
        
        // Setup resize handle event listeners
        resizeHandle.addEventListener('mousedown', (e) => {
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
    
    selectElement(element, elementData) {
        OPTIMISM.log(`Selecting element ${elementData.id} of type ${elementData.type}`);
        this.deselectAllElements();
        element.classList.add('selected');
        this.model.selectedElement = element.dataset.id;
        
        // Show style panel only for text elements
        if (element.dataset.type === 'text') {
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
    }
    
    deselectAllElements() {
        document.querySelectorAll('.element-container.selected').forEach(el => {
            el.classList.remove('selected');
        });
        this.model.selectedElement = null;
    }
    
    setupDragListeners() {
        OPTIMISM.log('Setting up drag listeners');
        
        document.addEventListener('mousemove', (e) => {
            // Handle resizing
            if (this.resizingElement) {
                // Calculate size delta
                const deltaWidth = e.clientX - this.dragStartX;
                const deltaHeight = e.clientY - this.dragStartY;
                
                // Get element type
                const elementType = this.resizingElement.dataset.type;
                
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
            
            // Handle dragging code continues below...
            
            // Handle dragging
            if (!this.draggedElement) return;
            
            // Calculate new position
            const newX = e.clientX - this.elemOffsetX;
            const newY = e.clientY - this.elemOffsetY;
            
            // Apply new position
            this.draggedElement.style.left = `${newX}px`;
            this.draggedElement.style.top = `${newY}px`;
            
            // Highlight potential drop targets
            this.handleDragOver(e);
        });
        
        document.addEventListener('mouseup', (e) => {
            // Handle end of resizing
            if (this.resizingElement) {
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
            
            const draggedId = this.draggedElement.dataset.id;
            
            // Check if dragged over another element
            const dropTarget = this.findDropTarget(e);
            if (dropTarget && dropTarget !== this.draggedElement) {
                const targetId = dropTarget.dataset.id;
                
                OPTIMISM.log(`Element ${draggedId} dropped onto ${targetId}`);
                
                // Deselect all elements before moving
                this.deselectAllElements();
                
                this.controller.moveElement(draggedId, targetId);
            } else {
                // Update position in model
                const newX = parseFloat(this.draggedElement.style.left);
                const newY = parseFloat(this.draggedElement.style.top);
                
                OPTIMISM.log(`Element ${draggedId} moved to position (${newX}, ${newY})`);
                this.controller.updateElement(draggedId, { x: newX, y: newY });
            }
            
            // Reset drag state
            this.draggedElement.classList.remove('dragging');
            this.draggedElement = null;
            
            // Remove highlights
            const highlighted = document.querySelectorAll('.drag-over');
            highlighted.forEach(el => el.classList.remove('drag-over'));
        });
        
        OPTIMISM.log('Drag listeners set up successfully');
    }
    
    handleDragOver(e) {
        // Remove previous highlights
        const highlighted = document.querySelectorAll('.drag-over');
        highlighted.forEach(el => el.classList.remove('drag-over'));
        
        // Check for new target
        const dropTarget = this.findDropTarget(e);
        if (dropTarget && dropTarget !== this.draggedElement) {
            dropTarget.classList.add('drag-over');
        }
    }
    
    findDropTarget(e) {
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        for (const element of elements) {
            if (element.classList.contains('element-container') && element !== this.draggedElement) {
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
}