import { OPTIMISM_UTILS } from '../utils.js';

export class SettingsManager {
    constructor(model, controller, view) {
        this.model = model;
        this.controller = controller;
        this.view = view; // Needed for accessing modal manager etc.

        this.settingsPanel = document.getElementById('settings-panel');

        // References to buttons within the settings panel
        // These will be re-checked in setupButtonListeners
        this.undoButton = null;
        this.redoButton = null;
        this.gridButton = null;
        this.copyLinkButton = null;
        this.lockImagesButton = null;
        this.nestingButton = null;
        this.exportButton = null;
        this.exportNoImagesButton = null;
        this.importButton = null;
        this.connectTodoistButton = null; // Added
        this.disconnectTodoistButton = null; // Added
        this.debugButton = null;
    }

    setup() {
        OPTIMISM_UTILS.log("SettingsManager: Setting up...");
        if (!this.settingsPanel) {
             OPTIMISM_UTILS.logError("SettingsManager: Settings panel element not found.");
             return;
        }

        // Add listeners for buttons managed here
        this._setupButtonListeners();
        // Initial state update might happen slightly later now due to microtask
        // this.updateAllButtonStates(); // Set initial states - Moved inside microtask

        OPTIMISM_UTILS.log("SettingsManager: Setup complete (listeners deferred).");
    }

    _setupButtonListeners() {
        // Defer finding elements and attaching listeners slightly
        queueMicrotask(() => {
            OPTIMISM_UTILS.log("SettingsManager: Running deferred button listener setup...");

            // Re-find buttons within the microtask, DOM should be updated now
            // Note: Undo/Redo/Debug buttons are found by their respective managers,
            // but we might need references here if we were attaching listeners here.
            // We only need to find the ones this manager *directly* adds listeners to.
            this.gridButton = document.getElementById('settings-grid-button');
            this.copyLinkButton = document.getElementById('settings-copy-link-button');
            this.lockImagesButton = document.getElementById('settings-lock-images-button');
            this.nestingButton = document.getElementById('settings-disable-nesting-button');
            this.exportButton = document.getElementById('settings-export-button');
            this.exportNoImagesButton = document.getElementById('settings-export-no-images-button');
            this.importButton = document.getElementById('settings-import-button');
            this.connectTodoistButton = document.getElementById('settings-connect-todoist'); // Added
            this.disconnectTodoistButton = document.getElementById('settings-disconnect-todoist'); // Added

            // --- Attach Listeners ---
            if (this.gridButton) {
                this.gridButton.addEventListener('click', (e) => {
                    e.preventDefault(); e.stopPropagation();
                    this.controller.toggleGridVisibility();
                    this.view.panelManager.hidePanel('settings');
                });
            } else { OPTIMISM_UTILS.logError("SettingsManager (deferred): Grid button (#settings-grid-button) not found."); }

            if (this.copyLinkButton) {
                this.copyLinkButton.addEventListener('click', (e) => {
                    e.preventDefault(); e.stopPropagation();
                    navigator.clipboard.writeText(window.location.href)
                        .then(() => {
                            OPTIMISM_UTILS.log('URL copied!');
                            this.copyLinkButton.textContent = 'Copied!';
                            setTimeout(() => { if(this.copyLinkButton) this.copyLinkButton.textContent = 'Copy Link'; }, 1500);
                         })
                        .catch(err => OPTIMISM_UTILS.logError('Could not copy URL:', err));
                });
            } else { OPTIMISM_UTILS.logError("SettingsManager (deferred): Copy Link button (#settings-copy-link-button) not found."); }

            if (this.lockImagesButton) {
                this.lockImagesButton.addEventListener('click', (e) => {
                    e.preventDefault(); e.stopPropagation();
                    this.controller.toggleImagesLocked();
                });
            } else { OPTIMISM_UTILS.logError("SettingsManager (deferred): Lock Images button (#settings-lock-images-button) not found."); }

            if (this.nestingButton) {
                this.nestingButton.addEventListener('click', (e) => {
                    e.preventDefault(); e.stopPropagation();
                    console.error("%%%%% Nesting Toggle Button CLICKED! %%%%%");
                    OPTIMISM_UTILS.log("SettingsManager: Nesting toggle button clicked.");
                    this.controller.toggleNestingDisabled();
                });
            } else { OPTIMISM_UTILS.logError("SettingsManager (deferred): Nesting button (#settings-disable-nesting-button) not found."); }

            if (this.exportButton) {
                this.exportButton.addEventListener('click', (e) => {
                    e.preventDefault(); e.stopPropagation();
                    this.controller.exportData(true); // Export with images
                    this.view.panelManager.hidePanel('settings'); // Close panel after action
                });
            } else { OPTIMISM_UTILS.logError("SettingsManager (deferred): Export button (#settings-export-button) not found."); }

            if (this.exportNoImagesButton) {
                this.exportNoImagesButton.addEventListener('click', (e) => {
                    e.preventDefault(); e.stopPropagation();
                    this.controller.exportData(false); // Export without images
                    this.view.panelManager.hidePanel('settings'); // Close panel
                });
            } else { OPTIMISM_UTILS.logError("SettingsManager (deferred): Export No Images button (#settings-export-no-images-button) not found."); }

            if (this.importButton) {
                this.importButton.addEventListener('click', (e) => {
                    e.preventDefault(); e.stopPropagation();
                    this.view.modalManager.showImportConfirmation(); // Show confirmation dialog
                    // Don't close settings panel yet, wait for confirmation/cancel
                });
            } else { OPTIMISM_UTILS.logError("SettingsManager (deferred): Import button (#settings-import-button) not found."); }

            if (this.connectTodoistButton) {
                this.connectTodoistButton.addEventListener('click', (e) => {
                    e.preventDefault(); e.stopPropagation();
                    const token = prompt("Enter your Todoist API Token (Find it in Todoist Settings > Integrations > Developer):");
                    if (token && token.trim() !== "") {
                        this.controller.connectTodoist(token.trim());
                        this.view.panelManager.hidePanel('settings'); // Close panel after connecting
                    } else {
                        OPTIMISM_UTILS.log("Todoist connection cancelled or token empty.");
                    }
                });
            } else { OPTIMISM_UTILS.logError("SettingsManager (deferred): Connect Todoist button (#settings-connect-todoist) not found."); }

            if (this.disconnectTodoistButton) {
                this.disconnectTodoistButton.addEventListener('click', (e) => {
                    e.preventDefault(); e.stopPropagation();
                    if (confirm("Are you sure you want to disconnect from Todoist?")) {
                        this.controller.disconnectTodoist();
                        // Optionally close settings panel: this.view.panelManager.hidePanel('settings');
                    }
                });
            } else { OPTIMISM_UTILS.logError("SettingsManager (deferred): Disconnect Todoist button (#settings-disconnect-todoist) not found."); }


            // Update button states after attaching listeners
            this.updateAllButtonStates(); // Ensure states are correct after potential creation/finding
            OPTIMISM_UTILS.log("SettingsManager: Deferred button listeners attached.");
        }); // End queueMicrotask
    }


    // --- Button State Updates (Called by other managers/controller) ---

    updateAllButtonStates() {
         // Ensure buttons are found before updating text
         if (!this.lockImagesButton) this.lockImagesButton = document.getElementById('settings-lock-images-button');
         if (!this.nestingButton) this.nestingButton = document.getElementById('settings-disable-nesting-button');
         if (!this.connectTodoistButton) this.connectTodoistButton = document.getElementById('settings-connect-todoist');
         if (!this.disconnectTodoistButton) this.disconnectTodoistButton = document.getElementById('settings-disconnect-todoist');

         this.updateLockImagesButton(this.model.imagesLocked);
         this.updateNestingButton(this.model.isNestingDisabled);
         // Undo/Redo state updated by UndoRedoManager
         // Show/Hide Todoist connect/disconnect buttons
         this.updateTodoistButtonsVisibility(this.model.todoistConnected);
         // Debug state updated by DebugManager
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

    updateTodoistButtonsVisibility(isConnected) {
        if (this.connectTodoistButton) this.connectTodoistButton.style.display = isConnected ? 'none' : 'inline-block';
        if (this.disconnectTodoistButton) this.disconnectTodoistButton.style.display = isConnected ? 'inline-block' : 'none';
        // Also update the main toggle button state via the TodoistManager
        this.view.managers.todoist?.updateToggleButtonState();
    }

} // End SettingsManager Class
