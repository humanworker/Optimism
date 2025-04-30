import { OPTIMISM_UTILS } from '../utils.js';

export class ModalManager {
    constructor(model, controller) {
        this.model = model;
        this.controller = controller;

        // Modal Elements
        this.backupModal = document.getElementById('backup-reminder-modal');
        this.remindLaterButton = document.getElementById('remind-later-button');
        this.backupNowButton = document.getElementById('backup-now-button');

        this.importConfirmDialog = document.getElementById('confirmation-dialog');
         // Use specific IDs if available, otherwise query within dialog
        this.importConfirmTitle = this.importConfirmDialog?.querySelector('.dialog-title');
        this.importConfirmMessage = this.importConfirmDialog?.querySelector('.dialog-message');
        this.importCancelButton = document.getElementById('dialog-cancel'); // Assumes generic ID
        this.importConfirmButton = document.getElementById('dialog-confirm'); // Assumes generic ID

        this.importFileInput = null; // File input created dynamically
    }

    setup() {
        OPTIMISM_UTILS.log("ModalManager: Setting up...");

        // --- Backup Reminder Modal ---
        if (this.backupModal && this.remindLaterButton && this.backupNowButton) {
            this.remindLaterButton.addEventListener('click', () => {
                this.hideBackupReminder();
                this.model.resetBackupReminder(); // Tell model reminder was handled
            });
            this.backupNowButton.addEventListener('click', () => {
                this.hideBackupReminder();
                this.model.resetBackupReminder();
                this.controller.exportData(); // Trigger export
            });
        } else {
             OPTIMISM_UTILS.logError("ModalManager: Backup reminder modal elements not found.");
        }


        // --- Import Confirmation Dialog ---
        if (this.importConfirmDialog && this.importCancelButton && this.importConfirmButton) {
             // We don't set up the main import button listener here, SettingsManager does that.
             // We only handle the confirmation dialog buttons.

            this.importCancelButton.addEventListener('click', () => {
                this.hideImportConfirmation();
            });

            this.importConfirmButton.addEventListener('click', () => {
                this.hideImportConfirmation();
                this._triggerImportFileSelection(); // Proceed with file selection
            });
        } else {
             OPTIMISM_UTILS.logError("ModalManager: Import confirmation dialog elements not found.");
        }

        OPTIMISM_UTILS.log("ModalManager: Setup complete.");
    }

    // --- Backup Reminder ---
    showBackupReminder() {
        if (this.backupModal) {
            this.backupModal.style.display = 'flex';
            OPTIMISM_UTILS.log("Backup reminder shown.");
        }
    }

    hideBackupReminder() {
        if (this.backupModal) {
            this.backupModal.style.display = 'none';
        }
    }

    // --- Import Confirmation ---
    showImportConfirmation() {
         if (this.importConfirmDialog) {
              // Optionally customize title/message if needed
              if (this.importConfirmTitle) this.importConfirmTitle.textContent = "Confirm Import";
              if (this.importConfirmMessage) this.importConfirmMessage.textContent = "Importing will replace all your current data. This action cannot be undone. Are you sure?";
              if (this.importConfirmButton) this.importConfirmButton.textContent = "Replace All Data";
              this.importConfirmDialog.style.display = 'flex';
              OPTIMISM_UTILS.log("Import confirmation shown.");
         }
    }

     hideImportConfirmation() {
          if (this.importConfirmDialog) {
              this.importConfirmDialog.style.display = 'none';
          }
     }


    // Creates and clicks a hidden file input to trigger import
    _triggerImportFileSelection() {
         // Remove existing input if it exists
         if (this.importFileInput) {
             this.importFileInput.remove();
         }

         this.importFileInput = document.createElement('input');
         this.importFileInput.type = 'file';
         this.importFileInput.accept = '.json'; // Accept only JSON
         this.importFileInput.style.display = 'none';

         this.importFileInput.addEventListener('change', (event) => {
             const file = event.target.files?.[0];
             if (file) {
                 OPTIMISM_UTILS.log(`Import file selected: ${file.name}`);
                 this.controller.importData(file); // Pass file to controller
             } else {
                  OPTIMISM_UTILS.log('Import file selection cancelled.');
             }
             // Clean up the input element after selection/cancellation
             if (this.importFileInput) {
                  this.importFileInput.remove();
                  this.importFileInput = null;
             }
         });

         document.body.appendChild(this.importFileInput);
         this.importFileInput.click(); // Open file dialog
    }

    // --- Generic Confirmation (Example) ---
    // You could extend this for other confirmations
    // showConfirmation(title, message, confirmText = 'Confirm', onConfirm = () => {}) {
    //     if (this.importConfirmDialog && this.importConfirmTitle && this.importConfirmMessage && this.importConfirmButton && this.importCancelButton) {
    //         this.importConfirmTitle.textContent = title;
    //         this.importConfirmMessage.textContent = message;
    //         this.importConfirmButton.textContent = confirmText;
    //
    //         // Remove previous listeners before adding new ones
    //         const newConfirmButton = this.importConfirmButton.cloneNode(true);
    //         this.importConfirmButton.parentNode.replaceChild(newConfirmButton, this.importConfirmButton);
    //         this.importConfirmButton = newConfirmButton;
    //
    //         const newCancelButton = this.importCancelButton.cloneNode(true);
    //         this.importCancelButton.parentNode.replaceChild(newCancelButton, this.importCancelButton);
    //         this.importCancelButton = newCancelButton;
    //
    //         // Add new listeners
    //         this.importConfirmButton.addEventListener('click', () => {
    //             this.hideImportConfirmation();
    //             onConfirm(); // Execute the callback
    //         }, { once: true }); // Ensure listener runs only once
    //
    //         this.importCancelButton.addEventListener('click', () => {
    //             this.hideImportConfirmation();
    //         }, { once: true });
    //
    //         this.importConfirmDialog.style.display = 'flex';
    //     }
    // }


} // End ModalManager Class