import { OPTIMISM_UTILS } from '../utils.js';

export class UndoRedoManager {
    constructor(model, controller) {
        this.model = model;
        this.controller = controller;
        this.undoButton = null;
        this.redoButton = null;
    }

    setup() {
        OPTIMISM_UTILS.log("UndoRedoManager: Setting up...");
        this.undoButton = document.getElementById('settings-undo-button');
        this.redoButton = document.getElementById('settings-redo-button');

        if (this.undoButton) {
            this.undoButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation(); // Prevent settings panel close
                if (!this.undoButton.disabled) {
                    this.controller.undo();
                }
            });
        } else {
             OPTIMISM_UTILS.logError("UndoRedoManager: Undo button (#settings-undo-button) not found.");
        }

        if (this.redoButton) {
            this.redoButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!this.redoButton.disabled) {
                    this.controller.redo();
                }
            });
        } else {
             OPTIMISM_UTILS.logError("UndoRedoManager: Redo button (#settings-redo-button) not found.");
        }


        this.updateButtons(); // Set initial state
        OPTIMISM_UTILS.log("UndoRedoManager: Setup complete.");
    }

    // Updates the enabled/disabled state of the buttons based on model state
    updateButtons() {
        if (this.undoButton) {
            this.undoButton.disabled = !this.model.canUndo();
            // Optionally add/remove a disabled class for styling
             this.undoButton.classList.toggle('disabled', !this.model.canUndo());
        }
        if (this.redoButton) {
            this.redoButton.disabled = !this.model.canRedo();
             this.redoButton.classList.toggle('disabled', !this.model.canRedo());
        }
    }

} // End UndoRedoManager Class