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
        this.todoistPanel = null; // Added
    }

    // Called by PanelManager after panels are created/found
    assignPanelElements(panels) {
        this.stylePanel = panels.style;
        this.settingsPanel = panels.settings;
        this.inboxPanel = panels.inbox;
        this.gridPanel = panels.grid;
        this.prioritiesPanel = panels.priorities;
        this.todoistPanel = panels.todoist; // Added

        // *** CHANGE: Populate panels immediately after assigning ***
        this._populateSettingsPanel(); // Populate settings panel
        this._populateStylePanel();    // Populate style panel structure
        // REMOVE setupStylePanelActions call - Listeners for specific values removed
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

        // Helper to create simplified structure (Label + Shortcut only)
        const createOptionLabel = (idPrefix, label, shortcut) => {
            // Check if option group already exists (use a data attribute or ID)
            const groupId = `${idPrefix}-option`;
            if (this.stylePanel.querySelector(`#${groupId}`)) {
                // OPTIMISM_UTILS.log(`Style option group ${groupId} already exists.`);
                return; // Already populated
            }

            const optionDiv = document.createElement('div');
            optionDiv.className = 'style-option';
            optionDiv.id = groupId; // Add ID for checking existence / styling target

            // Only create Label and Shortcut Badge
            optionDiv.innerHTML = `
                <div class="option-label">
                    ${label}
                    <span class="shortcut-badges">
                        <span class="shortcut-badge" title="${label}">${shortcut}</span>
                    </span>
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

        // Create labels for keyboard-driven options
        createOptionLabel('size', 'Text Size', '1');
        createOptionLabel('color', 'Text Color', '2');
        createOptionLabel('align', 'Text Alignment', '3');
        createOptionLabel('bgcolor', 'Card Background', '4');
        createOptionLabel('header', 'Header?', '5');
        createOptionLabel('highlight', 'Highlighted?', '6');
        createOptionLabel('border', 'Card Border?', '7');
        createOptionLabel('lock', 'Lock Card?', '8');
        createOptionLabel('add-to-todoist', 'Add to Todoist', 'T');

        // Update "Move to Inbox" option - Remove descriptive text link
        const moveToInboxOption = this.stylePanel.querySelector('#move-to-inbox-option');
        if (moveToInboxOption) {
             // Keep label and shortcut, remove the .option-values div
             const valuesDiv = moveToInboxOption.querySelector('.option-values');
             if (valuesDiv) {
                  valuesDiv.remove();
             }
             // Ensure it looks like the others
             if (!moveToInboxOption.querySelector('.option-label .shortcut-badges')) {
                const labelDiv = moveToInboxOption.querySelector('.option-label');
                if(labelDiv) {
                    labelDiv.innerHTML += `
                        <span class="shortcut-badges">
                            <span class="shortcut-badge" title="Move to Inbox">9</span>
                        </span>`;
                }
             }
        } else {
             // If it doesn't exist, create it in the simplified format
             createOptionLabel('move-to-inbox', 'Move to Inbox', '9');
             // Note: The actual move action is still triggered by the keyboard shortcut '9'
             // If you wanted a click action here, you'd need a different approach
        }

         OPTIMISM_UTILS.log("Renderer: Style panel options populated.");
    }


    // Setup listeners for the interactive elements within the style panel
    setupStylePanelActions() {
        // No longer needed as there are no specific value links to attach listeners to.
        // Keyboard shortcuts handle the toggling.
        OPTIMISM_UTILS.log("Renderer: Skipping style panel actions setup (keyboard-driven).");
    }

    // No longer needed to update selected state of specific value links
    // Could potentially be used to display the *current* state next to the label,
    // but for now, we remove it for simplicity.
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
        } // Removed content update logic
        // OPTIMISM_UTILS.log(`Renderer: Updating style panel for ${elementData.id}`);
    }

    // --- Settings Panel --- (Population only)

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
            // Todoist Connect/Disconnect added here
            { id: 'settings-connect-todoist', text: 'Connect Todoist' },
            { id: 'settings-disconnect-todoist', text: 'Disconnect Todoist' },
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

        // Show/Hide Todoist buttons based on connection status
        const connectBtn = document.getElementById('settings-connect-todoist');
        const disconnectBtn = document.getElementById('settings-disconnect-todoist');
        if (connectBtn) connectBtn.style.display = this.model.todoistConnected ? 'none' : 'inline-block';
        // Undo/Redo disabled state (handled by UndoRedoManager, but can be done here too for initial state)
        const undoButton = document.getElementById('settings-undo-button');
        const redoButton = document.getElementById('settings-redo-button');
        // Ensure buttons exist before toggling class
        if(undoButton) undoButton.classList.toggle('disabled', !this.model.canUndo());
        if(redoButton) redoButton.classList.toggle('disabled', !this.model.canRedo());

        if (disconnectBtn) disconnectBtn.style.display = this.model.todoistConnected ? 'inline-block' : 'none';
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
             // ... (optional node cloning for listener safety) ... // Ensure only one listener active
             option.addEventListener('click', (e) => {
                 e.stopPropagation(); // <<< ADD THIS LINE to prevent document click listener closing panel
                 e.preventDefault();
                 OPTIMISM_UTILS.log(`Grid On/Off link clicked. Target state 'on': ${option.dataset.grid === 'on'}. Current model state: ${this.model.panels.grid}`); // Log click
                 const turnOn = option.dataset.grid === 'on';
                 if (turnOn !== this.model.panels.grid) { // Only call controller if state needs changing
                     OPTIMISM_UTILS.log("Calling controller.toggleGridVisibility() from panel link"); // Log controller call
                     this.controller.toggleGridVisibility(); // This toggles the model state
                 }
                 this.updateGridPanelOptions(); // Update visual selection immediately
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

    // --- Todoist Panel ---

    renderTodoistPanel(tasks = []) {
        if (!this.todoistPanel) return;
        const container = this.todoistPanel.querySelector('.todoist-container');
        if (!container) return;
        container.innerHTML = ''; // Clear existing

        

        if (!this.model.todoistConnected) {
            const hint = document.createElement('div');
            hint.className = 'todoist-hint';
            hint.textContent = 'Connect Todoist in Settings';
            container.appendChild(hint);
             return;
        }

        if (tasks.length === 0) {
            container.innerHTML += '<div class="todoist-hint">No tasks due today :)</div>'; // Append hint after title
            return;
        }
        tasks.forEach(task => {
            const taskElement = this._createTodoistTaskElement(task);
            container.appendChild(taskElement);
        });
    }

    // Helper to check if todoist panel has any tasks rendered (or hints)
    isTodoistPanelPopulated() {
        const container = this.todoistPanel?.querySelector('.todoist-container');
        return container ? container.children.length > 0 : false;
    }

    _createTodoistTaskElement(task) {
        const taskElement = document.createElement('div');
        taskElement.className = 'todoist-task';
        taskElement.dataset.todoistId = task.id; // Store Todoist task ID
        taskElement.dataset.taskContent = task.content; // Store content for easy access
        taskElement.draggable = true; // Make it draggable

        const content = document.createElement('div');
        content.className = 'todoist-task-content';
        content.textContent = task.content;
        taskElement.appendChild(content);

        // Add drag listeners
        taskElement.addEventListener('dragstart', (e) => {
            OPTIMISM_UTILS.log(`Dragging Todoist task: ${task.content}`);
            e.dataTransfer.setData('text/plain', `todoist-task-content:${task.content}`); // Prefix to identify
            e.dataTransfer.effectAllowed = 'copy'; // Indicate a copy operation
            taskElement.classList.add('dragging');
        });
        taskElement.addEventListener('dragend', () => {
            taskElement.classList.remove('dragging');
        });

        return taskElement;
    }

    renderTodoistPanelError(errorMessage) {
        if (!this.todoistPanel) return;
        const container = this.todoistPanel.querySelector('.todoist-container');
        if (!container) return;
        container.innerHTML = `<div class="todoist-hint" style="color: var(--red-text-color);">${errorMessage}</div>`;
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
