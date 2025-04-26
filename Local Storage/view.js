// View to handle UI interactions
class CanvasView {
    // Modify the constructor in CanvasView to remove the imagesLocked property initialization:
    // In view.js, modify the constructor to add a new CSS style element
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
        this.arenaViewport = null; // Will be created when are.na view is enabled
        this.arenaResizeDivider = null; // Will be created for resizing
        this.prioritiesPanel = null; // Will be created when needed
    this.prioritiesToggle = null; // Will be created when needed

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

        // Add custom panel background styles
        const panelStyles = document.createElement('style');
        panelStyles.id = 'panel-background-styles';
        panelStyles.textContent = `
            /* Yellow background for all panels */
            #style-panel,
            #settings-panel,
            #inbox-panel,
            #grid-panel {
                background-color: #e5e5e5 !important; /* Light yellow background */
            }

            /* Also style the modal and confirmation dialogs to match */
            #confirmation-dialog,
            .modal-content {
                background-color: #e5e5e5 !important;
            }
        `;
        document.head.appendChild(panelStyles);

        // NEW: Add panel stacking context styles to ensure proper z-index
        const stackingStyle = document.createElement('style');
        stackingStyle.id = 'panel-stacking-style';
        stackingStyle.textContent = `
            /* Force panels to use highest stacking context */
            #inbox-panel {
                z-index: 1000 !important;
                position: fixed !important;
                top: 41px !important;
                right: 0 !important;
            }

            #settings-panel {
                z-index: 1000 !important;
            }

            #style-panel {
                z-index: 1000 !important;
            }

            #grid-panel {
                z-index: 1000 !important;
            }

            /* Make sure viewport elements never cover panels */
            #arena-viewport,
            #arena-resize-divider {
                z-index: 150 !important;
            }

            /* Ensure dialogs appear above everything */
            #confirmation-dialog,
            #backup-reminder-modal,
            .modal-overlay {
                z-index: 2000 !important;
            }
        `;
        document.head.appendChild(stackingStyle);
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

        // Set up paste handler
        this.setupPasteHandler();

        this.setupBackupReminderModal();
        this.setupSettingsPanel();
        this.setupLockImagesToggle(); // Still call this but it won't create the button
        this.setupQuickLinks();
        this.setupQuickLinkDragEvents();
        this.setupInboxPanel(); // Set up the inbox panel
         // Ensure consistent panel styling
     this.setupConsistentPanelStyling();
     this.setupPanelStackingContext();

    // Ensure panels have proper z-indices
    this.ensurePanelZIndices();

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

        // Workspace double-click to create new elements
        this.workspace.addEventListener('dblclick', (e) => {
            // Ignore if click was on an element or if modifier key is pressed
            if (e.target !== this.workspace || this.isModifierKeyPressed(e)) return;

            // Get correct coordinates relative to the workspace CONTENT
            const rect = this.workspace.getBoundingClientRect();
            const x = e.clientX - rect.left + this.workspace.scrollLeft; // Add scrollLeft
            const y = e.clientY - rect.top + this.workspace.scrollTop;  // Add scrollTop

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

            // Toggle priority with 'P' key when an element is selected
            if (e.key.toLowerCase() === 'b' &&
                document.activeElement.tagName !== 'TEXTAREA' &&
                document.activeElement.tagName !== 'INPUT') {
                e.preventDefault();
                if (this.model.selectedElement) {
                    this.controller.toggleCardPriority(this.model.selectedElement);
                }
            }

           // Style shortcuts (only when an element is selected and not in edit mode)
            if (this.model.selectedElement && document.activeElement.tagName !== 'TEXTAREA') {
                const element = this.model.findElement(this.model.selectedElement);
                let styleUpdated = false; // Keep track if any style was updated

                // Text-specific styles (0, 1, 2, 3, 5, 6)
                if (element && element.type === 'text') {

                    // 0 = reset to default (small text, black, no header, no highlight, no border)
                    if (e.key === '0') {
                        this.controller.updateElementStyle(this.model.selectedElement, {
                            textSize: 'small',
                            textColor: 'default',
                            hasHeader: false,
                            isHighlighted: false,
                            hasBorder: false,
                            textAlign: 'left' // Add default alignment to reset
                        });
                        styleUpdated = true;
                        e.preventDefault();
                    }

                    // 1 = toggle through text sizes (small > large > huge)
                    else if (e.key === '1') {
                        // Get current size
                        const currentSize = element.style && element.style.textSize ? element.style.textSize : 'small';
                        let nextSize;

                        // Determine next size
                        if (currentSize === 'small') nextSize = 'large';
                        else if (currentSize === 'large') nextSize = 'huge';
                        else nextSize = 'small'; // huge or any other size goes back to small

                        this.controller.updateElementStyle(this.model.selectedElement, { textSize: nextSize });
                        styleUpdated = true;
                        e.preventDefault();
                    }

                    // 2 = cycle through text colors (default -> red -> green -> default)
                    else if (e.key === '2') {
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

                    // 3 = toggle through text alignment (left -> centre -> right -> left)
                    else if (e.key === '3') {
                        // Get current alignment
                        const currentAlign = element.style && element.style.textAlign ? element.style.textAlign : 'left';
                        let nextAlign;

                        // Determine next alignment
                        if (currentAlign === 'left') nextAlign = 'centre';
                        else if (currentAlign === 'centre') nextAlign = 'right';
                        else nextAlign = 'left'; // right or any other alignment goes back to left

                        this.controller.updateElementStyle(this.model.selectedElement, { textAlign: nextAlign });
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
                } // End of text-specific styles

                // Container / Generic Styles (4, 7, 8) - Apply outside the text check
                if (e.key === '4') {
                    const currentBgColor = element && element.style && element.style.cardBgColor ? element.style.cardBgColor : 'none';
                    const nextBgColor = (currentBgColor === 'none') ? 'yellow' : (currentBgColor === 'yellow') ? 'red' : 'none';
                    this.controller.updateElementStyle(this.model.selectedElement, { cardBgColor: nextBgColor });
                    styleUpdated = true;
                    e.preventDefault();
                }

                // 7 = toggle border
                else if (e.key === '7') {
                    // Toggle current border setting
                    const hasBorder = element && element.style && element.style.hasBorder ? true : false;
                    this.controller.updateElementStyle(this.model.selectedElement, { hasBorder: !hasBorder });
                    styleUpdated = true;
                    e.preventDefault();
                }

                // 9 = move to inbox (ACTION, not style)
                else if (e.key === '9') {
                    if (this.model.selectedElement) {
                        this.controller.moveToInbox(this.model.selectedElement);
                        this.stylePanel.style.display = 'none'; // Hide style panel after moving
                        e.preventDefault();
                    }
                    // No style panel update needed for this action
                }

                // 8 = toggle card lock
                else if (e.key === '8') {
                    // Toggle current lock setting
                    const isLocked = this.model.isCardLocked(this.model.selectedElement);
                    this.controller.updateElementStyle(this.model.selectedElement, { isLocked: !isLocked });
                    styleUpdated = true;
                    e.preventDefault();
                }

                // Update style panel if any style changed (only if the panel is relevant, e.g., for text)
                if (styleUpdated) {
                    const updatedElement = this.model.findElement(this.model.selectedElement);
                    if (updatedElement) {
                        // Update style panel only if it's currently visible and the element is text
                        if (this.stylePanel.style.display === 'block' && updatedElement.type === 'text') {
                            this.updateStylePanel(updatedElement);
                        }
                    }
                }
            } // End of selected element check
        }); // End of keydown listener

        // Prevent right-click context menu
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        // Close style panel when clicking outside
        document.addEventListener('click', (e) => {
            // If clicking outside of both the style panel and any element
           // 1. Style panel should still close when clicking on blank canvas
            if (!this.stylePanel.contains(e.target) &&
                !e.target.closest('.element-container') &&
                this.stylePanel.style.display === 'block') {
                this.stylePanel.style.display = 'none';
            }

            // 2. Settings panel should close when clicking on a card (which opens style panel)
            // but NOT when clicking the blank canvas
            if (this.settingsPanel &&
                this.settingsPanel.style.display === 'block' &&
                !this.settingsPanel.contains(e.target) &&
                e.target !== this.settingsToggle) {

                // Only close if clicking on a card (will open style panel)
                if (e.target.closest('.element-container')) {
                    this.controller.toggleSettingsVisibility();
                }
                // Don't close when clicking elsewhere
            }

            // 3. Inbox panel should NOT close when clicking on canvas or cards
            // Only remove this code or comment it out:
            /*
            if (!this.inboxPanel.contains(e.target) &&
                e.target !== this.inboxToggle &&
                this.inboxPanel.style.display === 'block') {
                this.controller.toggleInboxVisibility();
            }
            */

            // 4. Priority panel should NOT close when clicking on canvas or cards,
            //    AND SPECIFICALLY NOT when clicking INSIDE the panel itself.
            // Replace the commented-out block above with this more robust check:
            if (this.prioritiesPanel &&
                this.prioritiesPanel.style.display === 'block' && // Panel is visible
                !e.target.closest('#priorities-panel') && // Click did NOT originate inside the panel
                e.target !== this.prioritiesToggle) { // Click was not on the toggle button

                // If the click was outside the panel and not on the toggle, close it.
                this.controller.togglePrioritiesVisibility();
            }

            // 5. Grid panel can still close when clicking elsewhere
            const gridPanel = document.getElementById('grid-panel');
            const gridToggle = document.getElementById('grid-toggle');
            if (gridPanel &&
                !gridPanel.contains(e.target) &&
                e.target !== gridToggle &&
                gridPanel.style.display === 'block') {
                gridPanel.style.display = 'none';
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

            // If we have an Arena image being dragged, show the drop zone
            if (this.arenaImageBeingDragged) {
                if (this.dropZoneIndicator) {
                    this.dropZoneIndicator.style.display = 'block';
                }
                return;
            }

            // Don't show drop zone for internal drags
            if (this.draggedElement) {
                if (this.dropZoneIndicator) {
                    this.dropZoneIndicator.style.display = 'none';
                }
                return;
            }

            // Don't show for inbox drags
            if (this.inboxDragTarget) {
                if (this.dropZoneIndicator) {
                    this.dropZoneIndicator.style.display = 'none';
                }
                return;
            }

            // Don't show for quick links
            if (e.dataTransfer.types.includes('application/quicklink')) {
                if (this.dropZoneIndicator) {
                    this.dropZoneIndicator.style.display = 'none';
                }
                return;
            }

            // Show for external files (like images)
            if (this.dropZoneIndicator) {
                this.dropZoneIndicator.style.display = 'block';
            }
        });

        // Hide drop zone when leaving the document
        document.addEventListener('dragleave', (e) => {
            if (e.relatedTarget === null || e.relatedTarget.nodeName === 'HTML') {
                if (this.dropZoneIndicator) {
                    this.dropZoneIndicator.style.display = 'none';
                }
            }
        });

        // In view.js - modify the drop event handler in setupImageDropZone()
document.addEventListener('drop', async (e) => {
    e.preventDefault();

    // Hide the drop zone indicator
    if (this.dropZoneIndicator) {
        this.dropZoneIndicator.style.display = 'none';
    }

    // Skip if it's an internal drag operation
    if (this.draggedElement || this.inboxDragTarget) return;

    // Get correct coordinates relative to the workspace
    const rect = this.workspace.getBoundingClientRect();
    const x = e.clientX - rect.left + this.workspace.scrollLeft; // Add scrollLeft
    const y = e.clientY - rect.top + this.workspace.scrollTop;  // Add scrollTop

    let handled = false;

    // Check if we have an arena image being dragged
    if (this.arenaImageBeingDragged) {
        OPTIMISM.log(`Arena image dropped, attempting to add: ${this.arenaImageBeingDragged}`);
        this.showLoading('Adding image from Are.na...');

        try {
            // Process and add the image from URL
            await this.controller.addImageFromUrl(this.arenaImageBeingDragged, x, y);
            OPTIMISM.log('Successfully added Arena image to canvas');
            handled = true;
        } catch (error) {
            OPTIMISM.logError('Error adding Arena image:', error);
            alert('Failed to add image from Are.na. Please try again.');
        } finally {
            this.hideLoading();
            this.arenaImageBeingDragged = null;
        }

        // If we've handled the Arena image, don't continue
        if (handled) return;
    }

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
                OPTIMISM.log('Successfully added dropped image file to canvas');
                handled = true;
                return; // Return immediately after successful handling
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
                OPTIMISM.log('Successfully added image from HTML source');
                handled = true;
                return; // Return immediately after successful handling
            } catch (error) {
                OPTIMISM.logError('Error adding image from HTML source:', error);
                // Continue to other methods if this fails
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
                    OPTIMISM.log('Successfully added base64 image');
                    handled = true;
                    return; // Return immediately after successful handling
                } catch (error) {
                    OPTIMISM.logError('Error adding base64 image:', error);
                    // Continue to other methods if this fails
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
                    OPTIMISM.log('Successfully added image from URL');
                    handled = true;
                    return; // Return immediately after successful handling
                } catch (error) {
                    OPTIMISM.logError('Error adding image from URL:', error);
                    // Don't show alert yet, wait until end
                } finally {
                    this.hideLoading();
                }
            } else {
                // Not obviously an image URL, but might be a dynamic image or an image
                // without a file extension. Try to fetch it anyway.
                this.showLoading();
                try {
                    await this.controller.addImageFromUrl(url, x, y);
                    OPTIMISM.log('Successfully added image from URL without extension');
                    handled = true;
                    return; // Return immediately after successful handling
                } catch (error) {
                    OPTIMISM.logError('URL does not appear to be an image:', error);
                    // Don't show alert yet, wait until end
                } finally {
                    this.hideLoading();
                }
            }
        }
    }

    // If we've tried everything and still couldn't process the drop, only then show error
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
                    <span class="shortcut-badge" title="Move to Inbox">9</span>
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

                // Only apply if an element is selected (text or image)
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

        // Set up alignment options
const alignOptions = document.querySelectorAll('.option-value[data-align]');

// Add click event listeners to each alignment option
alignOptions.forEach(option => {
    option.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent closing the panel

        // Only apply if an element is selected
        if (!this.model.selectedElement) return;

        // Get the selected alignment
        const align = option.dataset.align;

        // Update the element's style
        this.controller.updateElementStyle(this.model.selectedElement, { textAlign: align });

        // Update the UI to show which option is selected
        alignOptions.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
    });
});

const bgColorOptions = document.querySelectorAll('.option-value[data-bgcolor]');
        bgColorOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation(); // Prevent closing the panel

                // Only apply if an element is selected
                if (!this.model.selectedElement) return;

                // Get the selected background color
                const bgColor = option.dataset.bgcolor;

                // Update the element's style
                // This applies to BOTH text and image element containers
                this.controller.updateElementStyle(this.model.selectedElement, { cardBgColor: bgColor });

                // Update the UI to show which option is selected
                bgColorOptions.forEach(opt => opt.classList.remove('selected'));
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

    renderWorkspace() {
        OPTIMISM.log('Rendering workspace');
        // Clear workspace
        this.workspace.innerHTML = '';

        // Update breadcrumbs
        this.renderBreadcrumbs();

        // Update quick links
        this.renderQuickLinks();

        this.workspace.style.overflow = 'auto';

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
        });

        // Apply priority state to cards if needed - ENSURE THIS RUNS AFTER CARDS ARE CREATED
        if (this.model.priorityCards && this.model.priorityCards.length > 0) {
            OPTIMISM.log(`Applying priority borders to ${this.model.priorityCards.length} cards`);
            this.model.priorityCards.forEach(cardId => {
                const container = document.querySelector(`.element-container[data-id="${cardId}"]`);
                if (container) {
                    container.classList.add('has-priority-border');
                    OPTIMISM.log(`Applied priority border to card ${cardId}`);
                } else {
                    OPTIMISM.log(`Card ${cardId} not found in current view to apply priority border`);
                }
            });
        }

        // Update styles for locked cards
        this.updateLockedCardStyles();

        // Apply locked state to images if needed
        if (this.model.imagesLocked) {
            this.updateImagesLockState();
        }

        // Re-render the grid if it was visible
        // OPTIMISM.log(`renderWorkspace: Checking grid visibility. Model state isGridVisible = ${this.model.isGridVisible}`); // Keep logging for now
        // Use a slight delay to ensure DOM is stable after clearing/element rendering
        // and re-check the model state right before rendering.
        if (this.model.isGridVisible) {
            // Use setTimeout to defer slightly, allowing other DOM updates to potentially complete.
            // Re-check the model state *inside* the timeout as well, as a final safeguard.
            setTimeout(() => {
                if (this.model.isGridVisible) { // Double-check state
                    OPTIMISM.log('renderWorkspace (deferred): Rendering grid because model.isGridVisible is true.');
                    this.renderGrid();
                } else {
                    OPTIMISM.log('renderWorkspace (deferred): NOT rendering grid because model.isGridVisible became false.');
                }
            }, 0); // Using 0ms timeout defers execution until after the current call stack clears.
        }
        // Hide style panel when no element is selected
        if (!this.model.selectedElement) {
            this.stylePanel.style.display = 'none';
        }

        if (this.model.isSettingsVisible) {
            this.updateSettingsVisibility(true);
        } else if (this.model.isInboxVisible) {
            this.updateInboxVisibility(true);
        } else if (this.model.isPrioritiesVisible) {
            this.updatePrioritiesVisibility(true);
        }

        // Update undo/redo buttons
        this.updateUndoRedoButtons();

        // Update page title
        this.updatePageTitle();

        // --- FIX: Explicitly sync ALL panel visibilities after render ---
        this.syncAllPanelVisibilities();

        this.updateSpacerPosition(); // Position the spacer after rendering
        this.workspace.style.overflow = this.model.isArenaVisible ? 'hidden' : 'auto';
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

    // Apply background color class (NEW)
    container.classList.remove('card-bg-none', 'card-bg-yellow', 'card-bg-red'); // Clear previous
    if (elementData.style && elementData.style.cardBgColor) {
        const bgColor = elementData.style.cardBgColor;
        if (bgColor === 'yellow') {
            container.classList.add('card-bg-yellow');
        } else if (bgColor === 'red') {
            container.classList.add('card-bg-red');
        }
        // 'none' requires no class (defaults to transparent)
    }


    // Store autoSize flag if it exists
if (elementData.autoSize !== undefined) {
    container.dataset.autoSize = elementData.autoSize;
}

    // Store autoSize flag if it exists
    if (elementData.autoSize !== undefined) {
        container.dataset.autoSize = elementData.autoSize;
    }

    // Apply border if defined
    if (elementData.style && elementData.style.hasBorder) {
        container.classList.add('has-permanent-border');
    }

    // Check if this card is locked
    if (this.model.isCardLocked(elementData.id)) {
        container.classList.add('card-locked');
    }

    // Create the text editor (hidden by default)
    const textEditor = document.createElement('textarea');
    textEditor.className = 'text-element';
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

    // Apply text alignment if defined
    if (elementData.style && elementData.style.textAlign) {
        textEditor.classList.add(`align-${elementData.style.textAlign}`);
        textDisplay.classList.add(`align-${elementData.style.textAlign}`);
    } else {
        // Default to left alignment
        textEditor.classList.add('align-left');
        textDisplay.classList.add('align-left');
    }

    // Apply highlight if defined
    if (elementData.style && elementData.style.isHighlighted) {
        textEditor.classList.add('is-highlighted');
        textDisplay.classList.add('is-highlighted');
    }

    // Create resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';

    // Add auto-resizing capability to the text editor
    textEditor.addEventListener('input', () => {
        if (container.dataset.autoSize === 'true') {
            this.autoSizeElement(container, textEditor);
        }
    });

    textEditor.addEventListener('mousedown', (e) => {
        // Stop propagation to prevent the container's mousedown handler from firing
        e.stopPropagation();
    });

    textEditor.addEventListener('click', (e) => {
        // Stop propagation to prevent the container's click handler from firing
        e.stopPropagation();
    });

    textEditor.addEventListener('blur', async () => { // Make the handler async
        // Get the original element's text before any changes
        const element = this.model.findElement(elementData.id);
        // If element doesn't exist in model (e.g., during complex undo/redo), exit early
        if (!element) {
            OPTIMISM.log(`Blur event: Element ${elementData.id} not found in model.`);
            return;
        }

        const originalText = element ? element.text : '';
        const newText = textEditor.value;

        // Check if text is now empty (including whitespace-only)
        if (newText.trim() === '') {
            // The text is empty, delete the element
            this.controller.deleteElement(elementData.id);
            // No need to sync display for deleted element
            return;
        }
        let commandPromise = null;

        // Only create an undo command if the text actually changed
        if (originalText !== newText) {
            // Get current dimensions for potential size update
            const currentWidth = parseInt(container.style.width);
            const currentHeight = parseInt(container.style.height);

            // If auto-sizing was enabled, include dimensions in the update
            if (container.dataset.autoSize === 'true') {
                commandPromise = this.controller.updateElementWithUndo(elementData.id, {
                    text: newText,
                    width: currentWidth,
                    height: currentHeight,
                    autoSize: false // Turn off auto-sizing after first edit
                }, {
                    text: originalText,
                    width: elementData.width,
                    height: elementData.height,
                    autoSize: true
                });
            } else {
                commandPromise = this.controller.updateElementWithUndo(elementData.id, {
                    text: newText
                }, {
                    text: originalText
                });
            }
            try {
                await commandPromise; // Wait for the command to complete
            } catch (error) {
                OPTIMISM.logError(`Error executing update command on blur for ${elementData.id}:`, error);
                // Optionally handle error, maybe revert textarea?
            }
        }

        // Don't process if element was deleted due to empty text
        const elementStillExists = this.model.findElement(elementData.id);
        if (elementStillExists) {
            this.syncElementDisplay(elementData.id); // Call sync AFTER await
        }

        // Toggle visibility
        if (elementStillExists) { // Toggle visibility
            textEditor.style.display = 'none';
            const display = container?.querySelector('.text-display'); // Check if container exists
            if (display) display.style.display = 'block';
        }
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

        // --- START: Revised Offset Calculation ---
        const elementRect = container.getBoundingClientRect();
        this.elemOffsetX = e.clientX - elementRect.left;
        this.elemOffsetY = e.clientY - elementRect.top;
        // --- END: Revised Offset Calculation ---

        // Store original position (relative to workspace) for potential snap back
        // Keep using style.left/top or dataset.numX/Y here as they are relative to the workspace
        container.dataset.originalLeft = container.style.left;
        container.dataset.originalTop = container.style.top;

        container.classList.add('dragging');
        e.preventDefault(); // Prevent text selection, etc.
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

    // If this is a new element with auto-size enabled and text is blank,
    // we'll let the input handler take care of sizing it

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

    // Apply background color class (NEW)
    container.classList.remove('card-bg-none', 'card-bg-yellow', 'card-bg-red'); // Clear previous
    if (elementData.style && elementData.style.cardBgColor) {
        const bgColor = elementData.style.cardBgColor;
        if (bgColor === 'yellow') {
            container.classList.add('card-bg-yellow');
        } else if (bgColor === 'red') {
            container.classList.add('card-bg-red');
        }
        // 'none' requires no class (defaults to transparent)
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

        // Don't handle if image lock is on
        if (this.model.imagesLocked && elementData.type === 'image') return; // Added check for image lock

        // Don't handle if not left mouse button
        if (e.button !== 0) return;

        // Don't start drag when on resize handle
        if (e.target === resizeHandle) return;

        // Select the element but don't show style panel while dragging
        this.selectElement(container, elementData, true); // Pass true to indicate we're dragging

        this.draggedElement = container;
        this.model.selectedElement = elementData.id;

        // --- START: Revised Offset Calculation ---
        const elementRect = container.getBoundingClientRect();
        this.elemOffsetX = e.clientX - elementRect.left;
        this.elemOffsetY = e.clientY - elementRect.top;
        // --- END: Revised Offset Calculation ---

        // Store original position (relative to workspace) for potential snap back
        container.dataset.originalLeft = container.style.left;
        container.dataset.originalTop = container.style.top;

        container.classList.add('dragging');
        e.preventDefault(); // Prevent default image drag behavior
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

    if (this.model.isSettingsVisible) {
        this.controller.toggleSettingsVisibility();
    }

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

    // Set the correct text alignment option as selected
    let selectedAlign = 'left'; // Default
    if (elementData.style && elementData.style.textAlign) {
        selectedAlign = elementData.style.textAlign;
    }

    const alignOption = document.querySelector(`.option-value[data-align="${selectedAlign}"]`);
    if (alignOption) {
        alignOption.classList.add('selected');
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
    const lockOption = document.querySelector(`.option-value[data-lock="${isLocked ? 'true' : 'false'}"]`);
    if (lockOption) {
        lockOption.classList.add('selected');
    }

    // Set the correct background color option as selected (NEW)
        // Applies to both text and image containers
        let selectedBgColor = 'none'; // Default
        if (elementData.style && elementData.style.cardBgColor) {
            selectedBgColor = elementData.style.cardBgColor;
        }

        const bgColorOption = document.querySelector(`.option-value[data-bgcolor="${selectedBgColor}"]`);
        if (bgColorOption) {
            bgColorOption.classList.add('selected');
        }
}



    deselectAllElements() {
        document.querySelectorAll('.element-container.selected').forEach(el => {
            el.classList.remove('selected');
        });
        this.model.selectedElement = null;
    }

    // In view.js - full method with drag constraint changes
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
                const rect = this.workspace.getBoundingClientRect();
                const x = e.clientX - rect.left + this.workspace.scrollLeft; // Add scrollLeft
                const y = e.clientY - rect.top + this.workspace.scrollTop;  // Add scrollTop
                OPTIMISM.log(`Moving inbox card ${cardId} to canvas at position (${x}, ${y})`);
                this.controller.moveFromInboxToCanvas(cardId, x, y);
                this.isDraggingFromInbox = false;
                if (this.dropZoneIndicator) { this.dropZoneIndicator.style.display = 'none'; }
                e.stopPropagation();
            }
        }
    });

    // Add drop listener for removing quick links
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
        if (this.draggedElement) {
            const breadcrumbTarget = this.findBreadcrumbDropTarget(e);
            if (!breadcrumbTarget) {
                navControls.classList.add('nav-drag-highlight'); // Use a specific class if needed
            }
        }
         // Highlight for quick link removal (if needed)
        if (e.dataTransfer && e.dataTransfer.types.includes('application/quicklink')) {
            // You might add highlighting logic here if you bring back drag-to-remove
        }
    });

    navControls.addEventListener('dragleave', (e) => {
        e.preventDefault();
        if (!navControls.contains(e.relatedTarget)) {
            navControls.classList.remove('nav-drag-highlight');
        }
        // Clear highlight on quick links if needed
    });

    navControls.addEventListener('drop', (e) => {
        e.preventDefault();
        navControls.classList.remove('nav-drag-highlight');
        if (this.draggedElement) {
            const breadcrumbTarget = this.findBreadcrumbDropTarget(e);
            if (!breadcrumbTarget) {
                const draggedId = this.draggedElement.dataset.id;
                const element = this.model.findElement(draggedId);
                if (element) {
                    let title = "Untitled";
                    if (element.type === 'text' && element.text) { title = element.text.substring(0, 60); }
                    else if (element.type === 'image') { title = "Image"; }
                    OPTIMISM.log(`Adding ${draggedId} (${title}) as quick link`);
                    this.controller.addQuickLink(draggedId, title);
                     // Snap back dragged element
                     if (this.draggedElement.dataset.originalLeft && this.draggedElement.dataset.originalTop) {
                        this.draggedElement.style.left = this.draggedElement.dataset.originalLeft;
                        this.draggedElement.style.top = this.draggedElement.dataset.originalTop;
                    }
                }
            }
        }
        // Clear quick link highlights if needed
    });

    // In view.js, inside the setupDragListeners method

// In view.js -> setupDragListeners -> document.addEventListener('mousemove', ...)

// In view.js -> setupDragListeners -> document.addEventListener('mousemove', ...)

document.addEventListener('mousemove', (e) => {

     // Handle resizing
     if (this.resizingElement) {
        const elementType = this.resizingElement.dataset.type;
        if (this.model.imagesLocked && elementType === 'image') return;

        const deltaWidth = e.clientX - this.dragStartX;
        const deltaHeight = e.clientY - this.dragStartY;
        let newWidth, newHeight;

        // Determine minimum allowed size based on type
        const minAllowedWidth = (elementType === 'image') ? 50 : 30;
        const minAllowedHeight = (elementType === 'image') ? 50 : 30;
        newWidth = Math.max(minAllowedWidth, this.initialWidth + deltaWidth);
        newHeight = Math.max(minAllowedHeight, this.initialHeight + deltaHeight);

        // --- Apply workspace boundary constraint ---
        const workspaceWidth = this.workspace.clientWidth; // Use clientWidth for visible area
        const elementLeft = this.resizingElement.offsetLeft;
        const maxWidth = workspaceWidth - elementLeft - 1; // Subtract 1 to avoid potential rounding issues/scrollbar flicker
        newWidth = Math.min(newWidth, maxWidth);
        // --- End boundary constraint ---

        // Grid snapping logic for resizing
        if (this.model.isGridVisible) {
            const elementRect = this.resizingElement.getBoundingClientRect();
            const workspaceRect = this.workspace.getBoundingClientRect();
            const elementLeft = elementRect.left - workspaceRect.left;
            const elementTop = elementRect.top - workspaceRect.top;
            const rightEdge = elementLeft + newWidth;
            const bottomEdge = elementTop + newHeight;

            const vertLines = Array.from(document.querySelectorAll('.grid-line-vertical'));
            if (vertLines.length > 0) {
                vertLines.sort((a, b) => Math.abs(rightEdge - parseInt(a.style.left)) - Math.abs(rightEdge - parseInt(b.style.left)));
                const closestLine = vertLines[0];
                const lineX = parseInt(closestLine.style.left);
                if (Math.abs(rightEdge - lineX) < 10) { newWidth = lineX - elementLeft; }
            }

            // Add horizontal snapping for bottom edge during resize
            const horzLines = Array.from(document.querySelectorAll('.grid-line-horizontal'));
            if (horzLines.length > 0) {
                horzLines.sort((a, b) => Math.abs(bottomEdge - parseInt(a.style.top)) - Math.abs(bottomEdge - parseInt(b.style.top)));
                const closestLine = horzLines[0];
                const lineY = parseInt(closestLine.style.top);
                if (Math.abs(bottomEdge - lineY) < 10) { newHeight = lineY - elementTop; }
            }
        }

        this.resizingElement.style.width = `${newWidth}px`;
        this.resizingElement.style.height = `${newHeight}px`;
        return; // Return after handling resize
    }

    // --- Handle DRAGGING ---

    // --- Handle DRAGGING ---

    if (!this.draggedElement) return;

    // ... (Don't drag locked items check remains the same) ...
    if ((this.model.imagesLocked && this.draggedElement.dataset.type === 'image') ||
             (this.model.isCardLocked(this.draggedElement.dataset.id))) {
            return;
        }

    // --- Bring element to front temporarily during drag ---
    // Only do this if it's not already the highest (e.g., text elements)
    let originalZIndex = this.draggedElement.style.zIndex;
    if (this.draggedElement.dataset.type === 'image') {
        this.draggedElement.style.zIndex = '99'; // Max image z-index during drag
    } else {
        // Text elements are already high, maybe ensure they are highest?
        this.draggedElement.style.zIndex = '150'; // Temporarily higher than other text elements
    }

    // Calculate desired position relative to workspace (including scroll)
    const workspaceRect = this.workspace.getBoundingClientRect();
    let desiredRelativeX = e.clientX - workspaceRect.left - this.elemOffsetX + this.workspace.scrollLeft;
    let desiredRelativeY = e.clientY - workspaceRect.top - this.elemOffsetY + this.workspace.scrollTop;

    // --- Define allowed boundaries ---
    const minX_allowed = 0;
    const maxX_allowed = this.workspace.scrollWidth - this.draggedElement.offsetWidth;
    const minY_allowed = 0;

    // Constrain X position
    let finalX_style = Math.max(minX_allowed, Math.min(desiredRelativeX, maxX_allowed));
    // Constrain Y position ONLY by the top boundary during drag
    let finalY_style = Math.max(minY_allowed, desiredRelativeY);

    // Grid snapping (apply after initial constraints)
    if (this.model.isGridVisible) {
        const gridContainer = document.getElementById('grid-container');
        if (gridContainer) {
            // Vertical lines (affect X position) - ONLY SNAP LEFT EDGE
            const vertLines = gridContainer.querySelectorAll('.grid-line-vertical');
            vertLines.forEach(line => {
                const lineX = parseInt(line.style.left);
                // Snap left edge only
                if (Math.abs(finalX_style - lineX) < 10) { finalX_style = lineX; }
                // Right edge snapping removed
            });

            // Horizontal lines (affect Y position) - ONLY SNAP TOP EDGE
            const horzLines = gridContainer.querySelectorAll('.grid-line-horizontal');
            horzLines.forEach(line => {
                const lineY = parseInt(line.style.top);
                // Snap top edge only
                if (Math.abs(finalY_style - lineY) < 10) { finalY_style = lineY; }
                // Bottom edge snapping removed
            });

            // Re-apply minimum Y constraint *after* potential grid snapping
            finalY_style = Math.max(minY_allowed, finalY_style);
        }
    }

    // Update element style and data attributes
    this.draggedElement.style.left = `${finalX_style}px`;
    this.draggedElement.style.top = `${finalY_style}px`;
    this.draggedElement.dataset.numX = finalX_style;
    this.draggedElement.dataset.numY = finalY_style;

    // Highlight potential drop targets
     // Restore original z-index after position calculation but before highlight logic
     // This prevents flickering issues with drop target detection
     if (this.draggedElement.dataset.type === 'image') {
         this.draggedElement.style.zIndex = originalZIndex || '1'; // Restore or default
     } else {
         this.draggedElement.style.zIndex = originalZIndex || '100'; // Restore or default for text
     }

    this.handleDragOver(e);
});

    // In view.js -> setupDragListeners -> document.addEventListener('mouseup', ...)

document.addEventListener('mouseup', (e) => {
    // Handle end of resizing
    if (this.resizingElement) {
        const elementType = this.resizingElement.dataset.type;
        // Prevent resize finalization if images locked and it's an image
        if (!(this.model.imagesLocked && elementType === 'image')) {
            const id = this.resizingElement.dataset.id;
            const width = parseFloat(this.resizingElement.style.width);
            const height = parseFloat(this.resizingElement.style.height);
            OPTIMISM.log(`Resize complete for element ${id}: ${width}x${height}`);
            this.controller.updateElement(id, { width, height });
        } else {
             OPTIMISM.log(`Resize cancelled for locked image ${this.resizingElement.dataset.id}`);
             // Optionally revert size here if needed, though updateElement won't be called
        }
        this.resizingElement = null; // Always reset resizing state
        return; // Exit after handling resize
    }

    // Handle end of dragging
    if (!this.draggedElement) return; // Exit if not dragging

    // --- START: Moved Highlight Cleanup ---
    // Clear visual drop indicators *immediately* upon mouseup, before any drop logic
    document.querySelectorAll('.drag-over, .drag-highlight').forEach(el => {
        el.classList.remove('drag-over');
        el.classList.remove('drag-highlight');
    });
    const navControls = document.getElementById('nav-controls'); // Ensure navControls is accessible here
    if (navControls) { // Add check in case it doesn't exist
         navControls.classList.remove('nav-drag-highlight');
    }
    // --- END: Moved Highlight Cleanup ---

    // Get dragged element info
    const draggedId = this.draggedElement.dataset.id;
    const isImage = this.draggedElement.dataset.type === 'image';

    // Check locks *after* clearing highlights but before processing drop
    if ((this.model.imagesLocked && isImage) ||
         this.model.isCardLocked(draggedId)) {
        // If locked, just reset dragging state and exit
        this.draggedElement.classList.remove('dragging');
        this.draggedElement = null;
        OPTIMISM.log(`Drag cancelled for locked element ${draggedId}`);
        return;
    }

    // Update z-index for dropped images
    if (isImage) {
        const newZIndex = this.findHighestImageZIndex() + 1;
        const cappedZIndex = Math.min(newZIndex, 99);
        this.draggedElement.style.zIndex = cappedZIndex;
         // Note: updateElement below will save this zIndex if not dropped on target
    }

    // Determine drop target
    const breadcrumbTarget = this.findBreadcrumbDropTarget(e);
    const quickLinksTarget = this.isOverQuickLinksArea(e);

    let droppedOnTarget = false; // Flag to check if dropped on a specific target

    if (breadcrumbTarget) {
        droppedOnTarget = true;
        const navIndex = parseInt(breadcrumbTarget.dataset.index);
        OPTIMISM.log(`Element ${draggedId} dropped onto breadcrumb at index ${navIndex}`);
        this.deselectAllElements(); // Deselect before moving
        this.controller.moveElementToBreadcrumb(draggedId, navIndex);
        // Controller action handles re-render
    } else if (quickLinksTarget) {
        droppedOnTarget = true;
         const element = this.model.findElement(draggedId);
         if (element) {
             let title = "Untitled";
             if (element.type === 'text' && element.text) { title = element.text.substring(0, 60); }
             else if (element.type === 'image') { title = "Image"; }
             OPTIMISM.log(`Adding ${draggedId} (${title}) as quick link`);
             this.controller.addQuickLink(draggedId, title);
             // Snap back dragged element visually (model state is handled)
             if (this.draggedElement.dataset.originalLeft && this.draggedElement.dataset.originalTop) {
                 this.draggedElement.style.left = this.draggedElement.dataset.originalLeft;
                 this.draggedElement.style.top = this.draggedElement.dataset.originalTop;
             }
         }
    } else {
        // Check for dropping onto another element (nesting)
        const dropTarget = !this.model.isNestingDisabled ? this.findDropTarget(e) : null;
        if (dropTarget && dropTarget !== this.draggedElement) {
            droppedOnTarget = true;
            const targetId = dropTarget.dataset.id;
            OPTIMISM.log(`Element ${draggedId} dropped onto ${targetId}`);
            this.deselectAllElements(); // Deselect before moving
            this.controller.moveElement(draggedId, targetId);
            // Controller action handles re-render
        }
    }

    // If not dropped on any specific target, just update its position
    if (!droppedOnTarget) {
        const newX = parseFloat(this.draggedElement.style.left);
        const newY = parseFloat(this.draggedElement.style.top);
        OPTIMISM.log(`Element ${draggedId} moved to position (${newX}, ${newY})`);
        const updateProps = { x: newX, y: newY };
        // Include zIndex update for images moved freely
        if (isImage) {
            updateProps.zIndex = parseInt(this.draggedElement.style.zIndex) || 1;
        }
        this.controller.updateElement(draggedId, updateProps);
        // Controller action might handle re-render depending on implementation
    }

    // --- Final Drag State Reset ---
    // Reset the dragging class and the state variable
    // Check if draggedElement still exists (it might be null if moveElement caused immediate re-render)
    if (this.draggedElement) {
        this.draggedElement.classList.remove('dragging');
    }
    this.draggedElement = null; // Reset state variable *last*
    // --- End Final Drag State Reset ---

    // Always update spacer position after any mouseup that involved dragging
    this.updateSpacerPosition();
});

    OPTIMISM.log('Drag listeners set up successfully');
}


// In view.js

handleDragOver(e) {
    // --- START: Unconditional Cleanup ---
    // Clear ALL potential highlight classes from ALL relevant elements on every mouse move.
    // This is the most crucial part to fix the lingering border.
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    document.querySelectorAll('.drag-highlight').forEach(el => el.classList.remove('drag-highlight'));
    const navControls = document.getElementById('nav-controls');
    if (navControls) navControls.classList.remove('nav-drag-highlight'); // Example if you use this class

    // Clear quick link placeholder highlight specifically
    const quickLinkPlaceholder = this.quickLinksContainer?.querySelector('.quick-link-placeholder');
    if (quickLinkPlaceholder) quickLinkPlaceholder.classList.remove('drag-highlight');
    // Clear all quick link highlights specifically
     this.quickLinksContainer?.querySelectorAll('.quick-link').forEach(link => link.classList.remove('drag-highlight'));
     // Clear breadcrumb highlights specifically
     this.breadcrumbContainer?.querySelectorAll('.breadcrumb-item').forEach(item => item.classList.remove('drag-highlight'));

    // --- END: Unconditional Cleanup ---


    // --- START: Add Highlight ONLY if Target Found ---

    // 1. Check for Breadcrumb Targets
    const breadcrumbTarget = this.findBreadcrumbDropTarget(e);
    if (breadcrumbTarget) {
        breadcrumbTarget.classList.add('drag-highlight');
        return; // Target found, exit
    }

    // 2. Check for Quick Links Area Target
    if (this.isOverQuickLinksArea(e)) {
        if (this.quickLinksContainer) {
            if (quickLinkPlaceholder) {
                quickLinkPlaceholder.classList.add('drag-highlight');
            } else {
                this.quickLinksContainer.querySelectorAll('.quick-link').forEach(link => {
                    link.classList.add('drag-highlight');
                });
            }
        }
        return; // Target found, exit
    }

    // 3. Check for Element Target (Nesting)
    if (!this.model.isNestingDisabled) {
        const dropTarget = this.findDropTarget(e);
        if (dropTarget && dropTarget !== this.draggedElement) {
            dropTarget.classList.add('drag-over'); // Apply dashed border
            // No return needed here, as this is the last check
        }
        // If no valid dropTarget element is found, no 'drag-over' class is added.
    }

    // --- END: Add Highlight ONLY if Target Found ---
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

             // Skip if nesting is disabled
             if (this.model.isNestingDisabled) {
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

// In view.js, replace the setupSettingsPanel method
setupSettingsPanel() {
    OPTIMISM.log('Setting up settings panel');

    // Toggle settings panel visibility when settings button is clicked
    this.settingsToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        this.controller.toggleSettingsVisibility();
    });

    // Create Grid Settings option
    const gridSettingsOption = document.createElement('div');
    gridSettingsOption.className = 'settings-option';
    gridSettingsOption.innerHTML = '<a href="#" class="option-value" id="settings-grid-button">Grid Settings</a>';

    // Find the redo button
    const redoButton = document.getElementById('settings-redo-button');
    if (redoButton && redoButton.parentElement) {
        // Insert after redo button
        const nextElement = redoButton.parentElement.nextElementSibling;

        // Create "Copy Link" option
        const copyLinkOption = document.createElement('div');
        copyLinkOption.className = 'settings-option';
        copyLinkOption.innerHTML = '<a href="#" class="option-value" id="settings-copy-link-button">Copy Link</a>';

        // Create "Lock Images" option
        const lockImagesOption = document.createElement('div');
        lockImagesOption.className = 'settings-option';
        lockImagesOption.innerHTML = '<a href="#" class="option-value" id="settings-lock-images-button">' +
            (this.model.imagesLocked ? 'Unlock Images' : 'Lock Images') + '</a>';

        // Add the new options after redo button
        if (nextElement) {
            this.settingsPanel.insertBefore(lockImagesOption, nextElement);
            this.settingsPanel.insertBefore(copyLinkOption, lockImagesOption);
            this.settingsPanel.insertBefore(gridSettingsOption, copyLinkOption);
        } else {
            this.settingsPanel.appendChild(copyLinkOption);
            this.settingsPanel.appendChild(lockImagesOption);
            this.settingsPanel.appendChild(gridSettingsOption);
        }

        // Add the nesting disable option
        const disableNestingOption = document.createElement('div');
        disableNestingOption.className = 'settings-option';
        disableNestingOption.innerHTML = '<a href="#" class="option-value" id="settings-disable-nesting-button">' +
            (this.model.isNestingDisabled ? 'Enable Nesting' : 'Disable Nesting') + '</a>';

        // Add the new option after lockImagesOption
        if (nextElement) {
            this.settingsPanel.insertBefore(disableNestingOption, lockImagesOption.nextSibling);
        } else {
            this.settingsPanel.appendChild(disableNestingOption);
        }

        // Add the event listener for the new button
        document.getElementById('settings-disable-nesting-button')?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggleNestingDisabled();
        });

        // Set up event handlers for the new options
        document.getElementById('settings-copy-link-button')?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            navigator.clipboard.writeText(window.location.href)
                .then(() => {
                    OPTIMISM.log('URL copied to clipboard');
                })
                .catch(err => {
                    OPTIMISM.logError('Could not copy URL:', err);
                });
        });

        document.getElementById('settings-lock-images-button')?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggleImagesLocked();
        });
    } else {
        // If we can't find the redo button, just add it to the settings panel
        this.settingsPanel.appendChild(gridSettingsOption);
    }

    // Set up event handlers for all settings options
    document.getElementById('settings-undo-button')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.controller.undo();
    });

    document.getElementById('settings-redo-button')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.controller.redo();
    });

    // Add click event for grid settings button
    document.getElementById('settings-grid-button')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Show the grid panel
        const gridPanel = document.getElementById('grid-panel');
        if (gridPanel) {
            // Close other panels
            this.stylePanel.style.display = 'none';
            this.settingsPanel.style.display = 'none';

            // Toggle grid panel visibility
            const isVisible = gridPanel.style.display === 'block';
            gridPanel.style.display = isVisible ? 'none' : 'block';

            // Update selection states if showing
            if (!isVisible) {
                this.updateGridVisibility(this.model.isGridVisible);
                this.updateGridLayoutSelection(this.model.gridLayout);
            }
        }
    });

    document.getElementById('settings-export-button')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.controller.exportData();
    });

    document.getElementById('settings-export-no-images-button')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.controller.exportDataWithoutImages();
    });

    document.getElementById('settings-import-button')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.confirmationDialog.style.display = 'block';
    });

    document.getElementById('settings-debug-toggle')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.controller.toggleDebugPanel();
    });

    document.getElementById('settings-theme-toggle')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.controller.toggleTheme();
    });

    // Set initial visibility based on model state
    this.updateSettingsVisibility(this.model.isSettingsVisible);

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

setupLockImagesToggle() {
    OPTIMISM.log('Setting up lock images toggle');

    // Note: We're not creating the button here anymore since it's in the settings panel
    // But we still need to store a reference to the button for updating later
    this.lockImagesButton = document.getElementById('settings-lock-images-button');

    OPTIMISM.log('Lock images toggle set up successfully');
}

toggleImagesLocked() {
    this.controller.toggleImagesLocked().then(isLocked => {
        // Update the button text in the settings panel
        const settingsButton = document.getElementById('settings-lock-images-button');
        if (settingsButton) {
            settingsButton.textContent = isLocked ? "Unlock Images" : "Lock Images";
        }

        this.updateImagesLockState();
    });
}

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

    // Update the button text in settings panel
    const settingsButton = document.getElementById('settings-lock-images-button');
    if (settingsButton) {
        settingsButton.textContent = imagesLocked ? "Unlock Images" : "Lock Images";
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
        border: 1px dashed var(--element-border-color) !important;
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
        placeholderText.textContent = 'Drag cards here to hold for a lil while';
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
                const y = e.clientY - rect.top + this.workspace.scrollTop; // Add scrollTop

                OPTIMISM.log(`Moving inbox card ${cardId} to canvas at position (${x}, ${y})`);
                this.controller.moveFromInboxToCanvas(cardId, x, y);
            }
        }
    });

    OPTIMISM.log('Inbox panel set up successfully');
}

// In view.js, modify the updateInboxVisibility method
updateInboxVisibility(isVisible) {
    if (!this.inboxPanel) {
        this.setupInboxPanel();
        return;
    }

    if (isVisible) {
        // --- Add check for Arena view ---
        if (this.model.isArenaVisible) {
            OPTIMISM.log('Arena view is active, preventing inbox panel from showing.');
            this.inboxPanel.style.display = 'none'; // Ensure it's hidden
            return; // Do not proceed to show
        }
        // --- End check ---
        // Close other LEFT-SIDE panels only
        if (this.prioritiesPanel) {
            this.prioritiesPanel.style.display = 'none';
        }

        // Don't close right-side panels
        // this.stylePanel.style.display = 'none';
        // this.settingsPanel.style.display = 'none';

        // CRITICAL: Apply direct forceful styling to ensure inbox appears above everything
        this.inboxPanel.style.display = 'block';
        this.inboxPanel.style.zIndex = '1000'; // Use a very high z-index
        this.inboxPanel.style.position = 'fixed';
        this.inboxPanel.style.top = '41px';
        this.inboxPanel.style.left = '0'; // Now on the left
        this.inboxPanel.style.right = 'auto';

        this.inboxPanel.style.width = 'var(--panel-width)';

        // Render content
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
        cardElement.style.backgroundColor = 'var(--canvas-bg-color)'; // Match workspace bg

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
            // Ensure this runs asynchronously without blocking the rest of the render
            (async () => {
                try {
                    const imageData = await this.model.getImageData(card.imageDataId);
                    if (imageData) {
                        img.src = imageData;
                    } else {
                        img.alt = 'Image not found';
                        OPTIMISM.logError(`Image data not found for inbox card ${card.id}`);
                    }
                } catch (error) {
                    OPTIMISM.logError(`Error loading image for inbox card ${card.id}:`, error);
                    img.alt = 'Error loading image';
                }
            })(); // Immediately invoke the async function
            /* Old synchronous way:
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
            */

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
        e.preventDefault();

        // Get the inbox card element that was dragged (if any)
        const inboxCard = e.target.closest && e.target.closest('.inbox-card');
        if (inboxCard) {
            const cardId = inboxCard.dataset.id;
            if (cardId) {
                // Get position relative to workspace
                const rect = this.workspace.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top + this.workspace.scrollTop; // Add scrollTop


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

    // We'll remove the grid toggle button from the nav bar
    // and add it to settings panel instead

    // Set up grid on/off options
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

    // Set up the row and column input controls
    this.setupGridInputControls();

    // Set initial selection states
    this.updateGridVisibility(this.model.isGridVisible);
    this.updateGridInputValues();

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
    const workspaceWidth = this.workspace.scrollWidth; // Use scrollWidth for full content width
    const workspaceHeight = this.workspace.scrollHeight; // Use scrollHeight for full content height
    gridContainer.style.width = `${workspaceWidth}px`; // Size container to full width
    gridContainer.style.height = `${workspaceHeight}px`; // Size container to full height
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
            // Close other RIGHT-SIDE panels only
            this.stylePanel.style.display = 'none';
            this.settingsPanel.style.display = 'none';

            // Don't close left-side panels
            // if (this.inboxPanel) {
            //     this.inboxPanel.style.display = 'none';
            // }
            // if (this.prioritiesPanel) {
            //     this.prioritiesPanel.style.display = 'none';
            // }

            // Update selection states to reflect current settings
            this.updateGridVisibility(this.model.isGridVisible);
            this.updateGridLayoutSelection(this.model.gridLayout);
        }

        OPTIMISM.log(`Grid panel visibility set to: ${!isVisible}`);
    }
}

setupGridInputControls() {
    // Get all decrease buttons for rows and columns
    const decreaseButtons = document.querySelectorAll('.grid-btn-decrease');
    decreaseButtons.forEach((btn, index) => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Determine if we're changing rows or columns (index 0 = rows, index 1 = columns)
            const isRows = index === 0;

            // Get current layout
            const [rows, columns] = this.model.gridLayout.split('x').map(num => parseInt(num, 10));

            // Calculate new values with minimum of 1
            let newRows = rows;
            let newColumns = columns;

            if (isRows) {
                newRows = Math.max(1, rows - 1);
            } else {
                newColumns = Math.max(1, columns - 1);
            }

            // Set new layout if changed
            if (newRows !== rows || newColumns !== columns) {
                const newLayout = `${newRows}x${newColumns}`;
                this.controller.setGridLayout(newLayout);
            }
        });
    });

    // Get all increase buttons for rows and columns
    const increaseButtons = document.querySelectorAll('.grid-btn-increase');
    increaseButtons.forEach((btn, index) => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Determine if we're changing rows or columns (index 0 = rows, index 1 = columns)
            const isRows = index === 0;

            // Get current layout
            const [rows, columns] = this.model.gridLayout.split('x').map(num => parseInt(num, 10));

            // Calculate new values with maximums (5 for rows, 10 for columns)
            let newRows = rows;
            let newColumns = columns;

            if (isRows) {
                newRows = Math.min(40, rows + 1);
            } else {
                newColumns = Math.min(60, columns + 1);
            }

            // Set new layout if changed
            if (newRows !== rows || newColumns !== columns) {
                const newLayout = `${newRows}x${newColumns}`;
                this.controller.setGridLayout(newLayout);
            }
        });
    });
}

updateGridInputValues() {
    // Get the current grid layout
    const [rows, columns] = this.model.gridLayout.split('x').map(num => parseInt(num, 10));

    // Update the display values
    const rowsValue = document.getElementById('grid-rows-value');
    const columnsValue = document.getElementById('grid-columns-value');

    if (rowsValue) rowsValue.textContent = rows;
    if (columnsValue) columnsValue.textContent = columns;
}

// In view.js - Update the updateSplitViewLayout method to add the resizable border
// In view.js - Update the updateSplitViewLayout method to add the resizable border
// In view.js - Update the updateSplitViewLayout method
updateSplitViewLayout(isEnabled) {
    OPTIMISM.log(`VIEW: updateSplitViewLayout called with isEnabled = ${isEnabled}`);
    isEnabled = Boolean(isEnabled);
    OPTIMISM.log(`VIEW: Converted isEnabled to ${isEnabled}`);
    OPTIMISM.log(`VIEW: Current rightViewport exists: ${Boolean(this.rightViewport)}`);

    if (!isEnabled && this.rightViewport) {
        OPTIMISM.log('VIEW: Removing split view...');
        this.rightViewport.remove();
        this.rightViewport = null;
        if (this.resizeDivider) { this.resizeDivider.remove(); this.resizeDivider = null; }

        // CHANGE: Restore original workspace positioning and width
        this.workspace.style.left = 'var(--panel-width)';
        this.workspace.style.width = 'calc(100vw - 2 * var(--panel-width))';
        this.workspace.style.position = 'absolute'; // Ensure it's absolute
        this.workspace.style.overflow = 'auto'; // ADDED: Restore overflow to 'auto'

        this.renderWorkspace();
        if (this.model.isInboxVisible) { setTimeout(() => { this.updateInboxVisibility(true); }, 10); }
        OPTIMISM.log('VIEW: Split view removed successfully');
        return;
    }

    if (isEnabled && !this.rightViewport) {
        OPTIMISM.log('VIEW: Creating split view...');
        const splitPosition = 50;

        // CHANGE: Set workspace to left: 0 for split view
        this.workspace.style.left = '0';
        this.workspace.style.width = `${splitPosition}%`;
        this.workspace.style.position = 'absolute'; // Keep absolute
        this.workspace.style.overflow = 'hidden';

        try {
            // Create the resizable divider
            this.resizeDivider = document.createElement('div');
            this.resizeDivider.id = 'resize-divider';
            this.resizeDivider.style.position = 'fixed';
            this.resizeDivider.style.top = '41px';
            this.resizeDivider.style.bottom = '0';
            this.resizeDivider.style.width = '10px';
            this.resizeDivider.style.left = `calc(${splitPosition}% - 5px)`; // Adjust based on left edge = 0
            this.resizeDivider.style.cursor = 'col-resize';
            this.resizeDivider.style.zIndex = '160';
            this.resizeDivider.innerHTML = '<div style="position: absolute; top: 0; bottom: 0; left: 5px; width: 1px; background-color: var(--element-border-color);"></div>';

            // Create the right viewport container
            this.rightViewport = document.createElement('div');
            this.rightViewport.id = 'right-viewport';
            this.rightViewport.className = 'viewport';
            this.rightViewport.style.position = 'fixed';
            this.rightViewport.style.top = '41px';
            this.rightViewport.style.left = `${splitPosition}%`; // Position relative to the left edge
            this.rightViewport.style.width = `${100 - splitPosition}%`;
            this.rightViewport.style.height = 'calc(100vh - 41px)'; // Correct height calc
            this.rightViewport.style.right = 'auto'; // Don't use right positioning
            this.rightViewport.style.boxSizing = 'border-box';
            this.rightViewport.style.overflow = 'hidden';
            this.rightViewport.style.backgroundColor = 'var(--canvas-bg-color)'; // Match canvas bg
            this.rightViewport.style.zIndex = '150';

            // Add placeholder content
            this.rightViewportContent = document.createElement('div');
            this.rightViewportContent.className = 'right-viewport-content';
            this.rightViewportContent.style.display = 'flex';
            this.rightViewportContent.style.justifyContent = 'center';
            this.rightViewportContent.style.alignItems = 'center';
            this.rightViewportContent.style.width = '100%';
            this.rightViewportContent.style.height = '100%';
            this.rightViewportContent.style.color = 'var(--element-text-color)';
            this.rightViewportContent.style.opacity = '0.5';
            this.rightViewportContent.style.position = 'relative';
            this.rightViewportContent.textContent = 'Select a card to view contents';
            this.rightViewport.appendChild(this.rightViewportContent);

            this.addShadowToRightViewport();

            document.body.appendChild(this.resizeDivider);
            document.body.appendChild(this.rightViewport);
            this.setupResizeDivider(); // Call setup for the divider

            this.rightViewport.addEventListener('click', (e) => {
                if (e.target === this.rightViewport || e.target === this.rightViewportContent) {
                     if (this.model.previewNodeId) { this.controller.navigateToElement(this.model.previewNodeId); }
                }
            });

            this.ensurePanelZIndices();
            this.renderWorkspace();

            this.workspace.style.overflow = 'auto';
            OPTIMISM.log('VIEW: Split view created successfully');
        } catch (error) {
            OPTIMISM.logError('VIEW: Error creating split view:', error);
        }
    } else {
        OPTIMISM.log(`VIEW: No action needed. isEnabled=${isEnabled}, rightViewport exists=${Boolean(this.rightViewport)}`);
    }

    const splitViewToggle = document.getElementById('split-view-toggle');
    if (splitViewToggle) {
        const buttonText = isEnabled ? 'Hide Split View' : 'Show Split View';
        OPTIMISM.log(`VIEW: Updating button text to "${buttonText}"`);
        splitViewToggle.textContent = buttonText;
    } else {
        OPTIMISM.log('VIEW: Split view toggle button not found');
    }
}

// Add a method to update the right viewport content based on selected element
// Modify this method to ensure style updates are applied consistently
// Update this method to ensure the shadow is always present
updateRightViewport(selectedElementId) {
    if (!this.rightViewport || !this.model.isSplitViewEnabled) return;

    // Clear previous content
    this.rightViewportContent.innerHTML = '';

    // If no element is selected or the selected element is the same as the current node,
    // show placeholder
    if (!selectedElementId || selectedElementId === this.model.currentNode.parentId) {
        this.rightViewportContent.style.display = 'flex';
        this.rightViewportContent.style.justifyContent = 'center';
        this.rightViewportContent.style.alignItems = 'center';
        this.rightViewportContent.style.color = 'var(--element-text-color)';
        this.rightViewportContent.style.opacity = '0.5';
        this.rightViewportContent.textContent = 'Select a card to view contents';
        this.model.previewNodeId = null;

        // Ensure shadow is visible even with placeholder content
        this.addShadowToRightViewport();
        return;
    }

    // Check if the element has children
    if (!this.model.hasChildren(selectedElementId)) {
        this.rightViewportContent.style.display = 'flex';
        this.rightViewportContent.style.justifyContent = 'center';
        this.rightViewportContent.style.alignItems = 'center';
        this.rightViewportContent.style.color = 'var(--element-text-color)';
        this.rightViewportContent.style.opacity = '0.5';
        this.rightViewportContent.textContent = 'This card has no content';
        this.model.previewNodeId = null;

        // Ensure shadow is visible even with placeholder content
        this.addShadowToRightViewport();
        return;
    }

    // Get the child node data
    const childNode = this.model.currentNode.children[selectedElementId];
    if (!childNode) {
        this.rightViewportContent.textContent = 'Could not load content';
        this.model.previewNodeId = null;

        // Ensure shadow is visible even with error message
        this.addShadowToRightViewport();
        return;
    }

    // Store the preview node ID for later navigation
    this.model.previewNodeId = selectedElementId;

    // Reset content area styling
    this.rightViewportContent.style.display = 'block';
    this.rightViewportContent.style.justifyContent = 'normal';
    this.rightViewportContent.style.alignItems = 'normal';
    this.rightViewportContent.style.color = 'var(--element-text-color)';
    this.rightViewportContent.style.opacity = '1';

    // Render the child elements in the right viewport
    this.renderPreviewContent(childNode);
}

renderPreviewContent(node) {
    if (!node || !node.elements) {
        this.rightViewportContent.textContent = 'No content';
        this.addShadowToRightViewport(); // Ensure shadow is visible
        return;
    }

    // Clear the content area
    this.rightViewportContent.innerHTML = '';
    this.rightViewportContent.style.display = 'block';
    this.rightViewportContent.style.textAlign = 'left';
    this.rightViewportContent.style.position = 'relative';
    this.rightViewportContent.style.overflow = 'hidden';

    // Create a solid background first
    const background = document.createElement('div');
    background.style.position = 'absolute';
    background.style.top = '0';
    background.style.left = '0';
    background.style.right = '0';
    background.style.bottom = '0';
    background.style.backgroundColor = 'var(--bg-color)';
    background.style.zIndex = '0';
    this.rightViewportContent.appendChild(background);

    // Create a container for the elements
    const elementsContainer = document.createElement('div');
    elementsContainer.style.position = 'relative';
    elementsContainer.style.width = '100%';
    elementsContainer.style.height = '100%';
    elementsContainer.style.zIndex = '1';

    // Sort elements: images before text
    const sortedElements = [...node.elements].sort((a, b) => {
        if (a.type === 'image' && b.type === 'text') return -1;
        if (a.type === 'text' && b.type === 'image') return 1;
        if (a.type === 'image' && b.type === 'image') {
            return (a.zIndex || 1) - (b.zIndex || 1);
        }
        return 0;
    });

    // Create a preview version of each element
    sortedElements.forEach(element => {
        try {
            const container = document.createElement('div');
            container.className = 'preview-element-container';
            container.dataset.id = element.id;
            container.dataset.type = element.type;
            container.style.position = 'absolute';
            container.style.left = `${element.x}px`;
            container.style.top = `${element.y}px`;
            container.style.width = `${element.width || 200}px`;
            container.style.height = `${element.height || 100}px`;

            // Make elements clickable but without drag capability
            container.style.pointerEvents = 'auto';
            container.style.cursor = 'pointer';

            // Add click handler for navigation
            container.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent triggering the viewport click

                // If we have a preview node, navigate to it (one level down)
                if (this.model.previewNodeId) {
                    // Navigate to the current preview node (parent of this element)
                    this.controller.navigateToElement(this.model.previewNodeId);

                    // After navigating, select this element to preview its contents (if it has any)
                    if (this.model.hasChildren(element.id)) {
                        // Find the element in the left viewport
                        setTimeout(() => {
                            const leftViewportElement = document.querySelector(`.element-container[data-id="${element.id}"]`);
                            if (leftViewportElement) {
                                // Get the element data
                                const elemData = this.model.findElement(element.id);
                                if (elemData) {
                                    // Select it to trigger the preview
                                    this.selectElement(leftViewportElement, elemData);
                                }
                            }
                        }, 100);
                    }
                }
            });

            // Add visual indicator for cards with children
            if (this.model.hasChildren(element.id)) {
                container.classList.add('has-children');

                // For all elements with children, apply the underline style directly
                container.style.textDecoration = 'underline';
            }

            if (element.type === 'text') {
                // Create text content
                const textDisplay = document.createElement('div');
                textDisplay.className = 'preview-text-display';
                textDisplay.style.width = '100%';
                textDisplay.style.height = '100%';
                textDisplay.style.overflow = 'auto';
                textDisplay.style.padding = '8px';
                textDisplay.style.boxSizing = 'border-box';
                textDisplay.style.color = 'var(--element-text-color)';
                textDisplay.style.fontSize = '14px'; // Default size
                textDisplay.style.backgroundColor = 'transparent';

                // Apply text styling
                if (element.style) {
                    // Text size
                    if (element.style.textSize === 'large') {
                        textDisplay.style.fontSize = '24px';
                    } else if (element.style.textSize === 'huge') {
                        textDisplay.style.fontSize = '36px';
                        textDisplay.style.fontWeight = 'bold';
                    }

                    // Text color
                    if (element.style.textColor === 'red') {
                        textDisplay.style.color = 'var(--red-text-color)';
                    } else if (element.style.textColor === 'green') {
                        textDisplay.style.color = 'var(--green-text-color)';
                    }

                    // Header formatting
                    if (element.style.hasHeader) {
                        textDisplay.innerHTML = this.formatTextWithHeader(element.text || '', true);
                        textDisplay.classList.add('has-header');
                    } else {
                        textDisplay.innerHTML = this.convertUrlsToLinks(element.text || '');
                    }

                    // Highlight
                    if (element.style.isHighlighted) {
                        textDisplay.classList.add('is-highlighted');
                    }

                    // Border
                    if (element.style.hasBorder) {
                        container.style.border = '1px solid var(--element-border-color)';
                    }
                } else {
                    textDisplay.innerHTML = this.convertUrlsToLinks(element.text || '');
                }

                // If this element has children, also apply underline to the text display
                if (this.model.hasChildren(element.id)) {
                    textDisplay.classList.add('has-children');
                    textDisplay.style.textDecoration = 'underline';
                }

                container.appendChild(textDisplay);
            } else if (element.type === 'image') {
                // Create image preview
                const image = document.createElement('img');
                image.className = 'preview-image';
                image.style.width = '100%';
                image.style.height = '100%';
                image.style.objectFit = 'contain';

                // Load image data
                this.model.getImageData(element.imageDataId)
                    .then(imageData => {
                        if (imageData) {
                            image.src = imageData;
                        } else {
                            image.alt = 'Image not found';
                        }
                    })
                    .catch(error => {
                        OPTIMISM.logError(`Error loading preview image: ${error}`);
                        image.alt = 'Error loading image';
                    });

                container.appendChild(image);
            }

            elementsContainer.appendChild(container);
        } catch (error) {
            OPTIMISM.logError(`Error rendering preview element: ${error}`);
        }
    });

    this.rightViewportContent.appendChild(elementsContainer);

    // Apply global styles to ensure consistent styling for nested content
    this.updateRightPaneNestedItemStyles();

    // Use our helper method to ensure the shadow is always present
    this.addShadowToRightViewport();
}

// Add a method to ensure panels have the proper z-index
ensurePanelZIndices() {
    // Make sure all panels have a z-index higher than the right viewport and Arena
    const panelZIndex = 250; // Higher than right viewport's 150 and Arena's 150

    // Style panel
    if (this.stylePanel) {
        this.stylePanel.style.zIndex = panelZIndex;
    }

    // Settings panel
    if (this.settingsPanel) {
        this.settingsPanel.style.zIndex = panelZIndex;
    }

    // Inbox panel
    if (this.inboxPanel) {
        this.inboxPanel.style.zIndex = panelZIndex;
    }

    // Grid panel
    const gridPanel = document.getElementById('grid-panel');
    if (gridPanel) {
        gridPanel.style.zIndex = panelZIndex;
    }

    // Confirmation dialog
    const confirmationDialog = document.getElementById('confirmation-dialog');
    if (confirmationDialog) {
        confirmationDialog.style.zIndex = panelZIndex + 100; // Even higher
    }

    // Backup reminder modal
    const backupReminderModal = document.getElementById('backup-reminder-modal');
    if (backupReminderModal) {
        backupReminderModal.style.zIndex = panelZIndex + 100; // Even higher
    }
}

// Add a method to set up the resize functionality
// In view.js
setupResizeDivider() {
    if (!this.resizeDivider) return;

    let isDragging = false;
    let startX = 0;
    // CHANGE: Store percentage directly
    let startLeftPercent = 0;

    const getWindowWidth = () => window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;

    this.resizeDivider.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        // CHANGE: Get current percentage
        startLeftPercent = parseFloat(this.workspace.style.width);

        document.body.classList.add('resizing-split-view');
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const deltaX = e.clientX - startX;
        const windowWidth = getWindowWidth();
        // CHANGE: Calculate delta percentage
        const deltaPercent = (deltaX / windowWidth) * 100;

        let newLeftPercent = startLeftPercent + deltaPercent;
        // Apply constraints (minimum 25% for each side)
        newLeftPercent = Math.max(25, Math.min(75, newLeftPercent));

        // Update viewport widths and divider position using percentages
        this.workspace.style.width = `${newLeftPercent}%`;
        // Check if rightViewport exists before styling
        if (this.rightViewport) {
            this.rightViewport.style.left = `${newLeftPercent}%`; // Update right viewport left pos
            this.rightViewport.style.width = `${100 - newLeftPercent}%`;
        }
        this.resizeDivider.style.left = `calc(${newLeftPercent}% - 5px)`;
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            document.body.classList.remove('resizing-split-view');
            document.body.style.userSelect = '';
            // Re-rendering might still be useful if content inside needs recalculating
            // this.renderWorkspace();
        }
    });

    // Add hover effects
    this.resizeDivider.addEventListener('mouseenter', () => {
        const line = this.resizeDivider.querySelector('div');
        if (line) { line.style.backgroundColor = 'var(--link-color)'; line.style.width = '2px'; line.style.left = '4px'; }
    });
    this.resizeDivider.addEventListener('mouseleave', () => {
        const line = this.resizeDivider.querySelector('div');
        if (line) { line.style.backgroundColor = 'var(--element-border-color)'; line.style.width = '1px'; line.style.left = '5px'; }
    });
}

autoSizeElement(container, textarea) {
    // First, create a hidden div to measure text dimensions
    let measurer = document.getElementById('text-size-measurer');
    if (!measurer) {
        measurer = document.createElement('div');
        measurer.id = 'text-size-measurer';
        measurer.style.position = 'absolute';
        measurer.style.visibility = 'hidden';
        measurer.style.height = 'auto';
        measurer.style.width = 'auto';
        measurer.style.whiteSpace = 'pre-wrap';
        measurer.style.padding = '8px'; // Match textarea padding
        measurer.style.boxSizing = 'border-box';
        measurer.style.overflow = 'hidden';
        document.body.appendChild(measurer);
    }

    // Copy styling from the textarea to the measurer
    const computedStyle = window.getComputedStyle(textarea);

    measurer.style.fontFamily = computedStyle.fontFamily;
    measurer.style.fontSize = computedStyle.fontSize;
    measurer.style.fontWeight = computedStyle.fontWeight;
    measurer.style.lineHeight = computedStyle.lineHeight;
    measurer.style.letterSpacing = computedStyle.letterSpacing;

    // Calculate maximum width (30% of window width)
    const maxWidth = Math.floor(window.innerWidth * 0.3);

    // First calculate width with no constraints to see minimum needed width
    measurer.style.maxWidth = 'none';
    measurer.style.width = 'auto';

    // Set the measurer's content to the textarea's content, replacing line breaks with <br>
    // We need to use innerHTML to properly handle line breaks
    measurer.innerHTML = textarea.value.replace(/\n/g, '<br>');

    // Get the width the text would naturally take (up to max width)
    let naturalWidth = Math.min(measurer.scrollWidth + 20, maxWidth); // Add 20px padding

    // Also calculate height when constrained to this width
    measurer.style.width = `${naturalWidth}px`;
    let contentHeight = measurer.scrollHeight + 20; // Add 20px padding

    // Ensure minimum sizes
    naturalWidth = Math.max(naturalWidth, 30);
    contentHeight = Math.max(contentHeight, 30);

    // Set the container dimensions
    container.style.width = `${naturalWidth}px`;
    container.style.height = `${contentHeight}px`;

    // Clear the measurer for next use
    measurer.innerHTML = '';

    OPTIMISM.log(`Auto-sized element to: ${naturalWidth}x${contentHeight}`);
}

// Add this new method to the CanvasView class
setupArenaToggle() {
    OPTIMISM.log('Setting up Are.na toggle');

    // Create the toggle button
    const arenaToggle = document.createElement('button');
    arenaToggle.id = 'arena-toggle';
    arenaToggle.className = 'nav-link';
    arenaToggle.textContent = this.model.isArenaVisible ? 'Hide Are.na' : 'Show Are.na';

    // Add click event listener
    arenaToggle.addEventListener('click', () => {
        this.controller.toggleArenaView();
    });

    // Add button to the right controls section
    const rightControls = document.getElementById('right-controls');
    if (rightControls) {
        // Add before the split view toggle (if exists)
        const splitViewToggle = document.getElementById('split-view-toggle');
        if (splitViewToggle) {
            rightControls.insertBefore(arenaToggle, splitViewToggle);
        } else if (this.inboxToggle) {
            rightControls.insertBefore(arenaToggle, this.inboxToggle);
        } else {
            rightControls.appendChild(arenaToggle);
        }
    }

    // Add message event listener to handle image transfers from the iframe
    window.addEventListener('message', async (event) => {
        // Only process messages with our specific type
        if (event.data && event.data.type === 'arenaImageTransfer') {
            OPTIMISM.log('Received image data from Arena iframe');

            // Get image data
            const imageData = event.data.imageData;

            if (!imageData) {
                OPTIMISM.logError('No image data received from Arena iframe');
                return;
            }

            try {
                // Convert data URL to file
                const res = await fetch(imageData);
                const blob = await res.blob();
                const file = new File([blob], 'arena-image.png', { type: 'image/png' });

                // Calculate position at the center of the viewport
                const rect = this.workspace.getBoundingClientRect();
                const x = rect.width / 2;
                const y = rect.height / 2;

                OPTIMISM.log(`Adding Arena image at position (${x}, ${y})`);
                this.showLoading('Adding image from Are.na...');

                // Add the image to the canvas
                await this.controller.addImage(file, x, y);
                OPTIMISM.log('Successfully added Arena image to canvas');
            } catch (error) {
                OPTIMISM.logError('Error processing Arena image data:', error);
                alert('Failed to add image from Are.na. Please try again.');
            } finally {
                this.hideLoading();
            }
        }

        // Keep the existing message handling for drag events
        else if (event.data && event.data.type === 'arenaImageDragStart') {
            // Store the image URL for later use when dropped
            this.arenaImageBeingDragged = event.data.imageUrl;

            // Show the drop zone indicator
            if (this.dropZoneIndicator) {
                this.dropZoneIndicator.style.display = 'block';
            }

            OPTIMISM.log(`Arena image drag started: ${this.arenaImageBeingDragged}`);
        } else if (event.data && event.data.type === 'arenaImageDragEnd') {
            OPTIMISM.log('Arena image drag ended');

            // Don't clear the image URL immediately - wait a moment to allow for the drop
            setTimeout(() => {
                this.arenaImageBeingDragged = null;

                // Hide the drop zone indicator
                if (this.dropZoneIndicator) {
                    this.dropZoneIndicator.style.display = 'none';
                }
            }, 100);
        }
    });

    // Create Arena viewport if it's enabled
    if (this.model.isArenaVisible) {
        this.updateArenaViewLayout(true);
    }

    OPTIMISM.log('Are.na toggle set up successfully');
}

// In view.js - Update the updateArenaViewLayout method:
updateArenaViewLayout(isEnabled) {
    OPTIMISM.log(`Updating Are.na view layout: ${isEnabled}`);

    if (!isEnabled && this.arenaViewport) {
        // Remove the Arena viewport
        this.arenaViewport.remove();
        this.arenaViewport = null;

        // Remove the resize divider if it exists
        if (this.arenaResizeDivider) {
            this.arenaResizeDivider.remove();
        }

        // Restore original workspace positioning, width, AND overflow
        this.workspace.style.left = 'var(--panel-width)';
        this.workspace.style.width = 'calc(100vw - 2 * var(--panel-width))';
        this.workspace.style.position = 'absolute';
        this.workspace.style.overflow = 'auto';
        this.workspace.style.overflowY = 'auto';

        // Make sure we enforce scrollbar visibility after render
        setTimeout(() => {
            this.workspace.style.overflow = 'auto';
            this.workspace.style.overflowY = 'auto';
            this.workspace.style.overflowX = 'hidden';
        }, 50);

        return;
    }

    // --- Force Hide Left Panels and Update Model State ---
    // This should run EVERY time Arena is enabled (isEnabled is true)
    if (isEnabled) {
        OPTIMISM.log('Arena enabling: Forcing hide of left panels.');
        // Hide Inbox
        if (this.inboxPanel && this.model.isInboxVisible) { // Only update if currently visible
            this.inboxPanel.style.display = 'none';
            this.model.isInboxVisible = false; // Update model state directly
        } else if (this.inboxPanel) {
             this.inboxPanel.style.display = 'none'; // Ensure it's hidden even if model state was already false
        }
        // Hide Priorities
        if (this.prioritiesPanel && this.model.isPrioritiesVisible) { // Only update if currently visible
            this.prioritiesPanel.style.display = 'none';
            this.model.isPrioritiesVisible = false; // Update model state directly
        } else if (this.prioritiesPanel) {
             this.prioritiesPanel.style.display = 'none'; // Ensure it's hidden even if model state was already false
        }
        // Save the updated state immediately
        this.model.saveAppState().catch(err => OPTIMISM.logError("Error saving state after hiding panels for Arena", err));
        // --- End Force Hide ---
    }
    // If Are.na was disabled but is now enabled AND the viewport doesn't exist yet, create it.
    if (isEnabled && !this.arenaViewport) {

        const workspaceWidth = 70; // 70% for main workspace
        const arenaWidth = 30; // 30% for Arena panel

        // Set workspace layout
        this.workspace.style.left = '0';
        this.workspace.style.width = `${workspaceWidth}%`;
        this.workspace.style.position = 'absolute';
        this.workspace.style.overflow = 'auto';
        this.workspace.style.overflowY = 'auto';

        // Create the Arena viewport container
        this.arenaViewport = document.createElement('div');
        this.arenaViewport.id = 'arena-viewport';
        this.arenaViewport.className = 'viewport';

        // Position and style the viewport
        this.arenaViewport.style.position = 'fixed';
        this.arenaViewport.style.top = '41px';
        this.arenaViewport.style.left = `${workspaceWidth}%`;
        this.arenaViewport.style.width = `${arenaWidth}%`;
        this.arenaViewport.style.height = 'calc(100vh - 41px)';
        this.arenaViewport.style.boxSizing = 'border-box';
        this.arenaViewport.style.overflow = 'hidden';
        this.arenaViewport.style.backgroundColor = 'var(--canvas-bg-color)';
        this.arenaViewport.style.zIndex = '150';

        // Create and add the iframe
        const arenaIframe = document.createElement('iframe');
        arenaIframe.id = 'arena-iframe';
        arenaIframe.src = './arena/index.html';

        // Set iframe styles
        arenaIframe.style.width = '100%';
        arenaIframe.style.height = '100%';
        arenaIframe.style.border = 'none';
        arenaIframe.style.display = 'block';

        // Set iframe attributes
        arenaIframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; camera; microphone; payment; geolocation');
        arenaIframe.setAttribute('allowfullscreen', 'true');
        arenaIframe.setAttribute('loading', 'eager');
        arenaIframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-popups allow-forms allow-downloads allow-popups-to-escape-sandbox');
        arenaIframe.setAttribute('referrerpolicy', 'origin');
        arenaIframe.setAttribute('importance', 'high');
        arenaIframe.setAttribute('crossorigin', 'anonymous');

        // Add iframe to viewport
        this.arenaViewport.appendChild(arenaIframe);

        // Add the Arena viewport to the document
        document.body.appendChild(this.arenaViewport);

        this.setupArenaCookieHandling();
        this.ensurePanelZIndices();

        // Make sure we enforce scrollbar visibility after render
        setTimeout(() => {
            this.workspace.style.overflow = 'auto';
            this.workspace.style.overflowY = 'auto';
        }, 50);

        OPTIMISM.log(`Arena viewport created with iframe path: ${arenaIframe.src}`);
    }

    // Update button text
    const arenaToggle = document.getElementById('arena-toggle');
    if (arenaToggle) {
        arenaToggle.textContent = isEnabled ? 'Hide Are.na' : 'Show Are.na';
    }
}



// Add a method to set up the resize functionality for the Are.na panel
setupArenaResizeDivider() {
    // This method is intentionally empty - we've removed the resize functionality for the Arena iframe
    OPTIMISM.log('Arena resize functionality disabled');



}

setupArenaCookieHandling() {
    // Add message event listener to handle drag events from the iframe
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'arenaImageDragStart') {
            // Store the image URL for later use when dropped
            this.arenaImageBeingDragged = event.data.imageUrl;

            // Show the drop zone indicator
            if (this.dropZoneIndicator) {
                this.dropZoneIndicator.style.display = 'block';
            }
        } else if (event.data && event.data.type === 'arenaImageDragEnd') {
            // Clear the stored image URL
            this.arenaImageBeingDragged = null;

            // Hide the drop zone indicator
            if (this.dropZoneIndicator) {
                this.dropZoneIndicator.style.display = 'none';
            }
        }
    });

    // Check if third-party cookies are enabled
    this.checkThirdPartyCookies();
}

// Add a method to check if third-party cookies are enabled
checkThirdPartyCookies() {
    if (!this.arenaViewport) return;

    try {
        const iframe = document.getElementById('arena-iframe');
        if (iframe) {
            // Try setting a test cookie
            iframe.contentWindow.postMessage({
                type: 'cookie-test',
                value: 'optimism-cookie-test'
            }, '*');

            OPTIMISM.log('Sent cookie test message to Are.na iframe');
        }
    } catch (error) {
        OPTIMISM.logError('Error checking third-party cookies:', error);
    }
}

setupPasteHandler() {
    OPTIMISM.log('Setting up paste handler');

    // In view.js - modify the paste handler in setupPasteHandler()
document.addEventListener('paste', async (e) => {
    // Don't handle paste when focus is in a text field
    if (document.activeElement.tagName === 'TEXTAREA' ||
        document.activeElement.tagName === 'INPUT') {
        return;
    }

    e.preventDefault();

    // Get clipboard data
    const clipboardData = e.clipboardData || window.clipboardData;

    if (!clipboardData) {
        OPTIMISM.logError('Clipboard data not available');
        return;
    }

    // Calculate position at the center of the viewport
    const rect = this.workspace.getBoundingClientRect();
    const x = (rect.width / 2) + this.workspace.scrollLeft; // Add scrollLeft
    const y = (rect.height / 2) + this.workspace.scrollTop; // Add scrollTop

    OPTIMISM.log(`Processing paste at center position (${x}, ${y})`);

    // Check for images in the clipboard
    const items = clipboardData.items;
    let imageHandled = false;

    if (items) {
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                // It's an image - get as a file
                const file = items[i].getAsFile();
                if (file) {
                    OPTIMISM.log(`Found image in clipboard: ${file.name || 'unnamed'} (${file.type})`);
                    this.showLoading('Adding pasted image...');

                    try {
                        // Add the image using the existing method
                        await this.controller.addImage(file, x, y);
                        OPTIMISM.log('Successfully added pasted image to canvas');
                        imageHandled = true;
                        this.hideLoading();
                        return; // Return immediately after successful handling
                    } catch (error) {
                        OPTIMISM.logError('Error adding pasted image:', error);
                        alert('Failed to add pasted image. Please try again.');
                        this.hideLoading();
                        return; // Return after showing error
                    }
                }
            }
        }
    }

    // If no image was found, try getting text
    if (!imageHandled) {
        let text = clipboardData.getData('text/plain');
        if (text && text.trim() !== '') {
            OPTIMISM.log(`Found text in clipboard (${text.length} characters)`);

            try {
                // Create a new text element
                const element = {
                    id: crypto.randomUUID(),
                    type: 'text',
                    x: x,
                    y: y,
                    text: text,
                    width: 200, // Initial width will be adjusted
                    height: 100, // Initial height will be adjusted
                    style: {
                        textSize: 'small',
                        textColor: 'default',
                        hasHeader: false
                    },
                    autoSize: true // Flag to indicate this element should auto-size
                };

                // Create an add element command
                const command = new AddElementCommand(this.model, element);

                // Execute the command
                const { result, showBackupReminder } = await this.model.execute(command);

                // Create and render the element
                const elemDOM = this.createTextElementDOM(element);

                // Auto-size to fit content
                const textarea = elemDOM.querySelector('.text-element');
                if (textarea && elemDOM.dataset.autoSize === 'true') {
                    this.autoSizeElement(elemDOM, textarea);

                    // Update the element dimensions in the model
                    this.controller.updateElement(element.id, {
                        width: parseInt(elemDOM.style.width),
                        height: parseInt(elemDOM.style.height),
                        autoSize: false // Turn off auto-size after initial sizing
                    });
                }

                // Show backup reminder if needed
                if (showBackupReminder) {
                    this.showBackupReminderModal();
                }

                OPTIMISM.log('Successfully added pasted text to canvas');
            } catch (error) {
                OPTIMISM.logError('Error adding pasted text:', error);
                alert('Failed to add pasted text. Please try again.');
            }
        } else {
            OPTIMISM.log('No valid content found in clipboard');
        }
    }
});

    OPTIMISM.log('Paste handler set up successfully');
}

toggleNestingDisabled() {
    this.controller.toggleNestingDisabled().then(isDisabled => {
        // Update the button text in the settings panel
        const settingsButton = document.getElementById('settings-disable-nesting-button');
        if (settingsButton) {
            settingsButton.textContent = isDisabled ? "Enable Nesting" : "Disable Nesting";
        }
    });
}

updateNestingDisabledState(isDisabled) {
    // Update the button text in settings panel
    const settingsButton = document.getElementById('settings-disable-nesting-button');
    if (settingsButton) {
        settingsButton.textContent = isDisabled ? "Enable Nesting" : "Disable Nesting";
    }
}

// Change these to only close panels on the same side:
updateSettingsVisibility(isVisible) {
    if (isVisible) {
        // Close other RIGHT-SIDE panels only
        this.stylePanel.style.display = 'none';
        const gridPanel = document.getElementById('grid-panel');
        if (gridPanel) {
            gridPanel.style.display = 'none';
        }

        // Don't close left-side panels
        // if (this.inboxPanel) {
        //     this.inboxPanel.style.display = 'none';
        // }
        // if (this.prioritiesPanel) {
        //     this.prioritiesPanel.style.display = 'none';
        // }

        // Show settings panel
        this.settingsPanel.style.display = 'block';
        this.settingsPanel.style.zIndex = '1000'; // Ensure high z-index
    } else {
        this.settingsPanel.style.display = 'none';
    }
}

// In view.js:
updatePanelVisibility(panelName, isVisible) {
    // Determine which side the panel belongs to
    const isLeftPanel = panelName === 'inbox' || panelName === 'priorities';
    const isRightPanel = panelName === 'settings' || panelName === 'style' || panelName === 'grid';

    // Only hide panels on the same side
    if (isVisible) {
        const panelsToClose = [];
        if (isLeftPanel) {
            // Hide other left panels
            if (panelName !== 'inbox') panelsToClose.push(this.inboxPanel);
            if (panelName !== 'priorities' && this.prioritiesPanel) panelsToClose.push(this.prioritiesPanel);
        } else if (isRightPanel) {
            // Hide other right panels
            if (panelName !== 'style') panelsToClose.push(this.stylePanel);
            if (panelName !== 'settings') panelsToClose.push(this.settingsPanel);
            if (panelName !== 'grid') panelsToClose.push(document.getElementById('grid-panel'));
        }
        panelsToClose.forEach(panel => { if (panel) panel.style.display = 'none'; });
    }

    // Show/Hide the requested panel
    switch(panelName) {
        case 'settings':
            this.settingsPanel.style.display = isVisible ? 'block' : 'none';
            this.settingsPanel.style.zIndex = '1000'; // Ensure high z-index
            break;
            // Visibility for inbox/priorities handled by their specific update methods
        case 'inbox':
            if (isVisible) {
                this.inboxPanel.style.display = 'block';
                this.renderInboxPanel();
            }
            break;
            // Visibility for inbox/priorities handled by their specific update methods
        case 'priorities':
            if (isVisible) {
                if (!this.prioritiesPanel) {
                    this.setupPrioritiesPanel();
                }
                this.prioritiesPanel.style.display = 'block';
                this.renderPrioritiesPanel();
            }
            break;
        case 'grid':
            const gridPanel = document.getElementById('grid-panel');
            if (gridPanel) {
                gridPanel.style.display = isVisible ? 'block' : 'none';
                gridPanel.style.zIndex = '1000'; // Ensure high z-index
                this.updateGridInputValues();
            }
            break;
        // Add more panels as needed
    }
}


// Ensure consistent panel styling for all panels
setupConsistentPanelStyling() {
    const panels = [
        this.stylePanel,
        this.settingsPanel,
        this.inboxPanel,
        this.prioritiesPanel,
        document.getElementById('grid-panel')
    ];

    panels.forEach(panel => {
        if (panel) {
            // Ensure proper positioning
            panel.style.position = 'fixed';
            panel.style.top = '41px'; // Below title bar
            panel.style.right = '0';
            panel.style.width = 'var(--panel-width)';
            panel.style.height = 'calc(100vh - 40px)';
            panel.style.zIndex = '250'; // Above split view/Arena
            panel.style.boxSizing = 'border-box';
            panel.style.overflow = 'auto';

            // Consistent background and styling
            panel.style.backgroundColor = 'var(--bg-color)';
            panel.style.padding = '20px';
            panel.style.paddingTop = '60px';
        }
    });
}

// In view.js, add this method and call it during initialization
setupPanelStackingContext() {
    // Create a style element to ensure proper panel stacking
    const stackingStyle = document.createElement('style');
    stackingStyle.id = 'panel-stacking-style';
    stackingStyle.textContent = `
        /* Force panels to use highest stacking context */
        #inbox-panel, #priorities-panel {
            z-index: 1000 !important;
            position: fixed !important;
            top: 41px !important;
            right: 0 !important;
        }

        #settings-panel {
            z-index: 1000 !important;
        }

        #style-panel {
            z-index: 1000 !important;
        }

        #grid-panel {
            z-index: 1000 !important;
        }

        /* Make sure viewport elements never cover panels */
        #arena-viewport,
        #arena-resize-divider {
            z-index: 150 !important;
        }
    `;
    document.head.appendChild(stackingStyle);

    OPTIMISM.log('Panel stacking context styles applied');
}

setupPrioritiesPanel() {
    OPTIMISM.log('Setting up priorities panel');

    // --- START: Create the toggle button in the nav bar ---
    if (!this.prioritiesToggle) {
        this.prioritiesToggle = document.createElement('button');
        this.prioritiesToggle.id = 'priorities-toggle';
        this.prioritiesToggle.className = 'nav-link';
        this.prioritiesToggle.textContent = 'Bookmarks'; // Initial text

        // Add click event handler
        this.prioritiesToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.controller.togglePrioritiesVisibility();
        });

        // Add button to the right controls section
        const rightControls = document.getElementById('right-controls');
        const inboxToggle = document.getElementById('inbox-toggle'); // Find the inbox toggle
        if (rightControls && inboxToggle) {
            // Insert before the inbox toggle
            rightControls.insertBefore(this.prioritiesToggle, inboxToggle);
            OPTIMISM.log('Added priorities toggle to right controls before inbox toggle');
        } else if (rightControls) {
            // Fallback: Add to the end if inbox toggle isn't found
            rightControls.appendChild(this.prioritiesToggle);
             OPTIMISM.log('Added priorities toggle to end of right controls (fallback)');
        } else {
             OPTIMISM.logError('Could not find right controls to add priorities toggle');
        }
    }
    // --- END: Create the toggle button in the nav bar ---


    // --- START: Create the actual priorities panel ---
    if (!this.prioritiesPanel) {
        this.prioritiesPanel = document.createElement('div');
        this.prioritiesPanel.id = 'priorities-panel';
        // *** REMOVED 'side-panel' class potentially, ensure styling below handles it ***
        // Apply panel styles directly or ensure a common panel class is used
        this.prioritiesPanel.style.position = 'fixed';
        this.prioritiesPanel.style.top = '41px'; // Below title bar
        this.prioritiesPanel.style.right = '0';
        this.prioritiesPanel.style.width = 'var(--panel-width)';
        this.prioritiesPanel.style.height = 'calc(100vh - 41px)'; // Adjusted height
        this.prioritiesPanel.style.backgroundColor = 'var(--panel-bg-color)'; // Use variable
        this.prioritiesPanel.style.padding = '20px';
        this.prioritiesPanel.style.paddingTop = '60px'; // Extra space for heading
        this.prioritiesPanel.style.boxSizing = 'border-box';
        this.prioritiesPanel.style.overflowY = 'auto'; // Use overflow-y
        this.prioritiesPanel.style.display = 'none'; // Hidden by default
        this.prioritiesPanel.style.zIndex = '1000'; // Ensure high z-index

        this.prioritiesPanel.innerHTML = `
            <div class="panel-heading">Bookmarks</div>
            <div class="priorities-container"></div>
        `;
        document.body.appendChild(this.prioritiesPanel);

        // Optional: Add specific CSS if not covered by general panel styles
        const styleElem = document.createElement('style');
        styleElem.textContent = `
            #priorities-panel .panel-heading { margin-bottom: 10px; color: var(--element-text-color);} /* Style heading */
            #priorities-panel .priorities-container { display: flex; flex-direction: column; gap: 10px; }
            #priorities-panel .priority-card {
                border: 1px solid var(--red-text-color); /* Priority border */
                border-radius: 4px; padding: 10px; font-size: 14px; cursor: pointer;
                position: relative; background-color: var(--canvas-bg-color); /* Match workspace */
                overflow: hidden; max-height: 80px;
                color: var(--element-text-color); /* Ensure text color */
            }
            #priorities-panel .priority-card-content {
                white-space: pre-wrap; overflow: hidden; text-overflow: ellipsis;
                display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
                max-height: 40px;
            }
            #priorities-panel .priority-card-image { max-height: 60px; max-width: 100%; object-fit: contain; display: block; margin: 0 auto; }
            #priorities-panel .priority-hint { color: var(--element-text-color); opacity: 0.7; text-align: center; margin: 20px 0; font-style: italic; }
        `;
        document.head.appendChild(styleElem);
    }
    // --- END: Create the actual priorities panel ---


    // --- REMOVED: Code that added the link to the settings panel ---
    /*
    let prioritiesToggleAdded = false;
    const settingsPanel = document.getElementById('settings-panel');
    // ... (rest of the old code that added the link here) ...
    */
    // --- END REMOVED ---


    // Add document click listener to close panel
    document.addEventListener('click', (e) => {
        if (this.prioritiesPanel &&
            this.prioritiesPanel.style.display === 'block' &&
            !this.prioritiesPanel.contains(e.target) &&
            e.target !== this.prioritiesToggle) { // Check against the button

            // Use controller to properly update model state
            this.controller.togglePrioritiesVisibility();
        }
    });

    // Ensure panel is included in panel management (redundant calls are okay)
    this.setupConsistentPanelStyling();
    this.setupPanelStackingContext();
    this.ensurePanelZIndices();

    // Initial rendering based on current state
    this.updatePrioritiesVisibility(this.model.isPrioritiesVisible);

    OPTIMISM.log('Priorities panel set up successfully');
}

// Add method to update the visibility of the priorities panel
updatePrioritiesVisibility(isVisible) {
    if (!this.prioritiesPanel) {
        this.setupPrioritiesPanel();
        return;
    }

    if (isVisible) {
        // --- Add check for Arena view ---
        if (this.model.isArenaVisible) {
            OPTIMISM.log('Arena view is active, preventing priorities panel from showing.');
            this.prioritiesPanel.style.display = 'none'; // Ensure it's hidden
            return; // Do not proceed to show
        }
        // --- End check ---
        // Close other LEFT-SIDE panels only
        if (this.inboxPanel) {
            this.inboxPanel.style.display = 'none';
        }

        // Don't close right-side panels
        // this.stylePanel.style.display = 'none';
        // this.settingsPanel.style.display = 'none';

        // CRITICAL: Apply direct forceful styling to ensure priorities panel appears above everything
        this.prioritiesPanel.style.display = 'block';
        this.prioritiesPanel.style.zIndex = '1000'; // Use a very high z-index
        this.prioritiesPanel.style.position = 'fixed';
        this.prioritiesPanel.style.top = '41px';
        this.prioritiesPanel.style.left = '0'; // Now on the left
        this.prioritiesPanel.style.right = 'auto';

        this.prioritiesPanel.style.width = 'var(--panel-width)';

        // Render content
        this.renderPrioritiesPanel();
    } else {
        this.prioritiesPanel.style.display = 'none';
    }
}

// Render the priorities panel content
renderPrioritiesPanel() {
    if (!this.prioritiesPanel) {
        this.setupPrioritiesPanel();
        return;
    }

    const container = this.prioritiesPanel.querySelector('.priorities-container');
    if (!container) return;

    container.innerHTML = '';

    if (this.model.priorityCards.length === 0) {
        const hint = document.createElement('div');
        hint.className = 'priority-hint';
        hint.textContent = 'Press "B" while a card is selected to mark it as a priority';
        container.appendChild(hint);
        return;
    }

    // Render each priority card
    for (const cardId of this.model.priorityCards) {
        // *** CHANGE: Use findElementByIdRecursive instead of findElementById ***
        const element = this.findElementByIdRecursive(this.model.data, cardId); // Search from root
        if (!element) {
            OPTIMISM.log(`Priority card element ${cardId} not found in data structure.`);
            continue; // Skip if element not found
        }

        const cardElement = document.createElement('div');
        cardElement.className = 'priority-card';
        cardElement.dataset.id = cardId;
        cardElement.dataset.type = element.type;

        if (element.type === 'text') {
            // Text card
            const content = document.createElement('div');
            // Truncate text for the display
            const truncatedText = element.text ?
                (element.text.length > 100 ? element.text.substring(0, 100) + '...' : element.text) : '';
            content.className = 'priority-card-content';
            content.textContent = truncatedText;
            cardElement.appendChild(content);
        } else if (element.type === 'image' && element.imageDataId) {
            // Image card
            const img = document.createElement('img');
            img.className = 'priority-card-image';

            // Load image data
            this.model.getImageData(element.imageDataId)
                .then(imageData => {
                    if (imageData) {
                        img.src = imageData;
                    } else {
                        img.alt = 'Image not found';
                    }
                })
                .catch(error => {
                    OPTIMISM.logError(`Error loading image for priority card ${cardId}:`, error);
                    img.alt = 'Error loading image';
                });

            cardElement.appendChild(img);
        }

        // *** CHANGE: Update click event listener ***
        // Add click event to navigate to card
        cardElement.addEventListener('click', () => {
            // Call the NEW controller method for direct navigation
            this.controller.navigateToBookmark(cardId);
        });
        // *** END CHANGE ***

        container.appendChild(cardElement);
    }
}

// *** NEW HELPER METHOD (or adapt existing findNodeRecursive if available) ***
    // Recursive search for an element by ID starting from a given node
    findElementByIdRecursive(node, elementId) {
        // Check elements in this node
        if (node.elements) {
            const element = node.elements.find(el => el.id === elementId);
            if (element) return element;
        }

        // Check in children nodes
        if (node.children) {
            for (const childId in node.children) {
                const foundElement = this.findElementByIdRecursive(node.children[childId], elementId);
                if (foundElement) return foundElement;
            }
        }
        return null;
    }


    // --- REMOVE THESE METHODS (no longer needed) ---
    /*
    findElementById(elementId) {
        // First check if the element is in the current node
        const elementInCurrent = this.model.findElement(elementId);
        if (elementInCurrent) return elementInCurrent;

        // If not in current node, search through the entire structure
        return this.findElementInNode(this.model.data, elementId);
    }

    findElementInNode(node, elementId) {
        // Check if element is in this node
        if (node.elements) {
            const element = node.elements.find(el => el.id === elementId);
            if (element) return element;
        }

        // Check in children nodes
        if (node.children) {
            for (const childId in node.children) {
                const childNode = node.children[childId];
                const foundElement = this.findElementInNode(childNode, elementId);
                if (foundElement) return foundElement;
            }
        }

        return null;
    }

    navigateToCardElement(elementId) {
        // Close the priorities panel first
        this.updatePrioritiesVisibility(false);

        // Find the path to the element
        const path = this.findPathToElement(elementId);
        if (!path) {
            OPTIMISM.logError(`Could not find path to element ${elementId}`);
            return;
        }

        // First navigate to the parent node
        if (path.parentNodeId) {
            this.controller.navigateToNode(path.parentNodeId).then(success => {
                if (success) {
                    // After navigating to the parent, always try to navigate into the element
                    setTimeout(() => {
                        OPTIMISM.log(`Navigating into priority card ${elementId}`);
                        this.controller.navigateToElement(elementId);
                    }, 100);
                }
            });
        }
    }

    findPathToElement(elementId) {
        // Check if element is in current node
        const element = this.model.findElement(elementId);
        if (element) {
            return { parentNodeId: this.model.currentNode.id };
        }

        // Otherwise, need to find it recursively
        return this.findPathInNode(this.model.data, elementId, null);
    }

    findPathInNode(node, elementId, parentId) {
        // Check if element is in this node
        if (node.elements) {
            const element = node.elements.find(el => el.id === elementId);
            if (element) {
                return { parentNodeId: node.id };
            }
        }

        // Check in children nodes
        if (node.children) {
            for (const childId in node.children) {
                const childNode = node.children[childId];
                const foundPath = this.findPathInNode(childNode, elementId, node.id);
                if (foundPath) return foundPath;
            }
        }

        return null;
    }
    */
   // --- END REMOVED METHODS ---

   // --- NEW METHOD to sync all panels ---
   syncAllPanelVisibilities() {
       OPTIMISM.log('Syncing all panel visibilities with model state.');

       // --- START: Special handling for Priorities Panel after render ---
       const prioritiesPanelWasVisible = this.prioritiesPanel && this.prioritiesPanel.style.display === 'block';
       // --- END: Special handling ---

       this.updateSettingsVisibility(this.model.isSettingsVisible);
       this.updateInboxVisibility(this.model.isInboxVisible);
       // Priorities visibility handled below

       // Grid Panel
       const gridPanel = document.getElementById('grid-panel');
       // Use the specific model property if available, otherwise fallback to panels state
       const gridShouldBeVisible = this.model.isGridVisible !== undefined ? this.model.isGridVisible : this.model.panels.grid;
       if (gridPanel) {
            gridPanel.style.display = gridShouldBeVisible ? 'block' : 'none';
            if (gridShouldBeVisible) this.updateGridInputValues();
       }

       // --- MODIFIED: Priorities Panel Sync ---
       // Keep it visible if it was visible *before* the sync, otherwise respect model state
       // Only show if model says visible AND Arena is NOT visible
       const prioritiesShouldBeVisible = (prioritiesPanelWasVisible || this.model.isPrioritiesVisible) && !this.model.isArenaVisible;
       this.updatePrioritiesVisibility(prioritiesShouldBeVisible);
       // --- END MODIFIED ---

       // Style Panel (only visible if an element is selected and is text)
       const selectedElement = this.model.selectedElement ? this.model.findElement(this.model.selectedElement) : null;
       const styleShouldBeVisible = selectedElement && selectedElement.type === 'text';
       this.stylePanel.style.display = styleShouldBeVisible ? 'block' : 'none';
       if (styleShouldBeVisible) this.updateStylePanel(selectedElement);
   }

updateSpacerPosition() {
    const spacer = document.getElementById('content-spacer');
    if (!spacer) {
        // Create the spacer if it doesn't exist
        const newSpacer = document.createElement('div');
        newSpacer.id = 'content-spacer';
        newSpacer.style.position = 'absolute';
        newSpacer.style.left = '0';
        newSpacer.style.width = '1px';
        newSpacer.style.height = '30vh'; // 30% of viewport height for padding
        newSpacer.style.visibility = 'hidden';
        newSpacer.style.pointerEvents = 'none';
        this.workspace.appendChild(newSpacer);

        OPTIMISM.log('Created missing content spacer element');

        // Use the newly created spacer
        return this.updateSpacerPosition();
    }

    const elements = this.workspace.querySelectorAll('.element-container');
    let maxBottom = 0;

    // Find the bottom edge of the lowest element relative to the workspace
    if (elements.length > 0) {
        elements.forEach(el => {
            // Use offsetTop and offsetHeight for position relative to the workspace parent
            const bottomEdge = el.offsetTop + el.offsetHeight;
            if (bottomEdge > maxBottom) {
                maxBottom = bottomEdge;
            }
        });
    }

    // Add a minimum padding of 20px even when there are no elements
    const minPadding = 20;
    maxBottom = Math.max(maxBottom, minPadding);

    // Position the spacer below the lowest element
    const spacerTop = maxBottom + 20; // Add 20px extra padding
    spacer.style.top = `${spacerTop}px`;

    OPTIMISM.log(`Spacer positioned at ${spacerTop}px below the lowest element.`);
}


// NEW METHOD: Syncs a single element's visuals with the model state
syncElementDisplay(elementId) {
    OPTIMISM.log(`Syncing display for element ${elementId}`);
    const container = document.querySelector(`.element-container[data-id="${elementId}"]`);
    if (!container) {
        OPTIMISM.log(`Sync failed: Container not found for element ${elementId}`);
        return; // Element not found in DOM (might have been deleted)
    }

    const elementData = this.model.findElement(elementId);
    if (!elementData) {
        OPTIMISM.log(`Sync failed: Element data not found in model for ${elementId}`);
        // Element might have been deleted, maybe remove container? For now, just log.
        // container.remove(); // Optional: clean up DOM if model says it's gone
        return;
    }

    // --- Force clear highlight state first (belt and suspenders) ---
    const textareaForClear = container.querySelector('.text-element');
    const displayForClear = container.querySelector('.text-display');
    if (textareaForClear) {
        textareaForClear.classList.remove('is-highlighted');
        textareaForClear.style.backgroundColor = '';
    }
    if (displayForClear) {
        displayForClear.classList.remove('is-highlighted');
        // We don't need to clear innerHTML here, it will be overwritten anyway
    }
    // --- End force clear ---
    const finalStyle = elementData.style || {};
    const elementType = elementData.type;

    // --- Apply styles applicable to BOTH Text and Image Containers ---

    // Card Background Color
    container.classList.remove('card-bg-none', 'card-bg-yellow', 'card-bg-red');
    const bgColor = finalStyle.cardBgColor || 'none';
    if (bgColor !== 'none') {
        container.classList.add(`card-bg-${bgColor}`);
    }

    // Card Border
    if (finalStyle.hasBorder) {
        container.classList.add('has-permanent-border');
    } else {
        container.classList.remove('has-permanent-border');
    }

    // Card Lock state (redundant with updateCardLockState, but safe to include)
     if (this.model.isCardLocked(elementId)) {
         container.classList.add('card-locked');
     } else {
         container.classList.remove('card-locked');
     }

    // Priority Border
    if (this.model.isCardPriority(elementId)) {
        container.classList.add('has-priority-border');
    } else {
        container.classList.remove('has-priority-border');
    }

    // --- Apply TEXT SPECIFIC styles ---
    if (elementType === 'text') {
        const textarea = container.querySelector('.text-element');
        const display = container.querySelector('.text-display');
        if (!textarea || !display) {
            OPTIMISM.logError(`Sync failed: Textarea or display not found for text element ${elementId}`);
            return;
        }

        // Text Size
        textarea.classList.remove('size-small', 'size-large', 'size-huge');
        display.classList.remove('size-small', 'size-large', 'size-huge');
        if (finalStyle.textSize) {
            textarea.classList.add(`size-${finalStyle.textSize}`);
            display.classList.add(`size-${finalStyle.textSize}`);
        }

        // Text Color
        textarea.classList.remove('color-default', 'color-red', 'color-green');
        display.classList.remove('color-default', 'color-red', 'color-green');
        const colorClass = `color-${finalStyle.textColor || 'default'}`;
        textarea.classList.add(colorClass);
        display.classList.add(colorClass);

        // Text Alignment
        textarea.classList.remove('align-left', 'align-centre', 'align-right');
        display.classList.remove('align-left', 'align-centre', 'align-right');
        const alignClass = `align-${finalStyle.textAlign || 'left'}`;
        textarea.classList.add(alignClass);
        display.classList.add(alignClass);

        // Header Formatting & Highlight (These require re-rendering innerHTML)
        const hasHeader = finalStyle.hasHeader;
        const isHighlighted = finalStyle.isHighlighted; // Get highlight status

        // Apply highlight class/style based on model state
        if (isHighlighted) {
            textarea.classList.add('is-highlighted');
            textarea.style.backgroundColor = 'rgb(255, 255, 176)'; // Direct style needed for textarea bg
            display.classList.add('is-highlighted');
             OPTIMISM.log(`Sync: Applying highlight to ${elementId}`);
        } else {
            // Ensure classes/styles are removed if not highlighted (redundant with clear above, but safe)
            textarea.classList.remove('is-highlighted');
            textarea.style.backgroundColor = ''; // Clear direct style
            display.classList.remove('is-highlighted');
             OPTIMISM.log(`Sync: Removing highlight from ${elementId}`);
        }

        // Re-render display content (passing highlight status for <mark> tag)
        if (hasHeader) {
            display.classList.add('has-header');
            display.innerHTML = this.formatTextWithHeader(elementData.text || '', true, isHighlighted);
        } else {
            display.classList.remove('has-header');
            display.innerHTML = this.convertUrlsToLinks(elementData.text || '', isHighlighted);
        }
    }
    // --- Apply IMAGE SPECIFIC styles (if any) ---
    else if (elementType === 'image') {
        // Handle image-specific styles if needed in the future
        // E.g., Z-index for images
        if (elementData.zIndex) {
             container.style.zIndex = Math.min(parseInt(elementData.zIndex), 99);
         } else {
             container.style.zIndex = '1';
         }
    }

    OPTIMISM.log(`Finished syncing display for element ${elementId}`);
}


}
