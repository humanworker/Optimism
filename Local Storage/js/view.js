import { OPTIMISM_UTILS } from './utils.js';
import { ElementRenderer } from './renderer/element-renderer.js';
import { NavigationRenderer } from './renderer/navigation-renderer.js';
import { PanelRenderer } from './renderer/panel-renderer.js';
import { GridRenderer } from './renderer/grid-renderer.js';
import { PanelManager } from './managers/panel-manager.js';
import { DragDropManager } from './managers/drag-drop-manager.js';
import { ResizeManager } from './managers/resize-manager.js';
// Keyboard manager is initialized separately in main.js
import { setupKeyboardShortcuts } from './managers/keyboard-manager.js';
import { ExportImportManager } from './managers/export-import-manager.js'; // Needed for setup
import { ArenaManager } from './managers/arena-manager.js';
// import { ThemeManager } from './managers/theme-manager.js'; // REMOVE
import { UndoRedoManager } from './managers/undo-redo-manager.js';
import { ModalManager } from './managers/modal-manager.js';
import { DebugManager } from './managers/debug-manager.js';
import { SettingsManager } from './managers/settings-manager.js';


export class CanvasView {
    constructor(model, controller) {
        this.model = model;
        this.controller = controller;

        // Core DOM Elements
        this.workspace = document.getElementById('workspace');
        this.titleBar = document.getElementById('title-bar');
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.progressContainer = document.getElementById('progress-container');
        this.progressBar = document.getElementById('progress-bar');
        this.progressText = document.getElementById('progress-text');
        this.dropZoneIndicator = document.getElementById('drop-zone-indicator');

        // --- Initialize Renderers ---
        // Renderers are responsible for *creating/updating* specific parts of the DOM
        this.renderer = { // Add view reference here
            element: new ElementRenderer(this.model, this.controller, this, this.workspace),
            navigation: new NavigationRenderer(this.model, this.controller, this.titleBar),
            panel: new PanelRenderer(this.model, this.controller),
            grid: new GridRenderer(this.model, this.workspace),
        };

        // --- Initialize Managers ---
        // Managers handle specific *interactions* or *features*
        const panelManager = new PanelManager(this.model, this.controller, this); // Manages visibility/setup of all panels
        const dragDropManager = new DragDropManager(this.model, this.controller, this); // Handles all drag/drop
        const resizeManager = new ResizeManager(this.model, this.controller, this); // Handles element resizing
        const arenaManager = new ArenaManager(this.model, this.controller, this); // Manages Arena iframe
        // const themeManager = new ThemeManager(this.model, this.controller); // REMOVE
        const undoRedoManager = new UndoRedoManager(this.model, this.controller); // Instantiate here
        const modalManager = new ModalManager(this.model, this.controller); // Manages modals
        const debugManager = new DebugManager(this.model, this.controller); // Manages debug panel
        const settingsManager = new SettingsManager(this.model, this.controller, this); // Manages settings panel content/interactions

        // Assign view reference to managers that need it (if not passed in constructor)
        // These assignments might become redundant if managers access view via this.managers.view
        dragDropManager.view = this;
        resizeManager.view = this;
        arenaManager.view = this;

        // --- *** ADD THIS BLOCK *** ---
        // Assign managers to a unified 'managers' property
        this.managers = {
             panel: panelManager,
             dragDrop: dragDropManager,
             resize: resizeManager,
             arena: arenaManager,
             // theme: themeManager, // REMOVE
             undoRedo: undoRedoManager, // Assign the instance here
             modal: modalManager,
             debug: debugManager,
             settings: settingsManager
        };
        // --- *** END ADDED BLOCK *** ---

        // Keep individual references for backward compatibility or direct access if preferred
        this.panelManager = panelManager;
        this.dragDropManager = dragDropManager;
        this.resizeManager = resizeManager;
        this.arenaManager = arenaManager;
        // this.themeManager = themeManager; // REMOVE
        this.undoRedoManager = undoRedoManager;
        this.modalManager = modalManager;
        this.debugManager = debugManager;
        this.settingsManager = settingsManager;


        OPTIMISM_UTILS.log("View initialized with renderers and managers.");
    }

    // Called by Controller after its initialization is complete
    setupUI() {
         OPTIMISM_UTILS.log("View: Setting up UI components and listeners...");
         this.showLoading('Setting up UI...'); // Show loading during setup

         // Setup managers (which might add listeners or modify DOM)
         // CRITICAL: Setup PanelManager FIRST so panel elements are found and populated
         this.managers.panel.setupPanels(); // Finds elements, calls PanelRenderer.assignPanelElements -> _populateSettingsPanel
         // 1. Populate Settings Panel Content (PanelRenderer)
         // 2. Setup SettingsManager (attaches listeners to buttons *inside* settings panel)
         this.managers.settings.setup();
         // this.managers.theme.setup(); // REMOVE
         this.managers.dragDrop.setup();
         this.managers.resize.setup();
         this.managers.arena.setup();
         this.managers.undoRedo.setup(); // Now safe to setup undo/redo buttons
         this.managers.modal.setup();
         this.managers.debug.setup();
         this.renderer.panel.setupStylePanelActions(); // Setup actions within the style panel



         // Setup core listeners not handled by specific managers
         this.setupCoreEventListeners();
         this.setupPasteHandler();

         // Initial render states
         // this.managers.theme.updateTheme(this.model.isDarkTheme); // REMOVE
         this.managers.debug.updateVisibility(this.model.isDebugVisible);
         this.managers.panel.syncPanelsWithModelState(); // Set initial visibility based on model
         this.managers.settings.updateAllButtonStates(); // Sync settings buttons

         OPTIMISM_UTILS.log("View: UI setup complete.");
         // Loading hidden by main.js after initial render
    }


    // Central rendering function - orchestrates calls to specific renderers
    renderWorkspace() {
        OPTIMISM_UTILS.log('View: Rendering workspace...');
        const scroll = this.getScrollPosition(); // Store scroll before clearing

        this.workspace.innerHTML = ''; // Clear main content area

        // Add back essential structural elements if they were cleared
        const spacer = document.getElementById('content-spacer') || this.createSpacer();
        const gridContainer = document.getElementById('grid-container') || this.createGridContainer();
        this.workspace.appendChild(spacer);
        this.workspace.appendChild(gridContainer);


        // Render navigation elements
        this.renderer.navigation.renderBreadcrumbs();
        this.renderer.navigation.renderQuickLinks();

        // Render elements within the current node
        if (this.model.currentNode && this.model.currentNode.elements) {
            // OPTIMISM_UTILS.log(`Rendering ${this.model.currentNode.elements.length} elements.`);
            this.renderer.element.renderNodeElements(this.model.currentNode);
        } else {
            OPTIMISM_UTILS.log('No elements to render in current node.');
        }

        // Re-apply states that depend on elements existing
        this.updateLockedCardStyles();
        this.updateCardPriorityStyles();
        this.updateImagesLockState(this.model.imagesLocked);

        // Render grid if visible
        if (this.model.panels.grid) {
            this.renderer.grid.renderGrid();
        } else {
             this.renderer.grid.clearGrid();
        }

        // Update other UI elements
        this.updatePageTitle();
        this.managers.undoRedo.updateButtons(); // Access via managers
        this.managers.panel.syncPanelsWithModelState(); // Ensure panel states are correct
        this.updateSpacerPosition(); // Adjust spacer after rendering

        this.setScrollPosition(scroll); // Restore scroll after rendering
        OPTIMISM_UTILS.log('View: Workspace rendering complete.');
    }

    // --- UI Update Helpers ---

    updatePageTitle() {
        let title = 'OPTIMISM';
        if (this.model.navigationStack.length > 1) {
            const currentNode = this.model.navigationStack[this.model.navigationStack.length - 1];
            title = currentNode.nodeTitle || 'Untitled';
            // Basic truncation - consider more sophisticated ellipsis if needed
            if (title.length > 30) title = title.substring(0, 27) + '...';
        }
        document.title = title;
    }

    updateSpacerPosition() {
        const spacer = document.getElementById('content-spacer');
        if (!spacer) return;

        const elements = this.workspace.querySelectorAll('.element-container');
        let maxBottom = 0;
        if (elements.length > 0) {
            elements.forEach(el => {
                 // Use offsetTop/offsetHeight for position relative to the offset parent (workspace)
                maxBottom = Math.max(maxBottom, el.offsetTop + el.offsetHeight);
            });
        }
        // Ensure minimum space even with no elements, plus some padding
        const spacerTop = Math.max(20, maxBottom + 30);
        spacer.style.top = `${spacerTop}px`;
         // OPTIMISM_UTILS.log(`Spacer positioned at ${spacerTop}px`);
    }

     createSpacer() {
         const newSpacer = document.createElement('div');
         newSpacer.id = 'content-spacer';
         Object.assign(newSpacer.style, {
             position: 'absolute', left: '0', width: '1px',
             height: '30vh', visibility: 'hidden', pointerEvents: 'none'
         });
         OPTIMISM_UTILS.log('Created missing content spacer element');
         return newSpacer;
     }

     createGridContainer() {
          const newGridContainer = document.createElement('div');
          newGridContainer.id = 'grid-container';
           Object.assign(newGridContainer.style, {
             position: 'absolute', top: '0', left: '0', width: '100%', height: '100%',
             pointerEvents: 'none', zIndex: '0' // Ensure it's behind elements
         });
          OPTIMISM_UTILS.log('Created missing grid container element');
          return newGridContainer;
     }

     // Update lock state visuals for a specific card
     updateCardLockState(cardId, isLocked) {
         const container = document.querySelector(`.element-container[data-id="${cardId}"]`);
         if (container) {
             container.classList.toggle('card-locked', isLocked);
             // Force redraw maybe? Usually class toggle is enough.
         }
     }

     // Apply .card-locked class to all currently locked cards
     updateLockedCardStyles() {
          document.querySelectorAll('.element-container.card-locked').forEach(el => el.classList.remove('card-locked'));
          this.model.lockedCards.forEach(cardId => {
               const container = document.querySelector(`.element-container[data-id="${cardId}"]`);
               if (container) container.classList.add('card-locked');
          });
     }

     // Update priority state visuals for a specific card
     updateCardPriorityState(cardId, isPriority) {
          const container = document.querySelector(`.element-container[data-id="${cardId}"]`);
          if (container) {
              container.classList.toggle('has-priority-border', isPriority);
          }
     }

     // Apply .has-priority-border class to all priority cards
     updateCardPriorityStyles() {
          document.querySelectorAll('.element-container.has-priority-border').forEach(el => el.classList.remove('has-priority-border'));
          this.model.priorityCards.forEach(cardId => {
               const container = document.querySelector(`.element-container[data-id="${cardId}"]`);
               if (container) container.classList.add('has-priority-border');
          });
     }


    // Update visuals for image lock state globally
    updateImagesLockState(isLocked) {
        document.querySelectorAll('.image-element-container').forEach(container => {
            container.classList.toggle('image-locked', isLocked);
             // Deselect if locked
             if (isLocked && container.classList.contains('selected')) {
                 container.classList.remove('selected');
                 if (this.model.selectedElement === container.dataset.id) {
                     this.model.selectedElement = null;
                     this.managers.panel.hidePanel('style');
                 }
             }
        });
        // Update associated button is handled by settingsManager
    }


    // --- Core Event Listeners (Not handled by specific managers) ---
    setupCoreEventListeners() {
        // Workspace click/dblclick
        this.workspace.addEventListener('click', (e) => {
            // Click on empty space deselects
            if (e.target === this.workspace) {
                this.renderer.element.deselectAllElements();
                this.managers.panel.hidePanel('style');
            }
        });
        this.workspace.addEventListener('dblclick', (e) => {
            // Double-click on empty space creates element
            if (e.target === this.workspace && !OPTIMISM_UTILS.isModifierKeyPressed(e)) {
                const rect = this.workspace.getBoundingClientRect();
                const x = e.clientX - rect.left + this.workspace.scrollLeft;
                const y = e.clientY - rect.top + this.workspace.scrollTop;
                this.controller.createElement(x, y);
            }
        });

        // Window resize
        window.addEventListener('resize', () => {
            if (this.model.panels.grid) {
                this.renderer.grid.renderGrid(); // Re-render grid on resize
            }
             if (this.model.panels.arena) { // Adjust arena layout
                  this.managers.arena.updateLayout();
             }
             this.updateSpacerPosition(); // Adjust spacer on resize
        });

        // Global clicks for closing panels (managed by PanelManager now)
        // document.addEventListener('click', this.panelManager.handleGlobalClick);

        // Modifier key detection for cursor changes
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Meta' || e.key === 'Control') document.body.classList.add('cmd-pressed');
            if (e.key === 'Shift') document.body.classList.add('shift-pressed'); // For quick link removal hover
        });
        document.addEventListener('keyup', (e) => {
             if (e.key === 'Meta' || e.key === 'Control') document.body.classList.remove('cmd-pressed');
             if (e.key === 'Shift') document.body.classList.remove('shift-pressed');
        });
        window.addEventListener('blur', () => { // Clear modifiers on window blur
            document.body.classList.remove('cmd-pressed');
            document.body.classList.remove('shift-pressed');
        });
    }

    setupPasteHandler() {
         document.addEventListener('paste', async (e) => {
             const activeEl = document.activeElement;
             if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT')) {
                 return; // Allow native paste in text fields
             }
             e.preventDefault();
             const clipboardData = e.clipboardData || window.clipboardData;
             if (!clipboardData) return;

             const rect = this.workspace.getBoundingClientRect();
             const x = (rect.width / 2) + this.workspace.scrollLeft;
             const y = (rect.height / 2) + this.workspace.scrollTop;

             const items = clipboardData.items;
             let imageFile = null;

             if (items) {
                 for (let i = 0; i < items.length; i++) {
                     if (items[i].type.startsWith('image/')) {
                         imageFile = items[i].getAsFile();
                         break;
                     }
                 }
             }

             if (imageFile) {
                 OPTIMISM_UTILS.log(`Pasting image: ${imageFile.name}`);
                 this.showLoading('Adding pasted image...');
                 try {
                     await this.controller.addImage(imageFile, x, y);
                 } catch (error) { alert('Failed to add pasted image.'); }
                 finally { this.hideLoading(); }
             } else {
                 const text = clipboardData.getData('text/plain');
                 if (text && text.trim() !== '') {
                     OPTIMISM_UTILS.log(`Pasting text (${text.length} chars)`);
                     try {
                          // Reuse create element logic, triggering auto-size
                          await this.controller.createElement(x, y);
                          // Need a way to set the text *after* creation for auto-size to work correctly
                          // This might require controller modification or a dedicated pasteText action
                          // Quick HACK: Find the newly created element (usually last) and update it
                          setTimeout(async () => {
                               const elements = this.model.currentNode?.elements;
                               if(elements && elements.length > 0) {
                                    const newElement = elements[elements.length - 1];
                                    // Check if it's likely the one just created (very basic check)
                                    if(newElement.type === 'text' && newElement.text === '') {
                                         await this.controller.updateElement(newElement.id, { text: text, autoSize: false });
                                    }
                               }
                          }, 50); // Delay slightly

                     } catch (error) { alert('Failed to add pasted text.'); }
                 }
             }
         });
    }


    // --- Scroll Management ---
    getScrollPosition() {
        return { top: this.workspace.scrollTop, left: this.workspace.scrollLeft };
    }

    setScrollPosition({ top, left }) {
        // Only set if values are valid numbers
        if (typeof top === 'number' && !isNaN(top)) {
            this.workspace.scrollTop = top;
        }
        if (typeof left === 'number' && !isNaN(left)) {
             this.workspace.scrollLeft = left;
        }
    }

    // --- Loading/Progress Indicators ---
    showLoading(message = 'Loading...') {
        if (this.loadingOverlay) {
            this.loadingOverlay.style.display = 'flex';
            const status = this.loadingOverlay.querySelector('#loading-status');
            if (status) status.textContent = message;
            if (this.progressContainer) this.progressContainer.style.display = 'none';
            if (this.progressText) this.progressText.style.display = 'none';
        }
    }

    hideLoading() {
        if (this.loadingOverlay) this.loadingOverlay.style.display = 'none';
    }

    showProgress(message, percent) {
        this.showLoading(message); // Show overlay first
        if (this.progressContainer) this.progressContainer.style.display = 'block';
        if (this.progressText) this.progressText.style.display = 'block';
        if (this.progressBar) this.progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
        if (this.progressText) this.progressText.textContent = `${Math.max(0, Math.min(100, percent))}%`;
    }

    // --- Drop Zone Indicator ---
    showDropZone(message = 'Drop image to add to canvas') {
        if (this.dropZoneIndicator) {
            const msgElement = this.dropZoneIndicator.querySelector('#drop-message');
            if (msgElement) msgElement.textContent = message;
            this.dropZoneIndicator.style.display = 'block';
        }
    }
    hideDropZone() {
        if (this.dropZoneIndicator) this.dropZoneIndicator.style.display = 'none';
    }

} // End CanvasView Class
