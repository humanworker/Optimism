import { OPTIMISM_UTILS } from '../utils.js';

export class ElementRenderer {
    constructor(model, controller, view, workspace) { // Add view parameter
        this.model = model;
        this.controller = controller;
        this.view = view; // Store view reference
        this.workspace = workspace; // Reference to the main workspace container
    }

    // Renders all elements for a given node
    renderNodeElements(node) {
        if (!node || !node.elements) return;

        // Sort elements: images before text, then by zIndex for images
        const sortedElements = [...node.elements].sort((a, b) => {
            if (!a || !b) return 0; // Handle potential null/undefined elements
            if (a.type === 'image' && b.type === 'text') return -1;
            if (a.type === 'text' && b.type === 'image') return 1;
            if (a.type === 'image' && b.type === 'image') {
                return (a.zIndex || 1) - (b.zIndex || 1);
            }
            return 0; // Maintain order for text or other types
        });

        sortedElements.forEach(element => {
            if (!element) return; // Skip if element data is missing
            try {
                if (element.type === 'text') {
                    this.createTextElementDOM(element);
                } else if (element.type === 'image') {
                    this.createImageElementDOM(element);
                }
            } catch (error) {
                OPTIMISM_UTILS.logError(`Error rendering element ${element.id}:`, error);
                // Optionally create a placeholder error element
            }
        });
    }

    // Creates DOM for a Text Element
    createTextElementDOM(elementData) {
        const container = this._createElementContainer(elementData); // Use helper
        container.classList.add('text-element-container');

        const hasChildren = this.model.hasChildren(elementData.id);

        // Create Textarea (for editing)
        const textEditor = document.createElement('textarea');
        textEditor.className = 'text-element';
        textEditor.value = elementData.text || '';
        textEditor.style.display = 'none'; // Hidden by default
        if (hasChildren) textEditor.classList.add('has-children');

        // Create Display Div
        const textDisplay = document.createElement('div');
        textDisplay.className = 'text-display';
        if (hasChildren) textDisplay.classList.add('has-children');

        // Apply styles and content
        this._applyTextStyles(textEditor, textDisplay, elementData.style);
        this._updateTextDisplayContent(textDisplay, elementData.text, elementData.style);

        // Append textarea and display
        container.appendChild(textEditor);
        container.appendChild(textDisplay);

        // Add Interaction Listeners for Text
        this._addTextInteractionListeners(container, textEditor, textDisplay, elementData);

        // Add common listeners (drag, resize, select) - must be done AFTER appending children
        this._addCommonElementListeners(container, elementData);

        this.workspace.appendChild(container);

        // Auto-size if needed (after appending to DOM)
        if (elementData.autoSize && textEditor.value.trim() !== '') {
             this.autoSizeElement(container, textEditor);
             // Update model immediately after auto-sizing on creation? Maybe better after first edit.
             // We'll let the blur handler save the final size after the first edit.
             // this.controller.updateElement(elementData.id, {
             //      width: parseInt(container.style.width),
             //      height: parseInt(container.style.height)
             // });
        }

        return container;
    }

    // Creates DOM for an Image Element
    async createImageElementDOM(elementData) {
        const container = this._createElementContainer(elementData); // Use helper
        container.classList.add('image-element-container');

        const hasChildren = this.model.hasChildren(elementData.id);
        if (hasChildren) container.classList.add('has-children');

        // Create Image tag
        const imageElement = document.createElement('img');
        imageElement.className = 'image-element';
        imageElement.style.width = '100%';
        imageElement.style.height = '100%';
        imageElement.style.objectFit = 'contain';
        imageElement.draggable = false; // Prevent native image drag

        // Set z-index for images
        container.style.zIndex = Math.min(parseInt(elementData.zIndex || 1), 99);

        // Append image
        container.appendChild(imageElement);

        // Add common listeners (drag, resize, select) - after appending image
        this._addCommonElementListeners(container, elementData);

        this.workspace.appendChild(container);

        // Load image source asynchronously
        try {
            const imageData = await this.model.getImageData(elementData.imageDataId);
            if (imageData) {
                imageElement.src = imageData;
            } else {
                OPTIMISM_UTILS.logError(`Image data not found for ${elementData.imageDataId}`);
                imageElement.alt = 'Image not found';
                container.style.border = '1px dashed red'; // Indicate error
            }
        } catch (error) {
            OPTIMISM_UTILS.logError(`Error loading image data for ${elementData.id}:`, error);
            imageElement.alt = 'Error loading image';
             container.style.border = '1px dashed red';
        }

        return container;
    }

    // --- Helper Methods ---

    // Creates the common container div for elements
    _createElementContainer(elementData) {
        const container = document.createElement('div');
        container.className = 'element-container';
        container.dataset.id = elementData.id;
        container.dataset.type = elementData.type;
        container.style.left = `${elementData.x}px`;
        container.style.top = `${elementData.y}px`;
        container.style.width = `${elementData.width || (elementData.type === 'text' ? 200 : 150)}px`; // Default widths
        container.style.height = `${elementData.height || (elementData.type === 'text' ? 100 : 150)}px`;
        container.dataset.numX = parseFloat(elementData.x); // Store numeric position
        container.dataset.numY = parseFloat(elementData.y);

        // Apply common styles (background, border, lock) from elementData.style
        this._applyContainerStyles(container, elementData.style, elementData.id);

        if (elementData.autoSize !== undefined) {
            container.dataset.autoSize = elementData.autoSize;
        }
        // Clear potential leftover size calculation data from dataset
        delete container.dataset.currentWidth; delete container.dataset.currentHeight;

        // Add resize handle (will be hidden by CSS if locked)
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        container.appendChild(resizeHandle); // Append handle here

        return container;
    }

    // Applies styles common to both text and image containers
    _applyContainerStyles(container, style, elementId) {
        if (!style) return;

        // Background Color
        container.classList.remove('card-bg-none', 'card-bg-yellow', 'card-bg-red');
        const bgColor = style.cardBgColor || 'none';
        if (bgColor !== 'none') container.classList.add(`card-bg-${bgColor}`);

        // Border
        container.classList.toggle('has-permanent-border', !!style.hasBorder);

        // Lock State (read directly from model for consistency)
        const isLocked = this.model.isCardLocked(elementId);
        container.classList.toggle('card-locked', isLocked);

        // Priority State (read directly from model)
        const isPriority = this.model.isCardPriority(elementId);
        container.classList.toggle('has-priority-border', isPriority);

        // Sent-to-Todoist State (read directly from model)
        const isSent = this.model.isElementSentToTodoist(elementId);
        container.classList.toggle('sent-to-todoist', isSent);
    }

    // Applies text-specific styles to textarea and display div
    _applyTextStyles(textarea, display, style) {
        if (!style) style = {}; // Default empty style object

        // Clear existing style classes
        const sizes = ['size-small', 'size-large', 'size-huge'];
        const colors = ['color-default', 'color-red', 'color-green'];
        const aligns = ['align-left', 'align-centre', 'align-right'];
        textarea.classList.remove(...sizes, ...colors, ...aligns, 'is-highlighted', 'is-italic');
        display.classList.remove(...sizes, ...colors, ...aligns, 'is-highlighted', 'has-header', 'is-italic');
        textarea.style.backgroundColor = ''; // Clear direct highlight style

        // Apply Size
        const sizeClass = `size-${style.textSize || 'small'}`;
        textarea.classList.add(sizeClass);
        display.classList.add(sizeClass);

        // Apply Color
        const colorClass = `color-${style.textColor || 'default'}`;
        textarea.classList.add(colorClass);
        display.classList.add(colorClass);

        // Apply Alignment
        const alignClass = `align-${style.textAlign || 'left'}`;
        textarea.classList.add(alignClass);
        display.classList.add(alignClass);

        // Apply Highlight class/style
        if (style.isHighlighted) {
            textarea.classList.add('is-highlighted');
            textarea.style.backgroundColor = 'rgb(255, 255, 176)'; // Direct style for textarea bg
            display.classList.add('is-highlighted');
        }

        // Apply Italic class
        if (style.isItalic) {
            textarea.classList.add('is-italic');
            display.classList.add('is-italic');
        }

        // Apply Header class (for display div only)
        if (style.hasHeader) {
            display.classList.add('has-header');
        }
    }

    // Updates the innerHTML of the text display div, handling links and headers
    _updateTextDisplayContent(displayDiv, text, style) {
         const hasHeader = style?.hasHeader;
         const isHighlighted = style?.isHighlighted;
         if (hasHeader) {
              displayDiv.innerHTML = this._formatTextWithHeader(text || '', true, isHighlighted);
         } else {
              displayDiv.innerHTML = this._convertUrlsToLinks(text || '', isHighlighted);
         }
    }


    // Adds listeners specific to text elements (edit, blur, etc.)
    _addTextInteractionListeners(container, textarea, display, elementData) {
        // Double-click to edit
        container.addEventListener('dblclick', (e) => {
             if (e.target.tagName === 'A') return; // Don't edit on link click
             if (OPTIMISM_UTILS.isModifierKeyPressed(e)) return; // Ignore dblclick if modifier is pressed
             if (container.classList.contains('card-locked')) return; // <<< ADD: Don't edit locked cards
             display.style.display = 'none';
             textarea.style.display = 'block';
             textarea.focus();
             textarea.select(); // Select text on edit start
             e.stopPropagation();
        });

         // Auto-sizing on input
         textarea.addEventListener('input', () => {
            // Check dataset flag; only auto-size if true
            if (container.dataset.autoSize === 'true') {
                this.autoSizeElement(container, textarea);
            }
         });

         // Blur to save changes
         // Define blur handler as a separate named function or use async directly
         textarea.addEventListener('blur', async () => {
            const element = this.model.findElementGlobally(elementData.id); // Use global find
            if (!element) return; // Element deleted before blur finished

            const originalText = element.text || '';
            const newText = textarea.value;

            // *** ADD Check for Empty Text ***
            if (newText.trim() === '') {
                 OPTIMISM_UTILS.log(`ElementRenderer: Textarea blur detected empty text for ${elementData.id}. Deleting.`);
                 // Ensure focus is removed before deletion if necessary
                 textarea.style.display = 'none'; // Hide editor first
                 this.controller.deleteElement(elementData.id);
                 return; // Stop further processing for this blur event
            }

             // Hide editor, show display first
             textarea.style.display = 'none';
             display.style.display = 'block';

             let propsToUpdate = {};
             let oldProps = {};
             let needsUpdate = false;

             // 1. Check for text changes
             if (newText !== originalText) {
                 propsToUpdate.text = newText;
                 oldProps.text = originalText;
                 needsUpdate = true;
             }

             // 2. Check if auto-sizing was active and dimensions changed
             const wasAutoSize = element.autoSize === true; // Check original model state
             // Read size potentially updated by input handler from dataset
             const currentWidth = parseFloat(container.dataset.currentWidth || container.style.width);
             const currentHeight = parseFloat(container.dataset.currentHeight || container.style.height);

             if (wasAutoSize) {
                  // Always turn off auto-size after first edit/blur
                   propsToUpdate.autoSize = false; // Turn off auto-size
                   oldProps.autoSize = true;
                   container.dataset.autoSize = 'false'; // Update DOM dataset too
                   needsUpdate = true; // Need to save the autoSize=false change

                  // Check if dimensions *actually* changed from model state
                  if (Math.abs(currentWidth - element.width) > 1 || Math.abs(currentHeight - element.height) > 1) {
                       propsToUpdate.width = currentWidth;
                       propsToUpdate.height = currentHeight;
                       oldProps.width = element.width;
                       oldProps.height = element.height;
                       // needsUpdate is already true
                  }
             }
             // Clear dataset values after reading them
             delete container.dataset.currentWidth;
             delete container.dataset.currentHeight;


            if (needsUpdate) {
                 // Update model (use the command that handles undo)
                 await this.controller.updateElementWithUndo(elementData.id, propsToUpdate, oldProps);
                 // Re-sync display after model update completes, only if element still exists
                  const stillExists = this.model.findElementGlobally(elementData.id);
                  if(stillExists) {
                       this.syncElementDisplay(elementData.id); // Ensure display matches final model state
                  }
            } else {
                 // If no change, still ensure display is synced in case style changed while editing
                  this.syncElementDisplay(elementData.id);
            }
         });

         // Prevent drag start when clicking inside textarea
         textarea.addEventListener('mousedown', (e) => e.stopPropagation());
         textarea.addEventListener('click', (e) => e.stopPropagation());

         // Handle link clicks within the display div (prevent container selection)
         display.addEventListener('click', (e) => {
            if (e.target.tagName === 'A') e.stopPropagation();
         });
    }

    // Adds listeners common to all element types (drag, select, resize)
    _addCommonElementListeners(container, elementData) {
        const resizeHandle = container.querySelector('.resize-handle');

        // --- Selection ---
        container.addEventListener('click', (e) => {
             // Check for locks ONLY for actions OTHER than basic selection

             // CMD/CTRL + Click = Navigate
             if (OPTIMISM_UTILS.isModifierKeyPressed(e)) {
                 // *** UPDATE: Prevent navigation if locked ***
                 if (container.classList.contains('card-locked')) {
                     OPTIMISM_UTILS.log(`CMD+Click ignored: Card ${elementData.id} is locked.`);
                     e.stopPropagation();
                     return; // Prevent navigation on locked card
                 }
                 this.controller.navigateToElement(elementData.id);
                 e.stopPropagation(); // Prevent other actions like selection
                 return; // <<< IMPORTANT: Exit early after handling nav
             }
             if (elementData.type === 'image' && this.model.imagesLocked) return;

             // If not CMD+Click and not locked, proceed with selection
             this.selectElement(container, elementData);
             e.stopPropagation(); // Prevent workspace click deselecting immediately
        });

        // --- Drag and Resize Initiation (managed by drag-drop-manager and resize-manager) ---
        // These listeners primarily delegate to the managers
        container.addEventListener('mousedown', (e) => {
             // Basic checks before handing off to managers
             if (e.button !== 0) return; // Only left click\
             if (elementData.type === 'image' && this.model.imagesLocked) return;
             if (container.classList.contains('card-locked')) return; // <<< ADD Check: Prevent DRAG if locked
             if (e.target === resizeHandle) return; // Don't drag if on resize handle

             this.selectElement(container, elementData, true); // Select but mark as dragging (prevents style panel)
             this.view.managers.dragDrop.startDrag(e, container); // *** FIX: Access manager via view ***
        });

        if (resizeHandle) {
             resizeHandle.addEventListener('mousedown', (e) => {
                  if (e.button !== 0) return; // Only left click
                 // Prevent RESIZE if card is locked OR if it's an image and images are locked
                  if (container.classList.contains('card-locked') && elementData.type === 'image') return;
                  if (container.classList.contains('card-locked')) return; // <<< ADD Check: Prevent RESIZE if locked
                  if (elementData.type === 'image' && this.model.imagesLocked) return;

                  this.selectElement(container, elementData); // Select before resizing
                  this.view.managers.resize.startResize(e, container); // *** FIX: Access manager via view ***
                  e.stopPropagation(); // Prevent container drag start
             });
        }
    }

    // Selects an element, deselects others, shows style panel if applicable
    selectElement(elementContainer, elementData, isDragging = false) {
         if (!elementContainer) return;
         // OPTIMISM_UTILS.log(`Selecting element ${elementData.id}`);
         this.deselectAllElements(); // Deselect others first
         elementContainer.classList.add('selected');
         this.model.selectedElement = elementData.id; // Update model state

         // Show style panel only for text elements and if not currently dragging
         const showStyle = elementData.type === 'text' && !isDragging;
         // Use controller.showPanel to ensure exclusivity rules are handled in the model
         if (showStyle) this.controller.showPanel('style');

         if (showStyle) {
              this.view.renderer.panel.updateStylePanelOptions(elementData); // Update panel content
         }
    }

    // Deselects all elements
    deselectAllElements() {
        document.querySelectorAll('.element-container.selected').forEach(el => {
            el.classList.remove('selected');
        });
        if (this.model.selectedElement) {
             this.model.selectedElement = null;
              // OPTIMISM_UTILS.log("Deselected elements.");
        }
    }

    // Auto-sizes a text element container based on its content
    autoSizeElement(container, textarea) {
        // Use a hidden measurer div for accurate sizing
        let measurer = document.getElementById('text-size-measurer');
        if (!measurer) {
            measurer = document.createElement('div');
            measurer.id = 'text-size-measurer';
            Object.assign(measurer.style, {
                position: 'absolute', visibility: 'hidden', height: 'auto', width: 'auto', // Start with auto width
                whiteSpace: 'pre-wrap', // Allows wrapping
                overflowWrap: 'break-word', // Ensure long words wrap
                padding: '8px', boxSizing: 'border-box',
                // border: '1px solid red' // DEBUG: Make measurer visible
            });
            document.body.appendChild(measurer);
        }

        const computedStyle = window.getComputedStyle(textarea);
        ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing'].forEach(prop => {
            measurer.style[prop] = computedStyle[prop];
        });

        // Define max width (e.g., 30% of viewport or a fixed pixel value)
        const maxWidth = Math.min(500, Math.floor(window.innerWidth * 0.4)); // Example: max 40% or 500px
        const minWidth = 100; // Set a reasonable minimum width
        const minHeight = 30; // Consistent minimum height
        const paddingBuffer = 18; // Extra space for padding/scrollbar clearance (~2 * 8px padding + buffer)

        // Use text content directly for measurement
        const textContent = textarea.value;
        // Replace spaces with non-breaking spaces for width calculation if needed? Sometimes helps.
        // measurer.textContent = textContent.replace(/ /g, '\u00a0');
        // Use innerHTML with &lt;br&gt; for height calculation
        measurer.innerHTML = textContent.replace(/\n/g, '<br>') || ' '; // Use nbsp for empty state

        // 1. Calculate Natural Width (width: auto) up to maxWidth
        measurer.style.width = 'auto';
        measurer.style.maxWidth = `${maxWidth}px`; // Apply max width to measurer directly
        let calculatedWidth = measurer.scrollWidth + paddingBuffer;
        calculatedWidth = Math.max(minWidth, Math.min(calculatedWidth, maxWidth)); // Apply min/max width

        // 2. Calculate Height based on the *calculated* width
        measurer.style.width = `${calculatedWidth - paddingBuffer}px`; // Set the constrained width for height calc (minus padding)
        let calculatedHeight = measurer.scrollHeight + paddingBuffer;
        calculatedHeight = Math.max(minHeight, calculatedHeight); // Apply min height

        // Apply calculated dimensions
        container.style.width = `${calculatedWidth}px`;
        container.style.height = `${calculatedHeight}px`;

        // Update dataset for potential use in updateElement command
        container.dataset.currentWidth = calculatedWidth;
        container.dataset.currentHeight = calculatedHeight;

        // OPTIMISM_UTILS.log(`Auto-sized element ${container.dataset.id} to: ${calculatedWidth}x${calculatedHeight}`);
    }

    // Updates the visual representation of a single element based on model data
    syncElementDisplay(elementId) {
         // OPTIMISM_UTILS.log(`Syncing display for element ${elementId}`);
         const container = document.querySelector(`.element-container[data-id="${elementId}"]`);
         if (!container) return; // Not in current view

         const elementData = this.model.findElementGlobally(elementId); // Find anywhere
         if (!elementData) {
             container.remove(); // Remove from DOM if not in model
             OPTIMISM_UTILS.log(`Removed container for missing element ${elementId}`);
             return;
         }

         // Sync common container styles
         this._applyContainerStyles(container, elementData.style, elementId);
         container.style.left = `${elementData.x}px`;
         container.style.top = `${elementData.y}px`;
         container.style.width = `${elementData.width}px`;
         container.style.height = `${elementData.height}px`;
         container.dataset.numX = elementData.x;
         container.dataset.numY = elementData.y;
         if (elementData.autoSize !== undefined) container.dataset.autoSize = elementData.autoSize;

         // Sync type-specific content and styles
         if (elementData.type === 'text') {
              const textarea = container.querySelector('.text-element');
              const display = container.querySelector('.text-display');
              const hasChildren = this.model.hasChildren(elementId); // <<< Re-check hasChildren state NOW
              OPTIMISM_UTILS.log(`syncElementDisplay (Text) for ${elementId}: hasChildren = ${hasChildren}`); // Log result
              if (textarea && display) {
                   textarea.value = elementData.text || ''; // Sync textarea value too
                   textarea.classList.toggle('has-children', hasChildren);
                   OPTIMISM_UTILS.log(`syncElementDisplay (Text) for ${elementId}: Toggled textarea 'has-children' class to ${hasChildren}`); // Log toggle
                   display.classList.toggle('has-children', hasChildren); // <<< Sync display class
                   this._applyTextStyles(textarea, display, elementData.style);
                   this._updateTextDisplayContent(display, elementData.text, elementData.style);
              }
         } else if (elementData.type === 'image') {
              const image = container.querySelector('.image-element');
              if (image && image.src !== elementData.imageDataId) { // Only update src if needed (performance)
                 // Re-load image data async
                 this.model.getImageData(elementData.imageDataId).then(imageData => {
                     if (image) { // Check if element still exists
                          if(imageData) image.src = imageData;
                          else image.alt = 'Image re-sync failed';
                     }
                 });
             } // End image src update check
             const hasChildren = this.model.hasChildren(elementId); // <<< Re-check hasChildren state NOW
             OPTIMISM_UTILS.log(`syncElementDisplay (Image) for ${elementId}: hasChildren = ${hasChildren}`); // Log result
             container.classList.toggle('has-children', hasChildren); // <<< Sync container class
             // Sync z-index if needed
             container.style.zIndex = Math.min(parseInt(elementData.zIndex || 1), 99);
         }

         // Sync selection state
         container.classList.toggle('selected', this.model.selectedElement === elementId);
    }

    // Focuses the textarea of a newly created element
    focusNewElement(elementContainer) {
         if (elementContainer?.dataset.type === 'text') {
              const textarea = elementContainer.querySelector('.text-element');
              const display = elementContainer.querySelector('.text-display');
              if (textarea && display) {
                   display.style.display = 'none';
                   textarea.style.display = 'block';
                   textarea.focus();
                   textarea.select();
              }
         }
    }


     // Text formatting helpers (can be static or moved to utils if preferred)
    _formatTextWithHeader(text, hasHeader, isHighlighted = false) {
         if (!text) return '';
         const lines = text.split('\n');
         let headerLine = lines[0] || '';
         let restOfText = lines.slice(1).join('\n');

         // Convert URLs within header and rest separately
         headerLine = this._convertUrlsToLinks(headerLine, false); // Don't mark header itself
         restOfText = this._convertUrlsToLinks(restOfText, false); // Don't mark rest itself

         let content = hasHeader
             ? `<span class="first-line">${headerLine}</span>${restOfText}`
             : this._convertUrlsToLinks(text || '', false); // No header, convert whole text

          // Apply mark tag around the whole content if highlighted
          if (isHighlighted) {
               content = `<mark>${content}</mark>`;
          }

         return content;
    }


    // Text formatting helpers (can be static or moved to utils if preferred)
    _formatTextWithHeader(text, hasHeader, isHighlighted = false) {
        // (This function remains the same as before, ensure it calls the corrected _convertUrlsToLinks)
        if (!text) return '';
        const lines = text.split('\n');
        let headerLine = lines[0] || '';
        let restOfText = lines.slice(1).join('\n');

        // Convert URLs within header and rest separately
        headerLine = this._convertUrlsToLinks(headerLine, false); // Don't mark header itself
        restOfText = this._convertUrlsToLinks(restOfText, false); // Don't mark rest itself

        let content = hasHeader
            ? `<span class="first-line">${headerLine}</span>${restOfText}`
            : this._convertUrlsToLinks(text || '', false); // No header, convert whole text

         // Apply mark tag around the whole content if highlighted
         if (isHighlighted) {
              content = `<mark>${content}</mark>`;
         }

        return content;
    }

    _convertUrlsToLinks(text, isHighlighted = false) { // isHighlighted param here might be redundant if outer mark tag is used
        if (!text) return '';

        // --- CORRECTED HTML ESCAPING ---
        let safeText = text.replace(/&/g, '&') // Use &
                           .replace(/</g, '<')   // Use <
                           .replace(/>/g, '>')   // Use >
                           .replace(/"/g, '"') // Use "
                           .replace(/'/g, "'"); // Use ' (or ') - Fixed unmatched quote

        safeText = safeText.replace(/\n/g, '<br>'); // Handle newlines

        // URL Regex (keep as is, seems functional for the purpose)
        // Consider refining if specific edge cases (like URLs in parentheses) need handling
        const urlRegex = /(\b(?:https?|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|]|\bwww\.[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;

        let result = '';
        let lastIndex = 0;
        let match;
        while ((match = urlRegex.exec(safeText)) !== null) {
            result += safeText.substring(lastIndex, match.index);
            let url = match[0];
            // Remove trailing punctuation unlikely to be part of URL
            url = url.replace(/[.,;:!?)]+$/, '');
            let href = url.startsWith('www.') ? 'https://' + url : url;
            // Ensure href attribute itself is properly encoded if needed, though usually okay here.
            // Example: href = encodeURI(href);
            result += `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`;
            lastIndex = match.index + url.length; // Use length of potentially trimmed URL
            urlRegex.lastIndex = lastIndex; // Adjust regex index
        }
        result += safeText.substring(lastIndex);

        // Apply highlight mark tag *if needed by internal logic*
        // return isHighlighted ? `<mark>${result}</mark>` : result;
        // Removed internal highlight wrapping as the caller (_formatTextWithHeader or syncElementDisplay) handles it
        return result;
    }

    // Finds the highest z-index among image elements
    findHighestImageZIndex() {
        let maxZ = 0;
        this.workspace.querySelectorAll('.image-element-container').forEach(el => {
            maxZ = Math.max(maxZ, parseInt(el.style.zIndex) || 0);
        });
        return Math.min(maxZ, 98); // Return highest used, capped below text elements
    }

} // End ElementRenderer Class
