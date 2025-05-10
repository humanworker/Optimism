import { OPTIMISM_UTILS } from '../utils.js';

export class ExportImportManager {
    constructor(model, view) {
        this.model = model;
        this.view = view; // May be null initially
        this.exportVersion = '1.1'; // Increment version if format changes
    }

    // *** ADD THIS METHOD ***
    // Called by main.js or view setup to provide view reference
    assignView(viewInstance) {
        console.error("%%%%% ExportImportManager.assignView: Received view:", viewInstance ? 'VALID View instance' : 'INVALID/NULL View');
        this.view = viewInstance;
        console.error("%%%%% ExportImportManager.assignView: this.view is NOW:", this.view ? 'VALID View instance' : 'INVALID/NULL View');
    }

    // Reads a file as text
    _readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target.result);
            reader.onerror = (error) => {
                 OPTIMISM_UTILS.logError('Error reading file:', error);
                 reject(error);
            };
            reader.readAsText(file);
        });
    }

    // Validates the structure of imported data
    _validateImportData(data) {
        if (!data || typeof data !== 'object') return false;
        if (!data.version) return false; // Version required
        if (!data.data || typeof data.data !== 'object') return false;
        if (!data.data.nodes || typeof data.data.nodes !== 'object') return false;
        // Images might be optional if exported without them
        if (data.data.images && typeof data.data.images !== 'object') return false;
        if (!data.data.nodes.root) return false; // Root node must exist
        return true;
    }

    async exportData(includeImages = true) {
        console.error("%%%%% ExportImportManager.exportData: CALLED %%%%%");
        console.error("%%%%% ExportImportManager.exportData: this.model exists:", !!this.model);
        console.error("%%%%% ExportImportManager.exportData: this.view exists:", !!this.view); // <<< The crucial check

        if (!this.model || !this.view) {
             OPTIMISM_UTILS.logError("Export failed: Model or View not available.");
             alert("Export failed. Please try again later.");
             return false;
        }
        OPTIMISM_UTILS.log(`Exporting data ${includeImages ? 'with' : 'without'} images...`);
        this.view.showProgress('Preparing export...', 0);

        try {
            const exportData = {
                version: this.exportVersion,
                timestamp: new Date().toISOString(),
                data: {
                    nodes: {},
                    // theme: { isDarkTheme: this.model.isDarkTheme }, // REMOVE theme export
                    images: {},
                    // Save app state properties from model
                    editCounter: this.model.editCounter,
                    lastBackupReminder: this.model.lastBackupReminder,
                    imagesLocked: this.model.imagesLocked,
                    quickLinks: this.model.quickLinks,
                    lockedCards: this.model.lockedCards,
                    inboxCards: this.model.inboxCards,
                    gridLayout: this.model.gridLayout,
                    isNestingDisabled: this.model.isNestingDisabled,
                    priorityCards: this.model.priorityCards,
                    todoistApiToken: this.model.todoistApiToken, // EXPORT: Add token
                    elementsSentToTodoist: Array.from(this.model.elementsSentToTodoist), // EXPORT: Add sent elements
                    // Save panel states
                    isSettingsVisible: this.model.panels.settings,
                    isInboxVisible: this.model.panels.inbox,
                    isGridVisible: this.model.panels.grid,
                    isArenaVisible: this.model.panels.arena,
                    isPrioritiesVisible: this.model.panels.priorities,
                    // Include deleted image queue? Maybe not, depends on desired behavior.
                    // deletedImageQueue: this.model.deletedImageQueue
                }
            };

            // Export all nodes (including root and children)
            // Need a way to get all node IDs from the DB or traverse the structure
            const allNodeKeys = await this.model.db.getAllKeys(this.model.db.STORE_NAMES.DATA);
            // Filter out non-node keys like 'appState', 'theme' if they are in the same store
            const nodeKeys = allNodeKeys.filter(key => key !== 'appState' && key !== 'theme');

            const totalNodes = nodeKeys.length;
            for (let i = 0; i < totalNodes; i++) {
                const nodeId = nodeKeys[i];
                const nodeData = await this.model.db.getData(this.model.db.STORE_NAMES.DATA, nodeId);
                if (nodeData) {
                    exportData.data.nodes[nodeId] = nodeData;
                }
                // Update progress (0-50% for nodes)
                const nodeProgress = Math.floor(((i + 1) / totalNodes) * 50);
                this.view.showProgress(`Exporting node ${i + 1}/${totalNodes}`, nodeProgress);
            }

            // Export images if requested
            if (includeImages) {
                const imageKeys = await this.model.db.getAllKeys(this.model.db.STORE_NAMES.IMAGES);
                const totalImages = imageKeys.length;
                if (totalImages > 0) {
                     for (let i = 0; i < totalImages; i++) {
                          const imageId = imageKeys[i];
                          const imageData = await this.model.db.getImage(imageId); // Gets the base64 data
                          if (imageData) {
                              exportData.data.images[imageId] = imageData; // Store base64 directly
                          }
                          // Update progress (50-95% for images)
                          const imageProgress = 50 + Math.floor(((i + 1) / totalImages) * 45);
                           this.view.showProgress(`Exporting image ${i + 1}/${totalImages}`, imageProgress);
                     }
                } else {
                     this.view.showProgress('No images to export', 95);
                }
            } else {
                this.view.showProgress('Skipping images...', 95);
                delete exportData.data.images; // Remove the empty images object
            }

            // Finalize and Download
            const jsonData = JSON.stringify(exportData, null, 2); // Pretty print JSON
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const date = new Date();
            const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            const imgSuffix = includeImages ? '' : '_no_images';
            const filename = `optimism_backup_${formattedDate}${imgSuffix}.json`;

            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.style.display = 'none';
            document.body.appendChild(link);

            this.view.showProgress('Finalizing export...', 100);

            setTimeout(() => {
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                this.view.hideLoading();
                OPTIMISM_UTILS.log('Export complete.');
                // Reset backup reminder after successful export
                this.model.resetBackupReminder();
            }, 300);

            return true;

        } catch (error) {
            OPTIMISM_UTILS.logError('Error during export:', error);
            this.view.hideLoading();
            alert('Export failed. See console for details.');
            return false;
        }
    }

    async importData(file) {
         if (!this.model || !this.view) {
              OPTIMISM_UTILS.logError("Import failed: Model or View not available.");
              alert("Import failed. Please try again later.");
              return false;
         }
         OPTIMISM_UTILS.log('Starting data import...');
         this.view.showProgress('Preparing import...', 0);

         try {
             const fileContent = await this._readFileAsText(file);
             let importData;
             try {
                 importData = JSON.parse(fileContent);
             } catch (e) { throw new Error('Invalid JSON file.'); }

             if (!this._validateImportData(importData)) {
                 throw new Error('Invalid data format in import file.');
             }

             // --- Data validated, proceed with import ---
             this.view.showProgress('Clearing existing data...', 10);
             // Clear DB stores (handle potential errors)
             try {
                  await this.model.db.clearStore(this.model.db.STORE_NAMES.DATA);
                  await this.model.db.clearStore(this.model.db.STORE_NAMES.IMAGES);
                  await this.model.db.clearStore(this.model.db.STORE_NAMES.THEME);
             } catch (clearError) {
                  OPTIMISM_UTILS.logError('Error clearing stores during import:', clearError);
                  // Continue if possible, but data might merge unexpectedly in memory mode
             }


             // Import Theme
             this.view.showProgress('Importing theme...', 15);
             // if (importData.data.theme) { // REMOVE Theme import block
             //     this.model.isDarkTheme = importData.data.theme.isDarkTheme;
             //     await this.model.saveTheme(); // Save to DB
             //     this.view.managers.theme.updateTheme(this.model.isDarkTheme); // Update UI
             // }

             // Import Nodes
             const nodesToImport = importData.data.nodes;
             const nodeIds = Object.keys(nodesToImport);
             const totalNodes = nodeIds.length;
             this.view.showProgress(`Importing ${totalNodes} nodes...`, 20);
             for (let i = 0; i < totalNodes; i++) {
                 const nodeId = nodeIds[i];
                 try {
                      await this.model.db.put(this.model.db.STORE_NAMES.DATA, nodesToImport[nodeId]);
                 } catch (nodeError) {
                      OPTIMISM_UTILS.logError(`Error importing node ${nodeId}:`, nodeError);
                       // Optionally skip or halt import on node error
                 }
                 const nodeProgress = 20 + Math.floor(((i + 1) / totalNodes) * 50);
                 this.view.showProgress(`Importing node ${i + 1}/${totalNodes}`, nodeProgress);
             }

             // Import Images (if present)
             const imagesToImport = importData.data.images;
             if (imagesToImport) {
                 const imageIds = Object.keys(imagesToImport);
                 const totalImages = imageIds.length;
                 if (totalImages > 0) {
                      this.view.showProgress(`Importing ${totalImages} images...`, 70);
                      for (let i = 0; i < totalImages; i++) {
                          const imageId = imageIds[i];
                          try {
                               await this.model.db.saveImage(imageId, imagesToImport[imageId]);
                          } catch (imgError) {
                               OPTIMISM_UTILS.logError(`Error importing image ${imageId}:`, imgError);
                          }
                          const imageProgress = 70 + Math.floor(((i + 1) / totalImages) * 25);
                          this.view.showProgress(`Importing image ${i + 1}/${totalImages}`, imageProgress);
                      }
                 } else { this.view.showProgress('No images in import file', 95); }
             } else { this.view.showProgress('Skipping images (not in file)', 95); }

             // Import App State
             this.view.showProgress('Importing application state...', 95);
             // Apply imported state properties to the model
             this.model.editCounter = importData.data.editCounter ?? 0;
             this.model.lastBackupReminder = importData.data.lastBackupReminder ?? 0;
             this.model.imagesLocked = importData.data.imagesLocked ?? false;
             this.model.quickLinks = importData.data.quickLinks ?? [];
             this.model.lockedCards = importData.data.lockedCards ?? [];
             this.model.inboxCards = importData.data.inboxCards ?? [];
             this.model.gridLayout = importData.data.gridLayout ?? '1x2';
             this.model.isNestingDisabled = importData.data.isNestingDisabled ?? false;
             this.model.priorityCards = importData.data.priorityCards ?? [];
             this.model.todoistApiToken = importData.data.todoistApiToken ?? null; // IMPORT: Read token
             this.model.elementsSentToTodoist = new Set(Array.isArray(importData.data.elementsSentToTodoist) ? importData.data.elementsSentToTodoist : []); // IMPORT: Read sent elements
             // Set panel states
             this.model.panels.settings = importData.data.isSettingsVisible ?? false;
             this.model.panels.inbox = importData.data.isInboxVisible ?? false;
             this.model.panels.grid = importData.data.isGridVisible ?? false;
             this.model.panels.arena = importData.data.isArenaVisible ?? false;
             this.model.panels.priorities = importData.data.isPrioritiesVisible ?? false;
             // Save the combined app state (including panel states)
             await this.model.saveAppState();

             // Finalize: Reload model data from DB and re-render
             this.view.showProgress('Reloading data...', 98);
             await this.model.loadData(); // Reload everything from the newly populated DB

             this.view.showProgress('Import complete!', 100);
             OPTIMISM_UTILS.log('Import successful.');

             setTimeout(() => {
                 this.view.hideLoading();
                 // Trigger full UI refresh after import
                  if (this.view) {
                       this.view.renderWorkspace();
                       this.view.panelManager.syncAllPanelVisibilities();
                       this.view.settingsManager.updateAllButtonStates();
                       this.view.undoRedoManager.updateButtons(); // Reset undo/redo state visually
                  }
             }, 500);

             return true;

         } catch (error) {
             OPTIMISM_UTILS.logError('Error during import:', error);
             this.view.hideLoading();
             alert(`Import failed: ${error.message}`);
             // Attempt to reload previous state? Or leave as potentially partially imported?
             // Reloading previous state might be complex. Let's just alert.
             return false;
         }
    }

} // End ExportImportManager Class
