import { OPTIMISM_UTILS } from '../utils.js';

export class ThemeManager {
    constructor(model, controller) {
        this.model = model;
        this.controller = controller;
        this.toggleButton = null; // Reference to the theme toggle button in settings
    }

    setup() {
        OPTIMISM_UTILS.log("ThemeManager: Setting up...");
        // The toggle button is part of the settings panel, find it there
        this.toggleButton = document.getElementById('settings-theme-toggle');

        if (this.toggleButton) {
            this.toggleButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation(); // Prevent settings panel from closing
                this.controller.toggleTheme(); // Controller handles model update and calls view update
            });
        } else {
            OPTIMISM_UTILS.logError("ThemeManager: Theme toggle button (#settings-theme-toggle) not found.");
        }

        // Apply initial theme based on model state
        this.updateTheme(this.model.isDarkTheme);
        OPTIMISM_UTILS.log("ThemeManager: Setup complete.");
    }

    // Applies the correct theme class to the body
    updateTheme(isDarkTheme) {
        OPTIMISM_UTILS.log(`ThemeManager: Updating theme to ${isDarkTheme ? 'dark' : 'light'}`);
        document.body.classList.toggle('light-theme', !isDarkTheme);
        // Optional: Update toggle button text/icon if needed
        // if (this.toggleButton) {
        //     this.toggleButton.textContent = isDarkTheme ? 'Switch to Light Theme' : 'Switch to Dark Theme';
        // }
    }

} // End ThemeManager Class