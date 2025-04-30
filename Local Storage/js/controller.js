import { OPTIMISM_UTILS } from './utils.js';
import { ExportImportManager } from './managers/export-import-manager.js';
import {
    AddElementCommand,
    UpdateElementCommand,
    DeleteElementCommand,
    MoveElementCommand,
    MoveElementToBreadcrumbCommand,
    MoveToInboxCommand
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
            this.exportImportManager = new ExportImportManager(this.model, null); // View might be needed later

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
        this.view = view;
        // Now that view is assigned, pass it to managers that need it
        if (this.exportImportManager) {
            this.exportImportManager.view = this.view;
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
                    hasHeader: false, isHighlighted: false, hasBorder: false,
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
        OPTIMISM_UTILS.log(`Controller: Adding image from URL: ${url}`);
        try {
            // Clean Are.na URLs
            if (url.includes('d2w9rnfcy7mm78.cloudfront.net')) {
                url = url.split('?')[0];
            }
            // Use proxy
            const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(url)}&default=default`;
            OPTIMISM_UTILS.log(`Using image proxy: ${proxyUrl}`);

            // Fetch as blob via proxy
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error(`Failed to fetch image via proxy: ${response.statusText}`);
            const blob = await response.blob();
            if (!blob.type.startsWith('image/')) throw new Error('Fetched content is not an image');

            const file = new File([blob], `image.${blob.type.split('/')[1] || 'png'}`, { type: blob.type });

            // Use the existing addImage method
            return await this.addImage(file, x, y);
        } catch (error) {
            OPTIMISM_UTILS.logError('Error adding image from URL:', error);
            throw error; // Re-throw
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
         if (!element) return;
         const currentStyle = element.style || {};
         const newStyle = { ...currentStyle, ...styleProperties };
         await this.updateElement(id, { style: newStyle });

         // Also update the style panel UI if it's visible
         if (this.view && this.view.panelManager.isPanelVisible('style')) {
              const updatedElement = this.model.findElement(id); // Get data again AFTER update
              if(updatedElement) this.view.renderer.panel.updateStylePanelOptions(updatedElement);
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
                 this.view.renderer.element.syncElementDisplay(id);
                 if (properties.text !== undefined && updatedElement.type === 'text') {
                      await this.model.updateNavigationTitles(id, properties.text);
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

             if (result && this.view) {
                 this.model.selectedElement = null; // Clear selection in model
                 this.view.panelManager.hidePanel('style'); // Hide style panel
                 this.view.renderWorkspace(); // Re-render the workspace
                 // this.view.setScrollPosition(scroll); // Restore scroll
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

        this.view.showLoading('Navigating...');
        try {
             const success = await this.model.navigateToElementDirectly(elementId);
             if (success) {
                 this.view.renderWorkspace();
                 OPTIMISM_UTILS.log('Controller: Bookmark navigation successful.');
                 return true;
             }
             OPTIMISM_UTILS.logError('Controller: Bookmark navigation failed.');
             alert('Failed to navigate to the bookmark.');
             return false;
        } catch (error) {
             OPTIMISM_UTILS.logError('Error navigating to bookmark:', error);
             alert('An error occurred while navigating to the bookmark.');
             return false;
        } finally {
             this.view.hideLoading();
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

    async togglePanel(panelName) {
         if (!this.isInitialized || !panelName) return false;
         OPTIMISM_UTILS.log(`Controller: Toggling panel ${panelName}`);
         try {
              const isVisible = await this.model.togglePanel(panelName);
              if (this.view) {
                   this.view.panelManager.updatePanelVisibility(panelName, isVisible);
              }
              return isVisible;
         } catch (error) {
              OPTIMISM_UTILS.logError(`Error toggling panel ${panelName}:`, error);
              return false;
         }
    }
    // Specific panel toggles calling the generic one
    async toggleSettingsVisibility() { return this.togglePanel('settings'); }
    async toggleInboxVisibility() { return this.togglePanel('inbox'); }
    async toggleGridVisibility() { return this.togglePanel('grid'); }
    async togglePrioritiesVisibility() { return this.togglePanel('priorities'); }
    async toggleArenaView() { return this.togglePanel('arena'); }

    async toggleTheme() {
         if (!this.isInitialized) return false;
         OPTIMISM_UTILS.log(`Controller: Toggling theme`);
         try {
              const isDark = await this.model.toggleTheme();
              if (this.view) this.view.managers.theme.updateTheme(isDark);
              return isDark;
         } catch (error) {
              OPTIMISM_UTILS.logError(`Error toggling theme:`, error);
              return this.model.isDarkTheme; // Return current state on error
         }
    }

    async toggleDebugPanel() {
        if (!this.isInitialized) return false;
        OPTIMISM_UTILS.log(`Controller: Toggling debug panel`);
        const isVisible = this.model.toggleDebugPanel();
        if (this.view) this.view.managers.debug.updateVisibility(isVisible);
        return isVisible;
    }

    async toggleNestingDisabled() {
        if (!this.isInitialized) return false;
        OPTIMISM_UTILS.log(`Controller: Toggling nesting disabled`);
        const isDisabled = await this.model.toggleNestingDisabled();
        if (this.view) this.view.managers.settings.updateNestingButton(isDisabled);
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

    // --- Undo/Redo Proxy ---
    async undo() {
        if (!this.isInitialized) return false;
        OPTIMISM_UTILS.log(`Controller: Requesting undo`);
        try {
             const success = await this.model.undo();
             if (success && this.view) {
                  this.view.renderWorkspace(); // Full re-render after undo
                  this.view.managers.undoRedo.updateButtons();
             }
             return success;
        } catch (error) {
             OPTIMISM_UTILS.logError(`Error during undo action:`, error);
             return false;
        }
    }
    async redo() {
         if (!this.isInitialized) return false;
         OPTIMISM_UTILS.log(`Controller: Requesting redo`);
         try {
              const success = await this.model.redo();
              if (success && this.view) {
                   // Re-render might not be strictly necessary if execute updated state correctly
                   // but full render ensures consistency after command re-execution.
                   this.view.renderWorkspace();
                   this.view.managers.undoRedo.updateButtons();
              }
              return success;
         } catch (error) {
              OPTIMISM_UTILS.logError(`Error during redo action:`, error);
              return false;
         }
    }

    // --- Export/Import Proxy ---
    async exportData(includeImages = true) {
        if (!this.isInitialized || !this.exportImportManager) return;
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

} // End CanvasController Class