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
        this._populateSettingsPanel(); // Populate settings panel now that elements exist
        this.setupStylePanelActions(); // Setup actions for style panel buttons
        this._setupGridInputControls(); // Setup actions for grid panel buttons
    }

    // --- Style Panel ---

    // Setup listeners for the interactive elements within the style panel
    setupStylePanelActions() {
        if (!this.stylePanel) return;
        OPTIMISM_UTILS.log("Renderer: Setting up style panel actions...");

        const setupOptionListeners = (attribute, controllerMethod) => {
            this.stylePanel.querySelectorAll(`.option-value[data-${attribute}]`).forEach(option => {
                option.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const elementId = this.model.selectedElement;
                    if (!elementId) return;
                    const value = option.dataset[attribute];
                     // Convert boolean strings
                     let processedValue = value;
                     if (value === 'true') processedValue = true;
                     if (value === 'false') processedValue = false;

                    controllerMethod.call(this.controller, elementId, { [attribute]: processedValue });
                     // Update UI immediately
                     this.updateStylePanelOptions(this.model.findElement(elementId));
                });
            });
        };

        // Use simplified mapping for direct style updates via controller
        setupOptionListeners('size', this.controller.updateElementStyle); // textSize
        setupOptionListeners('color', this.controller.updateElementStyle); // textColor
        setupOptionListeners('align', this.controller.updateElementStyle); // textAlign
        setupOptionListeners('bgcolor', this.controller.updateElementStyle); // cardBgColor
        setupOptionListeners('header', this.controller.updateElementStyle); // hasHeader
        setupOptionListeners('highlight', this.controller.updateElementStyle); // isHighlighted
        setupOptionListeners('border', this.controller.updateElementStyle); // hasBorder

        // Specific handlers for lock and move-to-inbox
        this.stylePanel.querySelectorAll('.option-value[data-lock]').forEach(option => {
             option.addEventListener('click', (e) => {
                  e.preventDefault(); e.stopPropagation();
                  const elementId = this.model.selectedElement;
                  if (!elementId) return;
                  this.controller.toggleCardLock(elementId); // Use specific controller method
                   // Update UI immediately
                   // Note: toggleCardLock already triggers style panel update if needed
             });
        });

         this.stylePanel.querySelector('.move-to-inbox')?.addEventListener('click', (e) => {
             e.preventDefault(); e.stopPropagation();
             const elementId = this.model.selectedElement;
             if (!elementId) return;
             OPTIMISM_UTILS.log(`Renderer: Moving ${elementId} to inbox via style panel`);
             this.controller.moveToInbox(elementId);
             // Controller handles hiding panel if necessary via panelManager
         });

        OPTIMISM_UTILS.log("Renderer: Style panel actions set up.");
    }

    // Updates the selected state of options in the style panel
    updateStylePanelOptions(elementData) {
        if (!this.stylePanel || !elementData || elementData.type !== 'text') return;
        // OPTIMISM_UTILS.log(`Renderer: Updating style panel for ${elementData.id}`);

        const updateSelected = (attribute, value) => {
            this.stylePanel.querySelectorAll(`.option-value[data-${attribute}]`).forEach(opt => {
                opt.classList.toggle('selected', opt.dataset[attribute] === String(value));
            });
        };

        const style = elementData.style || {};
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
        if (!this.settingsPanel) return;
        OPTIMISM_UTILS.log("Renderer: Populating settings panel...");

        // Clear existing maybe? Or assume structure is in HTML
        // Let's assume basic structure exists and we just add dynamic parts/listeners

        // Add dynamic options like Grid, Copy Link, Lock Images, Nesting Toggle
        // Find a suitable insertion point (e.g., after redo)
         const redoOption = this.settingsPanel.querySelector('#settings-redo-button')?.parentElement;

         const createOption = (id, text) => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'settings-option';
            const link = document.createElement('a');
            link.href = '#';
            link.className = 'option-value';
            link.id = id;
            link.textContent = text;
            optionDiv.appendChild(link);
            return optionDiv;
         };

         const gridOption = createOption('settings-grid-button', 'Grid Settings');
         const copyLinkOption = createOption('settings-copy-link-button', 'Copy Link');
         const lockImagesOption = createOption('settings-lock-images-button', this.model.imagesLocked ? 'Unlock Images' : 'Lock Images');
         const nestingOption = createOption('settings-disable-nesting-button', this.model.isNestingDisabled ? 'Enable Nesting' : 'Disable Nesting');
         // Add export w/o images button
        const exportNoImagesOption = createOption('settings-export-no-images-button', 'Export w/o Images');

        // Insert options
         if (redoOption) {
              // Insert in specific order after redo
              redoOption.after(exportNoImagesOption);
              exportNoImagesOption.after(nestingOption);
              nestingOption.after(lockImagesOption);
              lockImagesOption.after(copyLinkOption);
              copyLinkOption.after(gridOption);
         } else {
              // Fallback: append to end
              this.settingsPanel.appendChild(gridOption);
              this.settingsPanel.appendChild(copyLinkOption);
              this.settingsPanel.appendChild(lockImagesOption);
              this.settingsPanel.appendChild(nestingOption);
              this.settingsPanel.appendChild(exportNoImagesOption);
         }

        // Add listeners (handled by SettingsManager.setup)

        OPTIMISM_UTILS.log("Renderer: Settings panel populated.");
    }

    // --- Grid Panel ---

    // Setup listeners for grid input controls
     _setupGridInputControls() {
        if (!this.gridPanel) return;
         OPTIMISM_UTILS.log("Renderer: Setting up grid input controls...");

        const setupBtn = (selector, isIncrease, isRows) => {
            this.gridPanel.querySelector(selector)?.addEventListener('click', (e) => {
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