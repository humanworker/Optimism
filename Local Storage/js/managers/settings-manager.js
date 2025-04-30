import { OPTIMISM_UTILS } from '../utils.js';

export class SettingsManager {
    constructor(model, controller, view) {
        this.model = model;
        this.controller = controller;
        this.view = view; // Needed for accessing modal manager etc.

        this.settingsPanel = document.getElementById('settings-panel');

        // References to buttons within the settings panel
        this.undoButton = document.getElementById('settings-undo-button');
        this.redoButton = document.getElementById('settings-redo-button');
        this.gridButton = document.getElementById('settings-grid-button');
        this.copyLinkButton = document.getElementById('settings-copy-link-button');
        this.lockImagesButton = document.getElementById('settings-lock-images-button');
        this.nestingButton = document.getElementById('settings-disable-nesting-button');
        this.exportButton = document.getElementById('settings-export-button');
        this.exportNoImagesButton = document.getElementById('settings-export-no-images-button');
        this.importButton = document.getElementById('settings-import-button');
        this.themeButton = document.getElementById('settings-theme-toggle');
        this.debugButton = document.getElementById('settings-debug-toggle');
    }

    setup() {
        OPTIMISM_UTILS.log("SettingsManager: Setting up...");
        if (!this.settingsPanel) {
             OPTIMISM_UTILS.logError("SettingsManager: Settings panel element not found.");
             return;
        }

        // Add listeners for buttons managed here
        this._setupButtonListeners();
        this.updateAllButtonStates(); // Set initial states

        OPTIMISM_UTILS.log("SettingsManager: Setup complete.");
    }

    _setupButtonListeners() {
        // Note: Undo/Redo listeners are handled by UndoRedoManager
        // Note: Grid, Theme, Debug listeners handled by their respective managers
        // No, Grid button listener IS handled here.
        // CORRECTION: Grid button *is* handled here as it's inside settings panel
        if (this.gridButton) {
            this.gridButton.addEventListener('click', (e) => {
                e.preventDefault(); // It's a link
                e.stopPropagation();
                this.controller.toggleGridVisibility(); // Toggle the grid panel
                this.view.panelManager.hidePanel('settings'); // Hide settings after clicking
            });
        } else {
            // *** ADD Safeguard Check ***
            this.gridButton = document.getElementById('settings-grid-button');
            // Check again if it exists NOW, maybe DOM updated late?
            OPTIMISM_UTILS.logError("SettingsManager: Grid button (#settings-grid-button) not found.");
        }


        if (this.copyLinkButton) {
            this.copyLinkButton.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation();
                navigator.clipboard.writeText(window.location.href)
                    .then(() => OPTIMISM_UTILS.log('URL copied to clipboard'))
                    .catch(err => OPTIMISM_UTILS.logError('Could not copy URL:', err));
                 // Optionally provide visual feedback
                 this.copyLinkButton.textContent = 'Copied!';
                 setTimeout(() => { if(this.copyLinkButton) this.copyLinkButton.textContent = 'Copy Link'; }, 1500);
            });
        }

        if (this.lockImagesButton) {
            this.lockImagesButton.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation();
                this.controller.toggleImagesLocked(); // Controller updates model & calls view updates
            });
        }

        if (this.nestingButton) {
            this.nestingButton.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation();
                this.controller.toggleNestingDisabled(); // Controller updates model & button text
            });
        }

        if (this.exportButton) {
            this.exportButton.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation();
                this.controller.exportData(true); // Export with images
                 this.view.panelManager.hidePanel('settings'); // Close panel after action
            });
        }

        if (this.exportNoImagesButton) {
            this.exportNoImagesButton.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation();
                this.controller.exportData(false); // Export without images
                 this.view.panelManager.hidePanel('settings'); // Close panel
            });
        }

        if (this.importButton) {
             this.importButton.addEventListener('click', (e) => {
                  e.preventDefault(); e.stopPropagation();
                  this.view.modalManager.showImportConfirmation(); // Show confirmation dialog
                  // Don't close settings panel yet, wait for confirmation/cancel
             });
        }
    }

    // --- Button State Updates (Called by other managers/controller) ---

    updateAllButtonStates() {
         this.updateLockImagesButton(this.model.imagesLocked);
         this.updateNestingButton(this.model.isNestingDisabled);
         // Undo/Redo state updated by UndoRedoManager
         // Debug state updated by DebugManager
         // Theme state updated by ThemeManager
         // Grid state updated by PanelRenderer/Controller
    }

    updateLockImagesButton(isLocked) {
        if (this.lockImagesButton) {
            this.lockImagesButton.textContent = isLocked ? "Unlock Images" : "Lock Images";
        }
    }

    updateNestingButton(isDisabled) {
        if (this.nestingButton) {
            this.nestingButton.textContent = isDisabled ? "Enable Nesting" : "Disable Nesting";
        }
    }

} // End SettingsManager Class
