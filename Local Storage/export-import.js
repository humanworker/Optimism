/**
 * ExportImportManager - Handles exporting and importing of application data
 * This manager takes care of serializing the database into a JSON file for
 * export and importing that data back into the application.
 */
class ExportImportManager {
    constructor(model, view) {
        this.model = model;
        this.view = view;
        this.exportVersion = '1.0';
    }

    /**
     * Exports all application data to a JSON file
     */
    async exportData() {
        try {
            this.view.showProgress('Preparing export...', 0);

            // Create the base export structure with version and timestamp
// In export-import.js, in the exportData method, make sure we're exporting these values
const exportData = {
    version: this.exportVersion,
    timestamp: new Date().toISOString(),
    data: {
        nodes: {},
        theme: await this.model.db.getTheme(),
        images: {},
        editCounter: this.model.editCounter,
        lastBackupReminder: this.model.lastBackupReminder
    }
};

            // Get all node keys
            const nodeKeys = await this.model.db.getAllKeys('canvasData');
            const totalNodes = nodeKeys.length;
            
            // Export each node
            for (let i = 0; i < nodeKeys.length; i++) {
                const nodeId = nodeKeys[i];
                const nodeData = await this.model.db.getData('canvasData', nodeId);
                
                if (nodeData) {
                    exportData.data.nodes[nodeId] = nodeData;
                }
                
                // Update progress for nodes (0-50%)
                const nodeProgress = Math.floor((i / totalNodes) * 50);
                this.view.showProgress('Exporting nodes...', nodeProgress);
            }
            
            // Get all image keys
            const imageKeys = await this.model.db.getAllKeys('imageData');
            const totalImages = imageKeys.length;
            
            // Export each image
            for (let i = 0; i < imageKeys.length; i++) {
                const imageId = imageKeys[i];
                const imageData = await this.model.db.getImage(imageId);
                
                if (imageData) {
                    exportData.data.images[imageId] = imageData;
                }
                
                // Update progress for images (50-95%)
                const imageProgress = 50 + Math.floor((i / totalImages) * 45);
                this.view.showProgress('Exporting images...', imageProgress);
            }
            
            // Convert the export data to a JSON string
            const jsonData = JSON.stringify(exportData);
            
            // Create a blob and link for downloading
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            // Generate a filename based on the current date
            const date = new Date();
            const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            const filename = `optimism_backup_${formattedDate}.json`;
            
           // Create a download link and trigger the download
           const link = document.createElement('a');
           link.href = url;
           link.download = filename;
           link.style.display = 'none';
           document.body.appendChild(link);
           
           // Update progress to 100%
           this.view.showProgress('Finalizing export...', 100);
           
           // Trigger the download after a small delay to show 100% progress
           setTimeout(() => {
               link.click();
               document.body.removeChild(link);
               URL.revokeObjectURL(url);
               this.view.hideLoading();
           }, 500);

           // Reset backup reminder after successful export
this.model.resetBackupReminder();
           
           return true;
       } catch (error) {
           logError('Error during export:', error);
           this.view.hideLoading();
           return false;
       }
   }

  /**
 * Imports application data from a JSON file
 * @param {File} file - The JSON file to import
 */
async importData(file) {
    try {
        this.view.showProgress('Preparing import...', 0);
        
        // Read the file content
        const fileContent = await this.readFileAsText(file);
        
        // Parse the JSON data
        let importData;
        try {
            importData = JSON.parse(fileContent);
        } catch (error) {
            logError('Error parsing import file:', error);
            throw new Error('Invalid JSON format');
        }
        
        // Validate the import data
        if (!this.validateImportData(importData)) {
            throw new Error('Invalid import data format');
        }
        
        // Clear existing data
        this.view.showProgress('Clearing existing data...', 10);
        await this.clearExistingData();
        
        // Import theme data
        this.view.showProgress('Importing theme settings...', 15);
        if (importData.data.theme) {
            await this.model.db.saveTheme(importData.data.theme);
            this.model.isDarkTheme = importData.data.theme.isDarkTheme;
            this.view.updateTheme(this.model.isDarkTheme);
        }
        
        // Import nodes
        const nodeIds = Object.keys(importData.data.nodes);
        const totalNodes = nodeIds.length;
        
        this.view.showProgress('Importing nodes...', 20);
        for (let i = 0; i < nodeIds.length; i++) {
            const nodeId = nodeIds[i];
            const nodeData = importData.data.nodes[nodeId];
            
            if (nodeData) {
                await this.model.db.put('canvasData', nodeData);
            }
            
            // Update progress for nodes (20-70%)
            const nodeProgress = 20 + Math.floor((i / totalNodes) * 50);
            this.view.showProgress('Importing nodes...', nodeProgress);
        }
        
        // Import images
        const imageIds = Object.keys(importData.data.images);
        const totalImages = imageIds.length;
        
        this.view.showProgress('Importing images...', 70);
        for (let i = 0; i < imageIds.length; i++) {
            const imageId = imageIds[i];
            const imageData = importData.data.images[imageId];
            
            if (imageData) {
                await this.model.db.saveImage(imageId, imageData);
            }
            
            // Update progress for images (70-95%)
            const imageProgress = 70 + Math.floor((i / totalImages) * 25);
            this.view.showProgress('Importing images...', imageProgress);
        }

        // Import edit counter and backup reminder state
        this.view.showProgress('Importing application state...', 90);
        if (importData.data.editCounter !== undefined) {
            this.model.editCounter = importData.data.editCounter;
            OPTIMISM.log(`Imported edit counter: ${this.model.editCounter}`);
        }
        if (importData.data.lastBackupReminder !== undefined) {
            this.model.lastBackupReminder = importData.data.lastBackupReminder;
            OPTIMISM.log(`Imported last backup reminder: ${this.model.lastBackupReminder}`);
        }
        
        // Save the app state after import to ensure it persists
        await this.model.saveAppState();
        
        // Reload the data
        this.view.showProgress('Finalizing import...', 95);
        await this.model.loadData();
        
        // Update progress to 100%
        this.view.showProgress('Import complete!', 100);
        
        // Hide the loading overlay after a short delay
        setTimeout(() => {
            this.view.hideLoading();
        }, 500);
        
        return true;
    } catch (error) {
        logError('Error during import:', error);
        this.view.hideLoading();
        return false;
    }
}

   /**
    * Validates the import data structure
    * @param {Object} data - The import data to validate
    * @returns {boolean} - True if the data is valid
    */
   validateImportData(data) {
       // Check if the data has the required structure
       if (!data || typeof data !== 'object') {
           return false;
       }
       
       // Check for version
       if (!data.version) {
           return false;
       }
       
       // Check for data object
       if (!data.data || typeof data.data !== 'object') {
           return false;
       }
       
       // Check for nodes and images
       if (!data.data.nodes || typeof data.data.nodes !== 'object' ||
           !data.data.images || typeof data.data.images !== 'object') {
           return false;
       }
       
       // Check for root node
       if (!data.data.nodes.root) {
           return false;
       }
       
       return true;
   }

   /**
    * Clears all existing data from the database
    */
   async clearExistingData() {
       // Clear each store
       await this.model.db.clearStore('canvasData');
       await this.model.db.clearStore('imageData');
   }

   /**
    * Reads a file as text
    * @param {File} file - The file to read
    * @returns {Promise<string>} - A promise that resolves with the file content
    */
   readFileAsText(file) {
       return new Promise((resolve, reject) => {
           const reader = new FileReader();
           
           reader.onload = (event) => {
               resolve(event.target.result);
           };
           
           reader.onerror = (error) => {
               reject(error);
           };
           
           reader.readAsText(file);
       });
   }
}