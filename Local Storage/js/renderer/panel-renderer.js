import { OPTIMISM_UTILS } from '../utils.js';

export class PanelRenderer {
    constructor(model, controller) {
        this.model = model;
        this.controller = controller;

        // Cache panel element references after they are created by PanelManager
        this.stylePanel = null;
        this.settingsPanel = null;
        this.inboxPanel = null;
        this.gridPanel = null;
        this.prioritiesPanel = null;
    }

    // Called by PanelManager after panels are created/found
    assignPanelElements(panels) {
        this.stylePanel = panels.style;
        this.settingsPanel = panels.settings;
        this.inboxPanel = panels.inbox;
        this.gridPanel = panels.grid;
        this.prioritiesPanel = panels.priorities;

        // *** CHANGE: Populate panels immediately after assigning ***
        this._populateSettingsPanel(); // Populate settings panel content
        this._populateStylePanel();    // *** ADD: Populate style panel content ***
        this.setupStylePanelActions(); // Setup actions for style panel buttons (now elements should exist)
        this._setupGridInputControls(); // Setup actions for grid panel buttons
    }

    // --- Style Panel ---

    // *** NEW METHOD: Creates the style options if they don't exist ***
    _populateStylePanel() {
        if (!this.stylePanel) {
            OPTIMISM_UTILS.logError("Renderer: Cannot populate style panel - panel element missing.");
            return;
        }
        OPTIMISM_UTILS.log("Renderer: Populating style panel options...");

        // Helper to create structure
        const createOption = (idPrefix, label, shortcut, values) => {
            // Check if option group already exists (use a data attribute or ID)
            const groupId = `${idPrefix}-option`;
            if (this.stylePanel.querySelector(`#${groupId}`)) {
                // OPTIMISM_UTILS.log(`Style option group ${groupId} already exists.`);
                return; // Already populated
            }

            const optionDiv = document.createElement('div');
            optionDiv.className = 'style-option';
            optionDiv.id = groupId; // Add ID for checking existence

            optionDiv.innerHTML = `
                <div class="option-label">
                    ${label}
                    <span class="shortcut-badges">
                        <span class="shortcut-badge" title="${label}">${shortcut}</span>
                    </span>
                </div>
                <div class="option-values">
                    ${values.map(val => `<a href="#" class="option-value" data-${idPrefix}="${val.value}">${val.text}</a>`).join('\n')}
                </div>
            `;
            // Prepend before the "Move to Inbox" option if possible
            const moveToInboxOption = this.stylePanel.querySelector('#move-to-inbox-option');
            if (moveToInboxOption) {
                 this.stylePanel.insertBefore(optionDiv, moveToInboxOption);
            } else {
                 this.stylePanel.appendChild(optionDiv); // Fallback append
            }
        };

        // Define options
        createOption('size', 'Text Size', '1', [
            { value: 'small', text: 'Small' },
            { value: 'large', text: 'Large' },
            { value: 'huge', text: 'Huge' }
        ]);
        createOption('color', 'Text Color', '2', [
            { value: 'default', text: 'Default' },
            { value: 'red', text: 'Red' },
            { value: 'green', text: 'Green' }
        ]);
        createOption('align', 'Text Alignment', '3', [
             { value: 'left', text: 'Left' },
             { value: 'centre', text: 'Centre' },
             { value: 'right', text: 'Right' }
        ]);
        createOption('bgcolor', 'Card Background', '4', [
             { value: 'none', text: 'None' },
             { value: 'yellow', text: 'Yellow' },
             { value: 'red', text: 'Red' }
        ]);
        createOption('header', 'Header?', '5', [
            { value: 'false', text: 'No' },
            { value: 'true', text: 'Yes' }
        ]);
        createOption('highlight', 'Highlighted?', '6', [
             { value: 'false', text: 'No' },
             { value: 'true', text: 'Yes' }
        ]);
        createOption('border', 'Card Border?', '7', [
            { value: 'false', text: 'No' },
            { value: 'true', text: 'Yes' }
        ]);
        createOption('lock', 'Lock Card?', '8', [
            { value: 'false', text: 'No' },
            { value: 'true', text: 'Yes' }
        ]);

         OPTIMISM_UTILS.log("Renderer: Style panel options populated.");
    }


    // Setup listeners for the interactive elements within the style panel
    setupStylePanelActions() {
        if (!this.stylePanel) {
             OPTIMISM_UTILS.logError("Renderer: Cannot setup style panel actions - panel missing.");
             return;
        }
        OPTIMISM_UTILS.log("Renderer: Setting up style panel actions...");

        // Helper to attach listeners, checking if element exists first
        const setupOptionListeners = (attribute, controllerMethod) => {
            const options = this.stylePanel.querySelectorAll(`.option-value[data-${attribute}]`);
            if (options.length === 0) {
                 OPTIMISM_UTILS.log(`Renderer: No options found for attribute [data-${attribute}] in style panel.`);
                 return; // Skip if options weren't created
            }
            options.forEach(option => {
                // Remove potential old listeners before adding new ones (optional, but safer)
                // const newOption = option.cloneNode(true);
                // option.parentNode.replaceChild(newOption, option);
                // option = newOption; // Use the new node

                option.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const elementId = this.model.selectedElement;
                    if (!elementId) return;

                    // Ensure element data exists before proceeding
                     const elementData = this.model.findElementGlobally(elementId);
                     if (!elementData) {
                          OPTIMISM_UTILS.logError(`Style Action Error: Element ${elementId} not found in model.`);
                          return;
                     }

                    const value = option.dataset[attribute];
                     // Convert boolean strings
                     let processedValue = value;
                     if (value === 'true') processedValue = true;
                     if (value === 'false') processedValue = false;

                     // Use a consistent property name format (e.g., camelCase) if needed
                     let propertyName = attribute;
                     if (attribute === 'size') propertyName = 'textSize';
                     if (attribute === 'color') propertyName = 'textColor';
                     if (attribute === 'align') propertyName = 'textAlign';
                     if (attribute === 'bgcolor') propertyName = 'cardBgColor';
                     if (attribute === 'header') propertyName = 'hasHeader';
                     if (attribute === 'highlight') propertyName = 'isHighlighted';
                     if (attribute === 'border') propertyName = 'hasBorder';
                     // Lock is handled separately below

                     // Call the specific controller method directly
                     this.controller.updateElementStyle(elementId, { [propertyName]: processedValue });

                     // Update UI immediately
                     // Update UI immediately (find element data *after* update potentially)
                     const updatedElementData = this.model.findElementGlobally(elementId); // Re-fetch data
                     if (updatedElementData) {
                         this.updateStylePanelOptions(updatedElementData);
                     }
                });
            });
        };

        // Setup listeners for each style attribute
        setupOptionListeners('size', this.controller.updateElementStyle); // textSize
        setupOptionListeners('color', this.controller.updateElementStyle); // textColor
        setupOptionListeners('align', this.controller.updateElementStyle); // textAlign
        setupOptionListeners('bgcolor', this.controller.updateElementStyle); // cardBgColor
        setupOptionListeners('header', this.controller.updateElementStyle); // hasHeader
        setupOptionListeners('highlight', this.controller.updateElementStyle); // isHighlighted
        setupOptionListeners('border', this.controller.updateElementStyle); // hasBorder

        // Specific handlers for lock and move-to-inbox
        const lockOptions = this.stylePanel.querySelectorAll('.option-value[data-lock]');
        if (lockOptions.length > 0) {
            lockOptions.forEach(option => {
                 // const newOption = option.cloneNode(true); option.parentNode.replaceChild(newOption, option); option = newOption; // Replace node if needed
              option.addEventListener('click', (e) => {
                   e.preventDefault(); e.stopPropagation();
                   const elementId = this.model.selectedElement;
                   if (!elementId) return;
                   this.controller.toggleCardLock(elementId); // Use specific controller method
                   // Update UI immediately
                   // Note: toggleCardLock already triggers style panel update if needed
              });
            });
        } else { OPTIMISM_UTILS.log("Renderer: Lock options not found in style panel."); }


         const moveToInboxLink = this.stylePanel.querySelector('.move-to-inbox');
         if (moveToInboxLink) {
              // const newLink = moveToInboxLink.cloneNode(true); moveToInboxLink.parentNode.replaceChild(newLink, moveToInboxLink); moveToInboxLink = newLink; // Replace node if needed
              moveToInboxLink.addEventListener('click', (e) => {
                  e.preventDefault(); e.stopPropagation();
                  const elementId = this.model.selectedElement;
                  if (!elementId) return;
                  OPTIMISM_UTILS.log(`Renderer: Moving ${elementId} to inbox via style panel`);
                  this.controller.moveToInbox(elementId);
                  // Controller/PanelManager handles hiding panel if necessary
              });
         } else { OPTIMISM_UTILS.log("Renderer: Move to Inbox link not found in style panel."); }


        OPTIMISM_UTILS.log("Renderer: Style panel actions set up.");
    }

    // Updates the selected state of options in the style panel
    updateStylePanelOptions(elementData) {
        if (!this.stylePanel || !elementData || elementData.type !== 'text') {
             // Clear selections or hide panel if element is not text?
             // Let's just ensure it doesn't error if panel/element not valid
              // If style panel is visible but shouldn't be (e.g., image selected), hide it.
              if (this.stylePanel && this.stylePanel.style.display === 'block' && (!elementData || elementData.type !== 'text')) {
                   this.controller.view.panelManager.hidePanel('style');
              }
             return;
        }
        // OPTIMISM_UTILS.log(`Renderer: Updating style panel for ${elementData.id}`);

        // Helper to update selection for a group
        const updateSelected = (attribute, value) => {
            // Convert boolean values to strings for comparison with dataset attribute
            const comparisonValue = String(value);
            this.stylePanel.querySelectorAll(`.option-value[data-${attribute}]`).forEach(opt => {
                opt.classList.toggle('selected', opt.dataset[attribute] === comparisonValue);
            });
        };

        const style = elementData.style || {};
        // Map model property names to dataset attributes used in the HTML/creation
        updateSelected('size', style.textSize || 'small');
        updateSelected('color', style.textColor || 'default');
        updateSelected('align', style.textAlign || 'left');
        updateSelected('bgcolor', style.cardBgColor || 'none');
        updateSelected('header', style.hasHeader || false);
        updateSelected('highlight', style.isHighlighted || false);
        updateSelected('border', style.hasBorder || false);
        // Update lock based on model state, not potentially stale elementData.style
        updateSelected('lock', this.model.isCardLocked(elementData.id));
    }

    // --- Settings Panel ---

    // Populates the settings panel with its options (called once)
    _populateSettingsPanel() {
        if (!this.settingsPanel) {
             OPTIMISM_UTILS.logError("Renderer: Cannot populate settings panel - panel element missing.");
             return;
        }
        OPTIMISM_UTILS.log("Renderer: Populating settings panel...");

        // Clear existing maybe? Or assume structure is in HTML
        // Let's assume basic structure exists and we just add dynamic parts/listeners
        // Safer: Ensure elements exist or create them.

        // Helper to create an option if it doesn't exist
        const ensureOption = (id, text, parentElement) => {
            let link = document.getElementById(id);
            if (!link) {
                const optionDiv = document.createElement('div');
                optionDiv.className = 'settings-option';
                link = document.createElement('a');
                link.href = '#';
                link.className = 'option-value';
                link.id = id;
                link.textContent = text;
                optionDiv.appendChild(link);
                 // Find a reasonable place to append or prepend
                 // Appending to parent might be simplest if order isn't critical initially
                 // Find the first child that is a settings-option or append if none
                 const firstOption = parentElement.querySelector('.settings-option');
                 if (firstOption) {
                    parentElement.insertBefore(optionDiv, firstOption); // Prepend for consistency perhaps? Or append? Let's append.
                 }
                 parentElement.appendChild(optionDiv);
                 OPTIMISM_UTILS.log(`Renderer: Created settings option: ${id}`);
                return link; // Return the created link
            }
            // OPTIMISM_UTILS.log(`Renderer: Settings option already exists: ${id}`);
            return link; // Return existing link
        };

        // Add dynamic options like Grid, Copy Link, Lock Images, Nesting Toggle
        // Define standard options and their initial text
        const options = [
            { id: 'settings-undo-button', text: 'Undo' },
            { id: 'settings-redo-button', text: 'Redo' },
            { id: 'settings-grid-button', text: 'Grid Settings' },
            { id: 'settings-copy-link-button', text: 'Copy Link' },
            { id: 'settings-lock-images-button', text: 'Lock Images' }, // Initial text updated later
            { id: 'settings-disable-nesting-button', text: 'Disable Nesting' }, // Initial text updated later
            { id: 'settings-export-button', text: 'Export' },
            { id: 'settings-export-no-images-button', text: 'Export w/o Images' },
            { id: 'settings-import-button', text: 'Import' },
            { id: 'settings-theme-toggle', text: 'Toggle Theme' },
            { id: 'settings-debug-toggle', text: 'Show Debug' } // Initial text updated later
        ];

        // Ensure all standard options exist within the settings panel
        // This loop guarantees the elements exist before managers try to attach listeners
        options.forEach(opt => ensureOption(opt.id, opt.text, this.settingsPanel));

        // Initial state updates (sets correct text based on model)
        this.updateSettingsButtonStates();


        OPTIMISM_UTILS.log("Renderer: Settings panel populated/verified.");
    }

    // Helper to update specific button states (called by managers or populate)
    updateSettingsButtonStates() {
        if (!this.settingsPanel) return;

        const updateButtonText = (id, text) => {
             const button = document.getElementById(id);
             // Only update if button exists and text content needs changing
             if (button && button.textContent !== text) button.textContent = text;
        };

        updateButtonText('settings-lock-images-button', this.model.imagesLocked ? 'Unlock Images' : 'Lock Images');
        updateButtonText('settings-disable-nesting-button', this.model.isNestingDisabled ? 'Enable Nesting' : 'Disable Nesting');
        updateButtonText('settings-debug-toggle', this.model.isDebugVisible ? 'Hide Debug' : 'Show Debug');

        // Undo/Redo disabled state (handled by UndoRedoManager, but can be done here too for initial state)
        const undoButton = document.getElementById('settings-undo-button');
        const redoButton = document.getElementById('settings-redo-button');
        // Ensure buttons exist before toggling class
        if(undoButton) undoButton.classList.toggle('disabled', !this.model.canUndo());
        if(redoButton) redoButton.classList.toggle('disabled', !this.model.canRedo());

    }

    // --- Grid Panel ---

    // Setup listeners for grid input controls
     _setupGridInputControls() {
        if (!this.gridPanel) return;
         OPTIMISM_UTILS.log("Renderer: Setting up grid input controls...");

        const setupBtn = (selector, isIncrease, isRows) => {
            // Ensure the button exists before adding listener
            const button = this.gridPanel.querySelector(selector);
            if (!button) {
                OPTIMISM_UTILS.logError(`Renderer: Grid control button not found: ${selector}`);
                return;
            }
            button.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation();
                const [rows, cols] = this.model.gridLayout.split('x').map(Number);
                let newRows = rows, newCols = cols;
                if (isRows) {
                    newRows = isIncrease ? Math.min(40, rows + 1) : Math.max(1, rows - 1);
                } else {
                    newCols = isIncrease ? Math.min(60, cols + 1) : Math.max(1, cols - 1);
                }
                if (newRows !== rows || newCols !== cols) {
                    this.controller.setGridLayout(`${newRows}x${newCols}`);
                }
            });
         };

        // Row buttons
        setupBtn('.grid-input-group:nth-child(1) .grid-btn-decrease', false, true);
        setupBtn('.grid-input-group:nth-child(1) .grid-btn-increase', true, true);
        // Column buttons
        setupBtn('.grid-input-group:nth-child(2) .grid-btn-decrease', false, false);
        setupBtn('.grid-input-group:nth-child(2) .grid-btn-increase', true, false);

        // Grid on/off toggles
        this.gridPanel.querySelectorAll('.option-value[data-grid]').forEach(option => {
             option.addEventListener('click', (e) => {
                 e.preventDefault(); e.stopPropagation();
                 const turnOn = option.dataset.grid === 'on';
                 if (turnOn !== this.model.panels.grid) { // Use panel state
                     this.controller.toggleGridVisibility();
                 }
                 this.updateGridPanelOptions(); // Update visual selection
             });
        });
         OPTIMISM_UTILS.log("Renderer: Grid input controls set up.");
    }


    // Updates the grid panel selections and values
    updateGridPanelOptions() {
        if (!this.gridPanel) return;

        // Update On/Off selection
        const gridIsVisible = this.model.panels.grid; // Use model panel state
        this.gridPanel.querySelectorAll('.option-value[data-grid]').forEach(opt => {
             opt.classList.toggle('selected', (opt.dataset.grid === 'on' && gridIsVisible) || (opt.dataset.grid === 'off' && !gridIsVisible));
        });

        // Update Row/Column values
        const [rows, columns] = this.model.gridLayout.split('x').map(Number);
        const rowsValueEl = this.gridPanel.querySelector('#grid-rows-value');
        const colsValueEl = this.gridPanel.querySelector('#grid-columns-value');
        if (rowsValueEl) rowsValueEl.textContent = rows;
        if (colsValueEl) colsValueEl.textContent = columns;
    }


    // --- Inbox Panel ---

    renderInboxPanel() {
        if (!this.inboxPanel) return;
        // OPTIMISM_UTILS.log("Renderer: Rendering inbox panel...");
        const container = this.inboxPanel.querySelector('.inbox-container');
        if (!container) return;
        container.innerHTML = ''; // Clear existing

        if (this.model.inboxCards.length === 0) {
            container.innerHTML = '<div class="inbox-hint">Press "A" to add a new card</div>';
            return;
        }

        this.model.inboxCards.forEach((card, index) => {
            const cardElement = this._createInboxCardElement(card, index === 0); // Pass flag if first card
            container.appendChild(cardElement);
        });
         // OPTIMISM_UTILS.log("Renderer: Inbox panel rendered.");
    }

    // Creates a single inbox card element
    _createInboxCardElement(card, isFirstCard) {
        const cardElement = document.createElement('div');
        cardElement.className = 'inbox-card';
        cardElement.dataset.id = card.id;
        cardElement.dataset.type = card.type;
        cardElement.draggable = true; // Make it draggable

        if (card.type === 'text') {
            // Check if it's the first card and it's conceptually "new" (empty)
            if (isFirstCard && (!card.text || String(card.text).trim() === '')) {
                const textarea = document.createElement('textarea');
                textarea.className = 'inbox-card-edit';
                textarea.placeholder = 'Type here... (blur to save)';
                 textarea.value = card.text || ''; // Ensure value is set even if empty
                textarea.addEventListener('blur', () => {
                    const text = textarea.value;
                    // Only update if text changed or if it was initially empty
                     if (text !== (card.text || '') || !card.text) {
                         this.controller.updateInboxCard(card.id, { text });
                     } else {
                          // If no change, re-render to switch back to display mode if needed
                          this.renderInboxPanel();
                     }
                });
                 // Stop propagation to prevent card click/drag while editing
                 textarea.addEventListener('mousedown', e => e.stopPropagation());
                cardElement.appendChild(textarea);
                // Defer focus slightly
                // setTimeout(() => textarea.focus(), 0); // Focus handled by focusNewInboxCard
            } else {
                const content = document.createElement('div');
                content.className = 'inbox-card-content';
                content.textContent = card.text || ''; // Display full text, CSS handles clamp
                cardElement.appendChild(content);
                // Double click to edit existing text cards
                 cardElement.addEventListener('dblclick', () => this._switchToInboxEditMode(cardElement, card));
            }
        } else if (card.type === 'image' && card.imageDataId) {
            const img = document.createElement('img');
            img.className = 'inbox-card-image';
            img.draggable = false; // Prevent image drag within card
            // Load image async
            this.model.getImageData(card.imageDataId)
                .then(imageData => { if (imageData) img.src = imageData; else img.alt = 'Not Found'; })
                .catch(err => { img.alt = 'Error'; OPTIMISM_UTILS.logError(`Error loading inbox image ${card.imageDataId}`, err); });
            cardElement.appendChild(img);
        }

        // Add drag listeners (handled by DragDropManager)
        cardElement.addEventListener('dragstart', (e) => this.controller.view.dragDropManager.startInboxDrag(e, cardElement));
        cardElement.addEventListener('dragend', (e) => this.controller.view.dragDropManager.endInboxDrag(e, cardElement));

        return cardElement;
    }

    // Switches an inbox card display to its edit mode (textarea)
    _switchToInboxEditMode(cardElement, cardData) {
        if (cardData.type !== 'text') return;
        cardElement.innerHTML = ''; // Clear current content (display div)
        const textarea = document.createElement('textarea');
        textarea.className = 'inbox-card-edit';
        textarea.value = cardData.text || '';
        textarea.addEventListener('blur', () => {
             const text = textarea.value;
             // Only update if text changed
              if (text !== (cardData.text || '')) {
                 this.controller.updateInboxCard(cardData.id, { text });
             } else {
                  // No change, re-render to go back to display mode
                   this.renderInboxPanel();
             }
        });
        // Stop propagation
        textarea.addEventListener('mousedown', e => e.stopPropagation());
        cardElement.appendChild(textarea);
        textarea.focus();
        textarea.select();
    }

    // Focuses the textarea in the first inbox card (if it's in edit mode)
    focusNewInboxCard() {
         if (!this.inboxPanel) return;
         const firstCardTextarea = this.inboxPanel.querySelector('.inbox-card:first-child .inbox-card-edit');
         if (firstCardTextarea) {
              // Defer focus slightly to ensure element is fully ready
              setTimeout(() => firstCardTextarea.focus(), 50);
         }
    }

    // --- Priorities Panel ---

    renderPrioritiesPanel() {
        if (!this.prioritiesPanel) return;
        // OPTIMISM_UTILS.log("Renderer: Rendering priorities panel...");
        const container = this.prioritiesPanel.querySelector('.priorities-container');
        if (!container) return;
        container.innerHTML = ''; // Clear existing

        if (this.model.priorityCards.length === 0) {
            container.innerHTML = '<div class="priority-hint">Press "B" on a selected card to bookmark it</div>';
            return;
        }

        // Keep track of promises for loading images
        const imageLoadPromises = [];

        this.model.priorityCards.forEach(cardId => {
            const element = this.model.findElementGlobally(cardId); // Find element anywhere
            if (!element) {
                OPTIMISM_UTILS.log(`Priority element ${cardId} not found.`);
                // Optionally remove from priority list if not found?
                // this.controller.toggleCardPriority(cardId); // This could cause loops
                return;
            }

            const cardElement = document.createElement('div');
            cardElement.className = 'priority-card';
            cardElement.dataset.id = cardId;
            cardElement.title = `Click to navigate to "${element.text || 'Image'}"`;

            if (element.type === 'text') {
                const content = document.createElement('div');
                content.className = 'priority-card-content';
                content.textContent = element.text || ''; // Display full text, CSS handles clamp
                cardElement.appendChild(content);
            } else if (element.type === 'image' && element.imageDataId) {
                const img = document.createElement('img');
                img.className = 'priority-card-image';
                img.draggable = false;
                // Create a promise for image loading
                const promise = this.model.getImageData(element.imageDataId)
                    .then(imageData => { if (imageData) img.src = imageData; else img.alt = 'Not Found'; })
                    .catch(err => { img.alt = 'Error'; OPTIMISM_UTILS.logError(`Error loading priority image ${element.imageDataId}`, err); });
                imageLoadPromises.push(promise); // Add promise to the list
                cardElement.appendChild(img);
            }

            cardElement.addEventListener('click', () => {
                this.controller.navigateToBookmark(cardId); // Use bookmark navigation
            });

            container.appendChild(cardElement);
        });

        // Wait for all images to load (or fail) before declaring render complete (optional)
        Promise.allSettled(imageLoadPromises).then(() => {
             // OPTIMISM_UTILS.log("Renderer: Priorities panel rendered (all images processed).");
        });
    }


} // End PanelRenderer Class
