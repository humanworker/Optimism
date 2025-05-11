import { OPTIMISM_UTILS } from './utils.js';
import { ExportImportManager } from './managers/export-import-manager.js';
import {
    AddElementCommand,
    UpdateElementCommand,
    DeleteElementCommand,
    MoveElementCommand,
    MoveElementToBreadcrumbCommand,
    MoveToInboxCommand
    // Add other commands if needed by Todoist actions
} from './commands.js';

export class CanvasController {
    constructor(model) {
        if (!model) throw new Error("CanvasController requires a model instance.");
        this.model = model;
        this.view = null; // Will be assigned after view initialization
        this.exportImportManager = null;
        this.isInitialized = false;
    }

    // Called by main.js after essential components are created
    async initialize() {
        OPTIMISM_UTILS.log('Initializing controller...');
        try {
            // Initialize model (loads data, theme, etc.)
            await this.model.initialize();

            // Initialize managers that depend on the model
            // REMOVE Instantiation from here
            // this.exportImportManager = new ExportImportManager(this.model, null); // View might be needed later


             // Controller is ready, model data is loaded
             this.isInitialized = true;
             OPTIMISM_UTILS.log('Controller initialized successfully.');
             return true;
        } catch (error) {
            OPTIMISM_UTILS.logError('Failed to initialize controller:', error);
            this.isInitialized = false;
            return false;
        }
    }

    // Assign view reference (called from main.js or view constructor)
    assignView(view) {
        console.error("%%%%% controller.assignView: Received view:", view ? 'VALID View instance' : 'INVALID/NULL View');
        this.view = view; // Assign view to controller
        OPTIMISM_UTILS.log("Controller: View assigned.");
        // *** Instantiate ExportImportManager HERE, now that view is guaranteed to exist ***
        if (!this.exportImportManager && this.model && this.view) { // Ensure model/view exist and manager not already created
            this.exportImportManager = new ExportImportManager(this.model, this.view); // Pass model AND view
            OPTIMISM_UTILS.log("Controller: ExportImportManager instantiated with View.");
        } else {
            // This log helps determine if the manager doesn't exist yet when assignView is called
            console.error("%%%%% controller.assignView: exportImportManager is NULL/UNDEFINED at this point!");
        }
        // Initialize other managers that need the view here? Or handle in view setup?
        // Let's assume view setup handles manager initialization that needs the view.
    }

    // --- Core Element Actions ---

    async createElement(x, y) {
        if (!this.isInitialized) return;
        OPTIMISM_UTILS.log(`Controller: Creating text element at (${x}, ${y})`);
        try {
            const element = {
                id: crypto.randomUUID(),
                type: 'text', x, y, text: '',
                width: 200, height: 100, // Default dimensions
                style: { // Default styles
                    textSize: 'small', textColor: 'default', textAlign: 'left',
                    hasHeader: false, isHighlighted: false, isItalic: false, hasBorder: false,
                    cardBgColor: 'none', isLocked: false,
                },
                autoSize: true // Enable auto-sizing for new elements
            };
            const command = new AddElementCommand(this.model, element);
            const { result, showBackupReminder } = await this.model.execute(command);

            if (result && this.view) {
                 const elemDOM = this.view.renderer.element.createTextElementDOM(element); // Use renderer
                 this.view.renderer.element.focusNewElement(elemDOM);
                 this.view.managers.undoRedo.updateButtons();
                 this.view.updateSpacerPosition(); // Request view update
                 if (showBackupReminder) this.view.managers.modal.showBackupReminder();
                 OPTIMISM_UTILS.log('Controller: Text element created successfully.');
            }
        } catch (error) {
            OPTIMISM_UTILS.logError('Error creating element:', error);
        }
    }

    async createCanvasCardFromText(text, x, y) {
        if (!this.isInitialized) return;
        OPTIMISM_UTILS.log(`Controller: Creating canvas card from text at (${x}, ${y})`);
        try {
            const element = {
                id: crypto.randomUUID(),
                type: 'text', x, y, text: text, // Use provided text
                width: 200, height: 100, // Default dimensions
                style: { // Default styles
                    textSize: 'small', textColor: 'default', textAlign: 'left',
                    hasHeader: false, isHighlighted: false, hasBorder: false,
                    cardBgColor: 'none', isLocked: false,
                },
                autoSize: true // Enable auto-sizing
            };
            const command = new AddElementCommand(this.model, element);
            const { result, showBackupReminder } = await this.model.execute(command);

            if (result && this.view) {
                 this.view.renderWorkspace(); // Re-render to show the new card
                 if (showBackupReminder) this.view.managers.modal.showBackupReminder();
                 OPTIMISM_UTILS.log('Controller: Canvas card from text created successfully.');
            }
        } catch (error) {
            OPTIMISM_UTILS.logError('Error creating canvas card from text:', error);
        }
    }

    async addImage(file, x, y) {
        if (!this.isInitialized) throw new Error('Controller not initialized');
        OPTIMISM_UTILS.log(`Controller: Adding image at (${x}, ${y})`);
        try {
            const processedImage = await OPTIMISM_UTILS.resizeImage(file, 1200, 0.95, 600);
            const element = {
                id: crypto.randomUUID(),
                type: 'image', x, y,
                imageDataId: crypto.randomUUID(), // Separate ID for image blob
                width: processedImage.width, // Display width
                height: processedImage.height, // Display height
                storageWidth: processedImage.storageWidth, // Storage dimensions
                storageHeight: processedImage.storageHeight,
                style: { // Default styles for images
                     cardBgColor: 'none', hasBorder: false, isLocked: false,
                },
                zIndex: this.view.renderer.element.findHighestImageZIndex() + 1 // Set z-index
            };
            const command = new AddElementCommand(this.model, element);
            command.setImageData(processedImage.data); // Pass image data to command

            const { result, showBackupReminder } = await this.model.execute(command);

            if (result && this.view) {
                await this.view.renderer.element.createImageElementDOM(element); // Await DOM creation
                this.view.managers.undoRedo.updateButtons();
                 this.view.updateSpacerPosition(); // Request view update
                if (showBackupReminder) this.view.managers.modal.showBackupReminder();
                OPTIMISM_UTILS.log('Controller: Image added successfully.');
                return element.id;
            }
            return null;
        } catch (error) {
            OPTIMISM_UTILS.logError('Error adding image:', error);
            throw error; // Re-throw for UI feedback
        }
    }

    async addImageFromUrl(url, x, y) {
        if (!this.isInitialized) throw new Error('Controller not initialized');
        console.error(`%%%%% controller.addImageFromUrl CALLED with URL: ${url} %%%%%`); // Log entry
        OPTIMISM_UTILS.log(`Controller: Adding image from URL: ${url}`);
        try {
            // Clean Are.na URLs
            let originalUrl = url; // Keep original for logging
            if (url.includes('d2w9rnfcy7mm78.cloudfront.net')) {
                url = url.split('?')[0];
                 OPTIMISM_UTILS.log(`Cleaned Are.na URL: ${url}`);
            }

            // Use proxy
            const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(url)}&default=default`;
            OPTIMISM_UTILS.log(`Using image proxy: ${proxyUrl}`);
            console.error(`%%%%% controller.addImageFromUrl: Fetching via proxy: ${proxyUrl} %%%%%`);

            // Fetch as blob via proxy
            const response = await fetch(proxyUrl);
            console.error(`%%%%% controller.addImageFromUrl: Proxy fetch response status: ${response.status} ${response.ok} %%%%%`);
            if (!response.ok) throw new Error(`Failed to fetch image via proxy (${response.status})`);

            const blob = await response.blob();
            console.error(`%%%%% controller.addImageFromUrl: Received blob type: ${blob.type}, size: ${blob.size} %%%%%`);
            if (!blob.type.startsWith('image/')) throw new Error('Fetched content is not an image type.');
            if (blob.size === 0) throw new Error('Fetched image blob is empty.');

            const file = new File([blob], `image.${blob.type.split('/')[1] || 'png'}`, { type: blob.type });
            console.error(`%%%%% controller.addImageFromUrl: Created File object, calling controller.addImage... %%%%%`);

            // Use the existing addImage method
            const newElementId = await this.addImage(file, x, y); // Await the result
            console.error(`%%%%% controller.addImageFromUrl: controller.addImage returned: ${newElementId} %%%%%`);
            return newElementId; // Return the ID from addImage

        } catch (error) {
            OPTIMISM_UTILS.logError(`Error adding image from URL (${originalUrl}):`, error); // Log original URL on error
            console.error(`%%%%% controller.addImageFromUrl: ERROR - ${error.message} %%%%%`); // Log specific error
            throw error; // Re-throw so caller (ArenaManager) knows it failed
        }
    }

    // Simplified update - handles text deletion internally via model.updateElement
    async updateElement(id, properties) {
        if (!this.isInitialized) return false;
        // OPTIMISM_UTILS.log(`Controller: Updating element ${id} with:`, properties); // Can be verbose
        try {
            const command = new UpdateElementCommand(this.model, id, properties);
            const { result, showBackupReminder } = await this.model.execute(command);

            if (!result) {
                 OPTIMISM_UTILS.log(`Element ${id} likely deleted during update.`);
                 // If deleted, view update happens via renderWorkspace triggered by undo/redo update
                 if(this.view) this.view.managers.undoRedo.updateButtons();
                 return false; // Indicate deletion or failure
            }

            // Element still exists, trigger necessary updates
            const updatedElement = this.model.findElement(id); // Get potentially updated data
            if (updatedElement && this.view) {
                 // Sync the specific element's display
                 this.view.renderer.element.syncElementDisplay(id);

                 // Update navigation/title if text changed
                 if (properties.text !== undefined && updatedElement.type === 'text') {
                      await this.model.updateNavigationTitles(id, properties.text);
                      this.view.renderer.navigation.renderBreadcrumbs();
                      this.view.updatePageTitle();
                 }
                 this.view.managers.undoRedo.updateButtons();
                  this.view.updateSpacerPosition(); // Potentially needed if size changed
                 if (showBackupReminder) this.view.managers.modal.showBackupReminder();
                 return true; // Indicate success
            }
             OPTIMISM_UTILS.log(`Controller: Update finished for ${id}.`);
             return false; // Element not found after update?
        } catch (error) {
            OPTIMISM_UTILS.logError(`Error updating element ${id}:`, error);
            return false;
        }
    }

    // Used for style panel clicks where explicit old values aren't needed
    async updateElementStyle(id, styleProperties) {
         const element = this.model.findElement(id);
         if (!element || !this.view) return; // Need view for renderer access
         const currentStyle = element.style || {};
         const oldTextSize = currentStyle.textSize; // Store old size before update
         const newStyle = { ...currentStyle, ...styleProperties };

         await this.updateElement(id, { style: newStyle });

         // Also update the style panel UI if it's visible
         if (this.view && this.view.panelManager.isPanelVisible('style')) {
              const updatedElement = this.model.findElement(id); // Get data again AFTER update
              if(updatedElement) this.view.renderer.panel.updateStylePanelOptions(updatedElement);
         }

         // *** ADD Auto-Resize Logic ***
         // Check if textSize actually changed and it's a text element
         if (element.type === 'text' && styleProperties.textSize && styleProperties.textSize !== oldTextSize) {
             OPTIMISM_UTILS.log(`Text size changed for ${id}, triggering auto-resize.`);
             // Use a timeout to allow DOM/CSS updates for the new font size to apply before measuring
             setTimeout(async () => {
                 const container = document.querySelector(`.element-container[data-id="${id}"]`);
                 const textarea = container?.querySelector('.text-element');
                 if (container && textarea) {
                     // Recalculate optimal size based on new text size
                     this.view.renderer.element.autoSizeElement(container, textarea);
                     // Get the newly calculated dimensions
                     const newWidth = parseInt(container.style.width);
                     const newHeight = parseInt(container.style.height);
                     // Update the model with the new dimensions (use explicit undo properties)
                     await this.updateElementWithUndo(id, { width: newWidth, height: newHeight }, { width: element.width, height: element.height });
                 }
             }, 50); // Small delay (e.g., 50ms) might be needed
         }
    }

     // Used for blur/resize where explicit old values ARE needed for correct undo
     async updateElementWithUndo(id, newProperties, oldProperties) {
         if (!this.isInitialized) return false;
         try {
             const command = new UpdateElementCommand(this.model, id, newProperties, oldProperties);
             const { result, showBackupReminder } = await this.model.execute(command);

            if (!result) {
                 OPTIMISM_UTILS.log(`Element ${id} likely deleted during update with undo.`);
                 if(this.view) this.view.managers.undoRedo.updateButtons();
                 return false;
            }

             const updatedElement = this.model.findElement(id);
             if (updatedElement && this.view) {
                 // Sync the specific element's display
                 this.view.renderer.element.syncElementDisplay(id);

                // *** FIX HERE: Use newProperties ***
                if (newProperties.text !== undefined && updatedElement.type === 'text') {
                    await this.model.updateNavigationTitles(id, newProperties.text);
                    this.view.renderer.navigation.renderBreadcrumbs();
                    this.view.updatePageTitle();
                }
                 this.view.managers.undoRedo.updateButtons();
                  this.view.updateSpacerPosition();
                 if (showBackupReminder) this.view.managers.modal.showBackupReminder();
                 return true;
             }
              OPTIMISM_UTILS.log(`Controller: Update (with undo) finished for ${id}.`);
             return false;
         } catch (error) {
             OPTIMISM_UTILS.logError(`Error updating element ${id} (with undo):`, error);
             return false;
         }
     }

    async deleteElement(id) {
        if (!this.isInitialized) return false;
        OPTIMISM_UTILS.log(`Controller: Deleting element ${id}`);
        try {
             // --- Save scroll position (handled by view/manager if needed) ---
             // const scroll = this.view.getScrollPosition();

             const command = new DeleteElementCommand(this.model, id);
             const { result, showBackupReminder } = await this.model.execute(command);

             // The 'result' from DeleteElementCommand execute should ideally indicate success/failure
             // Let's assume result.success is true if deletion happened in the model
             if (result?.success && this.view) {
                 this.model.selectedElement = null; // Clear selection in model
                 this.view.panelManager.hidePanel('style'); // Hide style panel
                 this.view.renderWorkspace(); // Re-render the current workspace (where element was deleted)

                 // *** REMOVE Logic to Update Parent Element Visuals ***
                 // const deletedFromNodeId = result.parentNodeId; // ID of the node the element was deleted FROM
                 // Find the element in the PARENT view that corresponds to deletedFromNodeId
                 // const parentNavItem = this.model.navigationStack[this.model.navigationStack.length - 2]; // Get parent from stack
                 // if (parentNavItem) {
                 //     const parentElementId = deletedFromNodeId; // The node ID IS the parent element's ID
                 //     OPTIMISM_UTILS.log(`Controller: Syncing parent element ${parentElementId} after child deletion.`);
                 //     this.view.renderer.element.syncElementDisplay(parentElementId); // Trigger visual sync
                 // }
                 // this.view.setScrollPosition(scroll); // Restore scroll
                 // Parent element visuals will be updated by the renderWorkspace calling syncElementDisplay for it

                 this.view.managers.undoRedo.updateButtons();
                 if (showBackupReminder) this.view.managers.modal.showBackupReminder();
                 OPTIMISM_UTILS.log(`Controller: Element ${id} deleted successfully.`);
                 return true;
             }
             OPTIMISM_UTILS.log(`Controller: Element ${id} deletion failed or element not found.`);
             return false;
        } catch (error) {
            OPTIMISM_UTILS.logError(`Error deleting element ${id}:`, error);
            return false;
        }
    }

    // --- Navigation Actions ---

    async navigateToElement(id) {
        if (!this.isInitialized || !id) return false;
        OPTIMISM_UTILS.log(`Controller: Navigating into element ${id}`);
        try {
             const success = await this.model.navigateToElement(id);
             if (success && this.view) {
                 this.view.renderWorkspace(); // Re-render view after model changes
                 OPTIMISM_UTILS.log('Controller: Navigation successful.');
                 return true;
             }
             OPTIMISM_UTILS.log('Controller: Navigation failed.');
             return false;
        } catch (error) {
             OPTIMISM_UTILS.logError(`Error navigating into element ${id}:`, error);
             return false;
        }
    }

    async navigateToNode(nodeId) {
        if (!this.isInitialized || !nodeId) return false;
        OPTIMISM_UTILS.log(`Controller: Navigating to node ${nodeId}`);
        try {
             const success = await this.model.navigateToNode(nodeId);
             if (success && this.view) {
                 this.view.renderWorkspace(); // Re-render
                 OPTIMISM_UTILS.log('Controller: Navigation to node successful.');
                 return true;
             }
             OPTIMISM_UTILS.log('Controller: Navigation to node failed.');
             return false;
        } catch (error) {
             OPTIMISM_UTILS.logError(`Error navigating to node ${nodeId}:`, error);
             return false;
        }
    }

    async navigateBack() {
        if (!this.isInitialized) return false;
        OPTIMISM_UTILS.log(`Controller: Navigating back`);
        try {
             const success = await this.model.navigateBack();
             if (success && this.view) {
                 this.view.renderWorkspace(); // Re-render
                 OPTIMISM_UTILS.log('Controller: Navigation back successful.');
                 return true;
             }
             OPTIMISM_UTILS.log('Controller: Navigation back failed (already at root?).');
             return false;
        } catch (error) {
             OPTIMISM_UTILS.logError(`Error navigating back:`, error);
             return false;
        }
    }

    async navigateToIndex(index) {
        if (!this.isInitialized || index === undefined) return false;
        OPTIMISM_UTILS.log(`Controller: Navigating to index ${index}`);
         try {
             const success = await this.model.navigateToIndex(index);
             if (success && this.view) {
                 this.view.renderWorkspace(); // Re-render
                 OPTIMISM_UTILS.log('Controller: Navigation to index successful.');
                 return true;
             }
             OPTIMISM_UTILS.log('Controller: Navigation to index failed.');
             return false;
        } catch (error) {
             OPTIMISM_UTILS.logError(`Error navigating to index ${index}:`, error);
             return false;
        }
    }

    async navigateToBookmark(elementId) {
        if (!this.isInitialized || !elementId) return false;
        OPTIMISM_UTILS.log(`Controller: Navigating to bookmark element ${elementId}`);
        if (!this.view) return false; // Need view to show loading

        try {
            OPTIMISM_UTILS.log(`Controller: Navigating directly to content of bookmarked element ${elementId}`);
            // this.view.showLoading('Navigating...'); // REMOVE loading indicator for bookmarks

            // Call the model method for direct navigation
            const success = await this.model.navigateToElementDirectly(elementId);

            if (success) {
                OPTIMISM_UTILS.log('Controller: Direct bookmark navigation successful');
                // Ensure panels are closed before rendering
                // this.view.updatePrioritiesVisibility(false); // Close priorities panel
                this.view.renderWorkspace(); // Render the new view
                return true;
            } else {
                OPTIMISM_UTILS.logError('Controller: Bookmark navigation failed.');
                alert('Failed to navigate to the bookmark.');
                return false;
            }
        } catch (error) {
            OPTIMISM_UTILS.logError('Error navigating to bookmark:', error);
            alert('An error occurred while navigating to the bookmark.'); // Inform user
            return false;
        } finally {
             // this.view.hideLoading(); // REMOVE corresponding hideLoading
        }
    }


    // --- Move/Nesting Actions ---

    async moveElement(elementId, targetElementId) {
        if (!this.isInitialized || !elementId || !targetElementId) return false;
         OPTIMISM_UTILS.log(`Controller: Moving element ${elementId} onto ${targetElementId}`);
        try {
             const command = new MoveElementCommand(this.model, elementId, targetElementId);
             const { result, showBackupReminder } = await this.model.execute(command);

             if (result && this.view) {
                 this.view.renderWorkspace(); // Re-render
                 this.view.managers.undoRedo.updateButtons();
                 if (showBackupReminder) this.view.managers.modal.showBackupReminder();
                 OPTIMISM_UTILS.log('Controller: Element move successful.');
                 return true;
             }
             OPTIMISM_UTILS.log('Controller: Element move failed.');
             return false;
        } catch (error) {
             OPTIMISM_UTILS.logError(`Error moving element ${elementId}:`, error);
             return false;
        }
    }

    async moveElementToBreadcrumb(elementId, navIndex) {
         if (!this.isInitialized || !elementId || navIndex === undefined) return false;
         OPTIMISM_UTILS.log(`Controller: Moving element ${elementId} to nav index ${navIndex}`);
         try {
              const command = new MoveElementToBreadcrumbCommand(this.model, elementId, navIndex);
              const { result, showBackupReminder } = await this.model.execute(command);

              if (result && this.view) {
                  this.view.renderWorkspace(); // Re-render
                  this.view.managers.undoRedo.updateButtons();
                  if (showBackupReminder) this.view.managers.modal.showBackupReminder();
                  OPTIMISM_UTILS.log('Controller: Element move to breadcrumb successful.');
                  return true;
              }
              OPTIMISM_UTILS.log('Controller: Element move to breadcrumb failed.');
              return false;
         } catch (error) {
              OPTIMISM_UTILS.logError(`Error moving element ${elementId} to breadcrumb:`, error);
              return false;
         }
    }

    // --- Inbox Actions ---

    async moveToInbox(elementId) {
         if (!this.isInitialized || !elementId) return false;
         OPTIMISM_UTILS.log(`Controller: Moving element ${elementId} to inbox`);
         try {
              const command = new MoveToInboxCommand(this.model, elementId);
              const { result, showBackupReminder } = await this.model.execute(command);

              if (result && this.view) {
                   this.view.renderWorkspace(); // Remove from canvas
                   this.view.renderer.panel.renderInboxPanel(); // Add to inbox panel
                   // Ensure inbox panel is visible if not already
                   if (!this.model.panels.inbox) await this.toggleInboxVisibility();

                   this.view.managers.undoRedo.updateButtons();
                   if (showBackupReminder) this.view.managers.modal.showBackupReminder();
                   OPTIMISM_UTILS.log('Controller: Move to inbox successful.');
                   return true;
              }
              OPTIMISM_UTILS.log('Controller: Move to inbox failed.');
              return false;
         } catch (error) {
              OPTIMISM_UTILS.logError(`Error moving element ${elementId} to inbox:`, error);
              return false;
         }
    }

    async moveFromInboxToCanvas(cardId, x, y) {
        if (!this.isInitialized || !cardId) return false;
        OPTIMISM_UTILS.log(`Controller: Moving inbox card ${cardId} to canvas at (${x}, ${y})`);
        try {
             // This doesn't need a command as it's like creating a new element + deleting from inbox
             const newElementId = await this.model.moveFromInboxToCanvas(cardId, x, y);
             if (newElementId && this.view) {
                  this.view.renderWorkspace(); // Show new element on canvas
                  this.view.renderer.panel.renderInboxPanel(); // Remove from inbox panel
                  this.view.managers.undoRedo.updateButtons(); // TODO: Does this need undo? Maybe...
                  OPTIMISM_UTILS.log('Controller: Move from inbox successful.');
                  return true;
             }
             OPTIMISM_UTILS.log('Controller: Move from inbox failed.');
             return false;
        } catch (error) {
             OPTIMISM_UTILS.logError(`Error moving card ${cardId} from inbox:`, error);
             return false;
        }
    }

    async addBlankCardToInbox() {
        if (!this.isInitialized) return null;
        OPTIMISM_UTILS.log(`Controller: Adding blank card to inbox`);
        try {
             const card = await this.model.addBlankCardToInbox();
             if (card && this.view) {
                  if (!this.model.panels.inbox) await this.toggleInboxVisibility(); // Ensure visible
                  this.view.renderer.panel.renderInboxPanel(); // Re-render inbox
                  this.view.renderer.panel.focusNewInboxCard(); // Focus the new card
                  return card;
             }
             return null;
        } catch (error) {
             OPTIMISM_UTILS.logError('Error adding blank card to inbox:', error);
             return null;
        }
    }

    async updateInboxCard(id, properties) {
        if (!this.isInitialized || !id) return false;
         // OPTIMISM_UTILS.log(`Controller: Updating inbox card ${id}`); // Verbose
         try {
             // TODO: Add undo/redo for inbox updates? Requires new commands.
             const updatedCard = await this.model.updateInboxCard(id, properties);
             if (this.view) {
                 this.view.renderer.panel.renderInboxPanel(); // Re-render inbox
             }
             return !!updatedCard; // Return true if update happened (card not deleted)
         } catch (error) {
              OPTIMISM_UTILS.logError(`Error updating inbox card ${id}:`, error);
              return false;
         }
    }

    // --- Feature Toggles ---

    // Generic toggle - calls model's toggle which handles exclusivity
     async togglePanel(panelName) {
         if (!this.isInitialized || !panelName) return false;
         OPTIMISM_UTILS.log(`Controller: Toggling panel ${panelName}`);
         try {
             // Model's togglePanel now handles exclusivity rules and saves state
             const isVisible = await this.model.togglePanel(panelName);
             if (this.view) {
                  // Sync *all* panels with the possibly updated model state
                  // TODO: Need to add syncPanelsWithModelState to PanelManager
                  // For now, let's assume it exists or call syncAllPanelVisibilities
                  if (typeof this.view.panelManager.syncPanelsWithModelState === 'function') {
                       this.view.panelManager.syncPanelsWithModelState();
                  } else {
                       OPTIMISM_UTILS.logWarn("Controller: panelManager.syncPanelsWithModelState not found, using syncAllPanelVisibilities as fallback.");
                       this.view.panelManager.syncAllPanelVisibilities();
                  }
             }
             return isVisible;
         } catch (error) {
             OPTIMISM_UTILS.logError(`Error toggling panel ${panelName}:`, error);
             return false;
         }
    }

     // Explicitly show a panel (e.g., Style panel on selection)
     async showPanel(panelName) {
         if (!this.isInitialized || !panelName) return false;
          OPTIMISM_UTILS.log(`Controller: Showing panel ${panelName}`);
         try {
             await this.model.showPanel(panelName); // Model handles exclusivity & saves state
             if (this.view) {
                  // Sync *all* panels with the possibly updated model state
                  // TODO: Need to add syncPanelsWithModelState to PanelManager
                  // For now, let's assume it exists or call syncAllPanelVisibilities
                  if (typeof this.view.panelManager.syncPanelsWithModelState === 'function') {
                       this.view.panelManager.syncPanelsWithModelState();
                  } else {
                       OPTIMISM_UTILS.logWarn("Controller: panelManager.syncPanelsWithModelState not found, using syncAllPanelVisibilities as fallback.");
                       this.view.panelManager.syncAllPanelVisibilities();
                  }
             }
             return true;
         } catch (error) {
              OPTIMISM_UTILS.logError(`Error showing panel ${panelName}:`, error);
              return false;
         }
     }

    // Optional: Keep specific toggles if preferred, they just call the generic one now
    // Specific panel toggles calling the generic one
    async toggleInboxVisibility() { return this.togglePanel('inbox'); }
    async toggleGridVisibility() { return this.togglePanel('grid'); }
    async togglePrioritiesVisibility() { return this.togglePanel('priorities'); }
    async toggleArenaView() { return this.togglePanel('arena'); }
    async toggleSettingsVisibility() { return this.togglePanel('settings'); } // Keep this one

    async toggleDebugPanel() {
        if (!this.isInitialized) return false;
        OPTIMISM_UTILS.log(`Controller: Toggling debug panel`);
        const isVisible = this.model.toggleDebugPanel();
        if (this.view) this.view.managers.debug.updateVisibility(isVisible);
        return isVisible;
    }

    async toggleNestingDisabled() {
        if (!this.isInitialized) return false;
        console.error("%%%%% Controller.toggleNestingDisabled CALLED! %%%%%"); // Add prominent log
        OPTIMISM_UTILS.log(`Controller: Toggling nesting disabled`);
        const isDisabled = await this.model.toggleNestingDisabled();
        OPTIMISM_UTILS.log(`Controller: Model returned isDisabled = ${isDisabled}`); // Log the result from model
        if (this.view) this.view.managers.settings.updateNestingButton(isDisabled); // Ensure button text updates
        return isDisabled;
    }

    async toggleImagesLocked() {
        if (!this.isInitialized) return false;
        OPTIMISM_UTILS.log(`Controller: Toggling images locked`);
        const isLocked = await this.model.toggleImagesLocked();
        if (this.view) {
            this.view.managers.settings.updateLockImagesButton(isLocked);
            this.view.updateImagesLockState(isLocked); // Update element visuals
        }
        return isLocked;
    }

     async toggleCardLock(cardId) {
        if (!this.isInitialized || !cardId) return false;
        OPTIMISM_UTILS.log(`Controller: Toggling lock for card ${cardId}`);
        try {
            // TODO: Add undo/redo for card lock? Requires new command.
            const isLocked = await this.model.toggleCardLock(cardId);
            if (this.view) {
                this.view.updateCardLockState(cardId, isLocked); // Update element visual
                // Update style panel if this card is selected and panel is visible
                if (this.model.selectedElement === cardId && this.view.panelManager.isPanelVisible('style')) {
                     const elementData = this.model.findElement(cardId);
                     if(elementData) this.view.renderer.panel.updateStylePanelOptions(elementData);
                }
            }
            return isLocked;
        } catch (error) {
            OPTIMISM_UTILS.logError(`Error toggling lock for card ${cardId}:`, error);
            return this.model.isCardLocked(cardId);
        }
    }

    async toggleCardPriority(cardId) {
        if (!this.isInitialized || !cardId) return false;
         OPTIMISM_UTILS.log(`Controller: Toggling priority for card ${cardId}`);
         try {
              // TODO: Add undo/redo for priority? Requires new command.
              const isPriority = await this.model.toggleCardPriority(cardId);
              if (this.view) {
                   this.view.updateCardPriorityState(cardId, isPriority); // Update element visual
                   this.view.renderer.panel.renderPrioritiesPanel(); // Update priorities panel
              }
              return isPriority;
         } catch (error) {
              OPTIMISM_UTILS.logError(`Error toggling priority for card ${cardId}:`, error);
              return this.model.isCardPriority(cardId);
         }
    }


    // --- Grid Actions ---
    async setGridLayout(layout) {
        if (!this.isInitialized || !layout) return false;
        OPTIMISM_UTILS.log(`Controller: Setting grid layout to ${layout}`);
        try {
             // TODO: Add undo/redo for grid layout? Requires new command.
             await this.model.setGridLayout(layout);
             if (this.view) {
                  if (this.model.panels.grid) this.view.renderer.grid.renderGrid(); // Re-render grid lines
                  this.view.renderer.panel.updateGridPanelOptions(); // Update panel UI
             }
             return true;
        } catch (error) {
             OPTIMISM_UTILS.logError(`Error setting grid layout ${layout}:`, error);
             return false;
        }
    }

    // --- Quick Link Actions ---
    async addQuickLink(nodeId, nodeTitle) {
        if (!this.isInitialized || !nodeId) return false;
         OPTIMISM_UTILS.log(`Controller: Adding quick link ${nodeId}`);
        try {
             // TODO: Add undo/redo for quick links? Requires new command.
             const success = await this.model.addQuickLink(nodeId, nodeTitle);
             if (success && this.view) this.view.renderer.navigation.renderQuickLinks();
             return success;
        } catch (error) {
             OPTIMISM_UTILS.logError(`Error adding quick link ${nodeId}:`, error);
             return false;
        }
    }
    async removeQuickLink(nodeId) {
         if (!this.isInitialized || !nodeId) return false;
         OPTIMISM_UTILS.log(`Controller: Removing quick link ${nodeId}`);
         try {
              const success = await this.model.removeQuickLink(nodeId);
              if (success && this.view) this.view.renderer.navigation.renderQuickLinks();
              return success;
         } catch (error) {
              OPTIMISM_UTILS.logError(`Error removing quick link ${nodeId}:`, error);
              return false;
         }
    }
    async refreshQuickLinkExpiry(nodeId) {
         if (!this.isInitialized || !nodeId) return false;
         // OPTIMISM_UTILS.log(`Controller: Refreshing quick link expiry ${nodeId}`); // Verbose
         try {
              const success = await this.model.refreshQuickLinkExpiry(nodeId);
              if (success && this.view) this.view.renderer.navigation.renderQuickLinks();
              return success;
         } catch (error) {
              OPTIMISM_UTILS.logError(`Error refreshing quick link expiry ${nodeId}:`, error);
              return false;
         }
    }

    // --- Todoist Actions ---

    async toggleTodoistPanel() {
        if (!this.model.todoistConnected) {
             OPTIMISM_UTILS.log("Cannot toggle Todoist panel: Not connected.");
             // Optionally show a message or direct to settings
             return false;
        }
        const isVisible = await this.togglePanel('todoist'); // Use generic toggle
        if (isVisible) {
             this.view.managers.todoist.triggerRefresh(); // Use manager's triggerRefresh
        }
        return isVisible;
    }

    async connectTodoist(token) {
         if (!this.isInitialized) return false;
         OPTIMISM_UTILS.log(`Controller: Attempting to connect Todoist.`);
         await this.view.managers.todoist.storeToken(token); // Manager handles model update
         // Re-fetch tasks if panel happens to be open, or just update buttons
         this.view.managers.settings.updateAllButtonStates();
         this.view.managers.todoist.updateToggleButtonState();
         if (this.model.panels.todoist) {
              this.view.managers.todoist.triggerRefresh();
         }
    }

    async disconnectTodoist() {
        if (!this.isInitialized) return false;
        OPTIMISM_UTILS.log(`Controller: Disconnecting Todoist.`);
        await this.view.managers.todoist.clearToken(); // Manager handles model/UI updates
        this.view.managers.settings.updateAllButtonStates();
    }

    async fetchTodoistTasks() {
         if (!this.isInitialized || !this.model.todoistConnected) return [];
         OPTIMISM_UTILS.log(`Controller: Requesting Todoist tasks refresh...`);
         // The manager's triggerRefresh now handles fetching and rendering
         await this.view.managers.todoist.triggerRefresh();
         // The actual tasks data isn't directly returned here anymore,
         // as the manager updates the panel directly.
         // If other parts of the controller needed the tasks, this would need adjustment.
         // For now, it just triggers the refresh.
         return true; // Indicate refresh was triggered
    }

    // Todoist: Send selected element to Todoist (placeholder for now)
    async sendSelectedToTodoist() { console.error("sendSelectedToTodoist NOT IMPLEMENTED YET"); }

    // --- Undo/Redo Proxy ---
    async undo() {
        if (!this.isInitialized) return false;
        OPTIMISM_UTILS.log(`Controller: Requesting undo`);
        try {
             const { result, showBackupReminder } = await this.model.undo(); // Get result from undo
             if (result && this.view) { // Check if undo returned data (e.g., parentNodeId)
                  this.view.renderWorkspace(); // Full re-render after undo
                  // *** ADD Logic to Update Parent Element Visuals on Undo ***
                  if (result.parentNodeId && result.createdElementId) {
                       // Undo of delete creates an element. Sync the parent where it was created.
                       OPTIMISM_UTILS.log(`Controller: Syncing parent element ${result.parentNodeId} after undo (creation).`);
                       this.view.renderer.element.syncElementDisplay(result.parentNodeId);
                  }
                  // Add other checks if undo of other commands needs parent sync
                  this.view.managers.undoRedo.updateButtons();
             }
             return !!result; // Return true if undo happened
        } catch (error) {
             OPTIMISM_UTILS.logError(`Error during undo action:`, error);
             return false;
        }
    }
    async redo() {
         if (!this.isInitialized) return false;
         OPTIMISM_UTILS.log(`Controller: Requesting redo`);
         try {
              const { result, showBackupReminder } = await this.model.redo(); // Get result from redo
              if (result && this.view) {
                   this.view.renderWorkspace();
                   // *** ADD Logic to Update Parent Element Visuals on Redo ***
                   if (result.parentNodeId && result.success === true) { // Check if redo was successful (e.g., delete)
                        // Redo of delete deletes an element. Sync the parent where it was deleted.
                        OPTIMISM_UTILS.log(`Controller: Syncing parent element ${result.parentNodeId} after redo (deletion).`);
                        this.view.renderer.element.syncElementDisplay(result.parentNodeId);
                   }
                   // Add other checks if redo of other commands needs parent sync
                   this.view.managers.undoRedo.updateButtons();
                   if (showBackupReminder) this.view.managers.modal.showBackupReminder(); // Show reminder on redo too
              }
              return !!result; // Return true if redo happened
         } catch (error) {
              OPTIMISM_UTILS.logError(`Error during redo action:`, error);
              return false;
         }
    }

    // --- Export/Import Proxy ---
    async exportData(includeImages = true) {
        console.error("%%%%% controller.exportData: CALLED %%%%%");
        console.error("%%%%% controller.exportData: this.isInitialized:", this.isInitialized);
        console.error("%%%%% controller.exportData: this.exportImportManager exists:", !!this.exportImportManager);
        if (this.exportImportManager) {
            console.error("%%%%% controller.exportData: manager.model exists:", !!this.exportImportManager.model);
            console.error("%%%%% controller.exportData: manager.view exists:", !!this.exportImportManager.view); // <<< The crucial check
        }

        if (!this.isInitialized || !this.exportImportManager) {
            OPTIMISM_UTILS.logError('Cannot export data: application not initialized or manager missing'); // More specific log
            return;
        }
        // Add the check here too, just before the call
        if (!this.exportImportManager.model || !this.exportImportManager.view) {
            OPTIMISM_UTILS.logError('Cannot export data: manager missing model or view reference JUST BEFORE CALL');
            alert("Export failed due to internal setup error. Please reload.");
            return;
        }

        OPTIMISM_UTILS.log(`Controller: Requesting export ${includeImages ? 'with' : 'without'} images`);
        await this.exportImportManager.exportData(includeImages);
        // Reset backup reminder is handled within export manager now
    }
    async importData(file) {
         if (!this.isInitialized || !this.exportImportManager || !file) return;
         OPTIMISM_UTILS.log(`Controller: Requesting import`);
         const success = await this.exportImportManager.importData(file);
         if (success && this.view) {
              this.view.renderWorkspace(); // Re-render after successful import
              this.view.managers.undoRedo.updateButtons(); // Reset undo/redo
         } else if (!success) {
              alert('Failed to import data. The file may be invalid or corrupted.');
         }
    }

    async sendSelectedToTodoist() {
         if (!this.isInitialized || !this.model.selectedElement || !this.model.todoistConnected) return;

         const elementId = this.model.selectedElement;
         const element = this.model.findElementGlobally(elementId);

         if (!element || element.type !== 'text') return; // Only send text elements for now
         if (this.model.isElementSentToTodoist(elementId)) {
              OPTIMISM_UTILS.log(`Element ${elementId} already sent to Todoist.`);
              // Optionally show status message
              return;
         }

         OPTIMISM_UTILS.log(`Controller: Sending element ${elementId} to Todoist.`);
         const success = await this.view.managers.todoist.createTask(element.text);
         if (success) {
            OPTIMISM_UTILS.log(`Controller: Task creation successful for ${elementId}. Marking and syncing.`);
            await this.model.markElementAsSentToTodoist(elementId);
            this.view.renderer.element.syncElementDisplay(elementId); // Update visuals
            // TodoistManager.createTask now handles refreshing the panel if it's open
         } // Error handling done in manager/API call
    }
} // End CanvasController Class
