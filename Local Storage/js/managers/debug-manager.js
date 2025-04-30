import { OPTIMISM_UTILS } from '../utils.js';

export class DebugManager {
    constructor(model, controller) {
        this.model = model;
        this.controller = controller;
        this.debugPanel = document.getElementById('debug-panel');
        this.toggleButton = null; // Button is inside settings panel
    }

    setup() {
        OPTIMISM_UTILS.log("DebugManager: Setting up...");
        this.toggleButton = document.getElementById('settings-debug-toggle');

        if (this.toggleButton) {
            this.toggleButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation(); // Prevent settings panel close
                this.controller.toggleDebugPanel(); // Controller updates model and calls view update
            });
            this.updateButtonText(this.model.isDebugVisible); // Set initial text
        } else {
             OPTIMISM_UTILS.logError("DebugManager: Debug toggle button (#settings-debug-toggle) not found.");
        }

        // Set initial visibility from model
        this.updateVisibility(this.model.isDebugVisible);
        OPTIMISM_UTILS.log("DebugManager: Setup complete.");
    }

    // Updates the visibility of the debug panel DOM element
    updateVisibility(isVisible) {
        if (this.debugPanel) {
            this.debugPanel.style.display = isVisible ? 'block' : 'none';
            this.updateButtonText(isVisible);
            if (isVisible) OPTIMISM_UTILS.log("Debug panel shown.");
        }
    }

    // Updates the text of the toggle button
    updateButtonText(isVisible) {
         if (this.toggleButton) {
             this.toggleButton.textContent = isVisible ? 'Hide Debug' : 'Show Debug';
         }
    }

} // End DebugManager Class