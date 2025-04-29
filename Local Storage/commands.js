// commands.js

// Command base class
export class Command { // Export base class
    constructor(model) {
        this.model = model;
    }

    async execute() {
        throw new Error('Execute method must be implemented by subclasses');
    }

    async undo() {
        throw new Error('Undo method must be implemented by subclasses');
    }
}

// Command classes for undo/redo
export class AddElementCommand extends Command { // Export
    constructor(model, element) {
        super(model);
        this.element = element;
        this.nodeId = model.currentNode.id; // Store the current node ID
        this.isImage = element.type === 'image';
        this.imageData = null; // Will store image data if needed
    }

    async execute() {
        // If this is an image, save the image data first
        if (this.isImage && this.imageData) {
            OPTIMISM.log('Saving image data for new element');
            await this.model.saveImageData(this.element.imageDataId, this.imageData);
        }

        await this.model.addElement(this.element);
        return this.element.id;
    }

    async undo() {
        // Remove the element that was added
        // Note: This relies on model.deleteElement handling nested data and image queueing correctly
        await this.model.deleteElement(this.element.id);
    }

    // Set image data for later saving
    setImageData(imageData) {
        this.imageData = imageData;
    }
}

export class MoveToInboxCommand extends Command { // Export
    constructor(model, elementId) {
        super(model);
        this.elementId = elementId;
        const element = model.findElement(elementId);
        if (element) {
            this.element = {...element}; // Store a copy of the original element
            // --- Store original nested data ---
            const currentChildren = model.currentNode.children; // Get ref first
            const childNode = currentChildren ? currentChildren[elementId] : null; // Check existence
            this.originalChildNodeData = childNode ? JSON.parse(JSON.stringify(childNode)) : null; // Deep copy for undo
            OPTIMISM.log(`MoveToInboxCommand Constructor: Found childNode for ${elementId}:`, childNode ? '{...}' : 'null'); // Log presence/absence
            OPTIMISM.log(`MoveToInboxCommand Constructor: Stored originalChildNodeData for ${elementId}:`, this.originalChildNodeData ? '{...}' : 'null'); // Log presence/absence
        } else {
            OPTIMISM.log(`Element ${elementId} not found for MoveToInboxCommand`);
            this.element = null;
            this.originalChildNodeData = null;
        }
        this.nodeId = model.currentNode.id; // Node where the element originated
        this.inboxCard = null; // Will store the created inbox card info
    }

    async execute() {
        if (!this.element) return false;
        OPTIMISM.log(`MoveToInboxCommand Execute: Attempting to move ${this.elementId} with originalChildNodeData:`, this.originalChildNodeData ? '{...}' : 'null');

        // Add to inbox, passing the nested data
        this.inboxCard = await this.model.addToInbox(this.element, this.originalChildNodeData); // Pass nested data
        if (!this.inboxCard) {
            OPTIMISM.logError(`Failed to add element ${this.elementId} to inbox`);
            return false;
        }

        // Now delete the original element from the canvas
        // Note: model.deleteElement should handle nested data and image queueing
        OPTIMISM.log(`MoveToInboxCommand Execute: Calling deleteElement for original ${this.elementId}`);
        const deleteSuccess = await this.model.deleteElement(this.elementId);
        if (!deleteSuccess) {
             OPTIMISM.logError(`Failed to delete original element ${this.elementId} after moving to inbox.`);
             // Attempt to rollback by removing from inbox
             await this.model.removeFromInbox(this.inboxCard.id); // Use await here
             this.inboxCard = null;
             return false;
        }

        OPTIMISM.log(`Moved element ${this.elementId}${this.originalChildNodeData ? ' (with nested data)' : ''} to inbox`);
        return true;
    }

    async undo() {
        if (!this.element || !this.inboxCard) return;

        // Find the inbox card to get its nested data (if any)
        const cardFromInbox = this.model.inboxCards.find(c => c.id === this.inboxCard.id);
        OPTIMISM.log(`MoveToInboxCommand Undo: Found inbox card ${this.inboxCard.id} for undo. Has nestedData:`, cardFromInbox?.nestedData ? '{...}' : 'null');

        // Remove from inbox
        const removed = await this.model.removeFromInbox(this.inboxCard.id);
        if (!removed) {
             OPTIMISM.logError(`Failed to remove card ${this.inboxCard.id} from inbox during undo`);
             // Continue anyway to try restoring to canvas
        }

        // Add the original element back to the original node's elements array
        // This assumes we are currently in the correct node or model handles node context
        if (!this.model.currentNode.elements) {
            this.model.currentNode.elements = [];
        }

        if (this.model.currentNode.id === this.nodeId) {
             this.model.currentNode.elements.push(this.element); // Restore original element

             // --- Restore original nested data ---
             if (this.originalChildNodeData) {
                 if (!this.model.currentNode.children) this.model.currentNode.children = {}; // Ensure children object exists
                 this.model.currentNode.children[this.element.id] = JSON.parse(JSON.stringify(this.originalChildNodeData)); // Restore deep copy
                 OPTIMISM.log(`Restored nested data for element ${this.elementId} during move to inbox undo`);
             }
             // --- END Restore ---

             // Restore associated images (handled by DeleteElementCommand undo logic implicitly)
             // We need to ensure the image data wasn't permanently deleted yet.
             // The DeleteElementCommand's undo should handle restoring image data and removing from deletion queue.

             await this.model.saveData(); // Save the change
             OPTIMISM.log(`Restored element ${this.elementId} to node ${this.nodeId} during move to inbox undo`);
        } else {
             OPTIMISM.logError(`Cannot restore element ${this.elementId} - current node is ${this.model.currentNode.id}, expected ${this.nodeId}`);
             // Potentially find the original node and add it back - more complex
        }
    }
}

export class DeleteElementCommand extends Command { // Export
    constructor(model, elementId) {
       super(model);
        this.elementId = elementId;
        const element = model.findElement(elementId);
        if (element) {
            this.element = {...element}; // Store a copy of the element
            this.nodeId = model.currentNode.id;
            // --- Store original nested data ---
            const childNode = model.currentNode.children ? model.currentNode.children[elementId] : null;
            this.originalChildNodeData = childNode ? JSON.parse(JSON.stringify(childNode)) : null; // Deep copy for undo

            // --- Store original image data (top-level and nested) ---
            this.allOriginalImageData = new Map(); // Map<imageDataId, base64Data>

        } else {
            OPTIMISM.log(`Element ${elementId} not found for DeleteElementCommand`);
            this.element = null;
            this.nodeId = model.currentNode.id;
            this.originalChildNodeData = null;
            this.allOriginalImageData = new Map();
        }
    }

    async execute() {
        if (!this.element) return false;

        // --- Backup image data before deletion ---
        let idsToBackup = [];
        if (this.element.type === 'image' && this.element.imageDataId) {
            idsToBackup.push(this.element.imageDataId);
        }
        if (this.originalChildNodeData) {
            idsToBackup = idsToBackup.concat(this.model.findAllImageIdsRecursive(this.originalChildNodeData));
        }
        idsToBackup = [...new Set(idsToBackup)]; // Remove duplicates

        OPTIMISM.log(`Backing up image data for ${idsToBackup.length} images before deletion.`);
        const backupPromises = idsToBackup.map(async (id) => {
            try {
                const data = await this.model.getImageData(id);
                if (data) {
                    this.allOriginalImageData.set(id, data);
                } else {
                     OPTIMISM.log(`No image data found for ${id} during backup.`);
                }
            } catch (error) {
                OPTIMISM.logError(`Failed to backup image data for ${id}:`, error);
            }
        });
        await Promise.all(backupPromises);
        // --- END Backup ---

        // Model's deleteElement now handles queuing images and removing nested node data
        return await this.model.deleteElement(this.elementId);
    }

    async undo() {
       if (!this.element) return;

         // Restore the element to the correct node (assuming current node is correct for simplicity)
        if (!this.model.currentNode.elements) {
            this.model.currentNode.elements = [];
        }
        // Ensure element doesn't already exist (e.g., rapid undo/redo)
        if (!this.model.findElement(this.element.id)) {
            this.model.currentNode.elements.push(this.element);
        } else {
            OPTIMISM.log(`Undo: Element ${this.element.id} already exists, skipping push.`);
        }


        // --- Restore nested data ---
        if (this.originalChildNodeData) {
            if (!this.model.currentNode.children) this.model.currentNode.children = {};
            // Ensure child node doesn't already exist
            if (!this.model.currentNode.children[this.element.id]) {
                this.model.currentNode.children[this.element.id] = JSON.parse(JSON.stringify(this.originalChildNodeData)); // Restore deep copy
                OPTIMISM.log(`Restored nested data for element ${this.element.id} during delete undo`);
            } else {
                 OPTIMISM.log(`Undo: Nested data for ${this.element.id} already exists, skipping restore.`);
            }
        }

        // --- Restore image data ---
        if (this.allOriginalImageData.size > 0) {
            OPTIMISM.log(`Restoring ${this.allOriginalImageData.size} images during delete undo.`);
            const restorePromises = [];
            this.allOriginalImageData.forEach((data, id) => {
                // Check if image data already exists before saving again
                restorePromises.push(
                    this.model.getImageData(id).then(existingData => {
                        if (!existingData) {
                            return this.model.saveImageData(id, data);
                        } else {
                            OPTIMISM.log(`Undo: Image data for ${id} already exists, skipping restore.`);
                        }
                    }).catch(err => {
                        OPTIMISM.logError(`Failed to check/restore image ${id} during undo:`, err);
                    })
                );
            });
            await Promise.all(restorePromises);
        }
        // --- END Restore Images ---

        // --- Remove images from deletion queue if they were just restored ---
        const restoredImageIds = Array.from(this.allOriginalImageData.keys());
        if (restoredImageIds.length > 0) {
             const initialQueueLength = this.model.deletedImageQueue.length;
             this.model.deletedImageQueue = this.model.deletedImageQueue.filter(item => !restoredImageIds.includes(item.imageId));
             const removedCount = initialQueueLength - this.model.deletedImageQueue.length;
             if (removedCount > 0) {
                 OPTIMISM.log(`Removed ${removedCount} restored image(s) from the deletion queue.`);
                 await this.model.saveAppState(); // Save the updated queue
             }
        }
        // --- END Queue Update ---


        await this.model.saveData(); // Save the restored element and nested data
    }
}

export class UpdateElementCommand extends Command { // Export
    constructor(model, elementId, newProperties, explicitOldProperties = null) {
        super(model);
        this.elementId = elementId;
        this.newProperties = newProperties;
        this.wasDeleted = false; // Flag if element was deleted due to empty text

        // Use explicitly provided old properties if available, otherwise fetch them
        const element = model.findElement(elementId);
        if (!element) {
            OPTIMISM.log(`Element ${elementId} not found for UpdateElementCommand`);
            this.oldProperties = null;
            this.isText = false;
            this.fullElement = null; // Needed for undo if deleted
            return; // Cannot proceed if element doesn't exist
        }

        this.isText = element.type === 'text';

        if (explicitOldProperties) {
            this.oldProperties = explicitOldProperties;
        } else {
            this.oldProperties = {};
            for (const key in newProperties) {
                if (Object.hasOwnProperty.call(element, key)) {
                    this.oldProperties[key] = element[key];
                }
            }
        }

        this.nodeId = model.currentNode.id;

        // Check if this update might lead to deletion (text elements only)
        this.mightDelete = this.isText &&
            newProperties.text !== undefined &&
            (newProperties.text === '' || newProperties.text === null || newProperties.text.trim() === '');

        // Store the full element state *before* the update for potential restoration if deleted
        if (this.mightDelete) {
            this.fullElement = JSON.parse(JSON.stringify(element));
        } else {
            this.fullElement = null; // Not needed if not deleting
        }
    }

    async execute() {
        if (!this.oldProperties && !this.mightDelete) return false; // Cannot execute if element wasn't found initially

        // Check if this is a text update that makes text empty
        if (this.mightDelete) {
            OPTIMISM.log('Text is empty, element will be deleted');
            this.wasDeleted = true;
            // Use DeleteElementCommand internally to handle nested data/images correctly
            const deleteCmd = new DeleteElementCommand(this.model, this.elementId);
            // We need the image backup data from the delete command for our own undo
            await deleteCmd.execute(); // This backs up images in deleteCmd.allOriginalImageData
            this.deleteCommandForUndo = deleteCmd; // Store the command for its undo logic
            return true;
        }

        // Normal update
        this.wasDeleted = false;
        await this.model.updateElement(this.elementId, this.newProperties);
        return true;
    }

    async undo() {
       if (this.wasDeleted) {
            // If the element was deleted, use the stored DeleteElementCommand's undo logic
            if (this.deleteCommandForUndo) {
                OPTIMISM.log(`Undo Update: Restoring deleted element ${this.elementId} using internal delete command undo.`);
                await this.deleteCommandForUndo.undo();
            } else {
                 OPTIMISM.logError(`Undo Update: Element ${this.elementId} was deleted, but no internal delete command found for undo.`);
                 // Fallback: Try restoring the basic element if we have it (less robust)
                 if (this.fullElement) {
                     if (!this.model.currentNode.elements) this.model.currentNode.elements = [];
                     this.model.currentNode.elements.push(this.fullElement);
                     await this.model.saveData();
                 }
            }
        } else if (this.oldProperties) {
            // If it was just an update, revert to old properties
            await this.model.updateElement(this.elementId, this.oldProperties);
        }
    }
}

export class MoveElementCommand extends Command { // Export
    constructor(model, sourceId, targetId) {
       super(model);
        this.sourceId = sourceId;
        this.targetId = targetId; // ID of the element to move *into*

        const sourceElement = model.findElement(sourceId);
        if (sourceElement) {
            this.originalElement = { ...sourceElement }; // Store copy of original element
             // --- Store original nested data ---
            const childNode = model.currentNode.children ? model.currentNode.children[sourceId] : null;
            this.originalChildNodeData = childNode ? JSON.parse(JSON.stringify(childNode)) : null; // Deep copy for undo
        } else {
            OPTIMISM.log(`Source element ${sourceId} not found for MoveElementCommand`);
            this.originalElement = null;
            this.originalChildNodeData = null;
        }

        this.nodeId = model.currentNode.id; // Original parent node ID
        // Store info about the newly created element/node for proper undo
        this.newElementId = null; // ID of the element created inside the target
        this.deleteCommandForUndo = null; // To handle deletion of the original
        this.addCommandForUndo = null; // To handle addition of the new element
    }

    async execute() {
       if (!this.originalElement) return { success: false }; // Return failure status

        // 1. Perform the deep copy/move using the model method
        // This method internally handles creating new IDs, copying nested data,
        // duplicating images, and deleting the original.
        const moveResult = await this.model.moveElement(this.sourceId, this.targetId);

        if (moveResult && moveResult.success && moveResult.newElementId) {
            // --- Store the NEW element ID for UNDO ---
            this.newElementId = moveResult.newElementId;

            // Simulate the delete command that happened internally for undo purposes
            // This ensures image backups/restores/queueing are handled correctly by DeleteElementCommand's logic
            this.deleteCommandForUndo = new DeleteElementCommand(this.model, this.sourceId);
            // Backup images for the original element *before* it was deleted by model.moveElement
            await this.deleteCommandForUndo.execute(); // Execute just to trigger the image backup within the command

            OPTIMISM.log(`MoveElementCommand execute successful for source ${this.sourceId}`);
            return { success: true }; // Return success status for controller
        } else {
            OPTIMISM.logError(`MoveElementCommand execute failed for source ${this.sourceId}`);
            return { success: false }; // Return failure status
        }
    }

    async undo() {
        if (!this.originalElement) return;

        // Undo Logic:
        // 1. Delete the newly created element (using this.newElementId).
        // 2. Restore the original element (using this.deleteCommandForUndo.undo()).

        // --- Step 1: Delete the NEW element ---
        if (!this.newElementId) {
            OPTIMISM.logError(`MoveElementCommand undo failed: Missing new element ID.`);
            return; // Cannot proceed
        }
        OPTIMISM.log(`Undo Move: Deleting newly created element ${this.newElementId}`);
        // Use DeleteElementCommand to handle deletion complexity (nested data, images)
        const deleteNewCmd = new DeleteElementCommand(this.model, this.newElementId);
        // Execute the deletion command (this also backs up images for the *new* element, which is fine)
        await deleteNewCmd.execute();
        // We don't need deleteNewCmd.undo()

        // --- Step 2: Restore the ORIGINAL element ---
        OPTIMISM.log(`Undo Move: Restoring original element ${this.sourceId}`);
        if (this.deleteCommandForUndo) {
            // Use the stored delete command's undo logic which restores element, nested data, and images
            await this.deleteCommandForUndo.undo();
        } else {
            OPTIMISM.logError(`Undo Move: Cannot restore original element ${this.sourceId} - missing internal delete command.`);
            // Potentially add manual fallback here if needed, but it's less ideal
        }

        OPTIMISM.log(`MoveElementCommand undo completed for original ${this.sourceId}.`);
        // The controller calling renderWorkspace after undo will handle the UI update.
    }
}


export class MoveElementToBreadcrumbCommand extends Command { // Export
     constructor(model, elementId, navIndex) {
        super(model);
        this.elementId = elementId; // Original ID
        this.navIndex = navIndex; // Target breadcrumb index

        const sourceElement = model.findElement(elementId);
        if (sourceElement) {
            this.originalElement = { ...sourceElement };
            const childNode = model.currentNode.children ? model.currentNode.children[elementId] : null;
            this.originalChildNodeData = childNode ? JSON.parse(JSON.stringify(childNode)) : null;
        } else {
            this.originalElement = null;
            this.originalChildNodeData = null;
        }

        this.currentNodeId = model.currentNode.id; // Original parent node ID
        this.targetNodeId = model.navigationStack[navIndex].node.id; // Target parent node ID
        // Need info about the newly created element/node for proper undo
        this.newElementId = null; // ID of the element created in the target node
        this.deleteCommandForUndo = null; // To handle deletion of the original
    }

    async execute() {
        if (!this.originalElement) return false;

        // Model method handles deep copy, new IDs, image duplication, original deletion
        // It should return the ID of the newly created element.
        const result = await this.model.moveElementToBreadcrumb(this.elementId, this.navIndex);

        if (result && result.newElementId) {
             this.newElementId = result.newElementId;
             // Store internal commands or create undo helpers
             this.deleteCommandForUndo = new DeleteElementCommand(this.model, this.elementId); // Simulates deletion
             OPTIMISM.log(`MoveElementToBreadcrumb execute successful for source ${this.elementId}. New element ID: ${this.newElementId}`);
             return true;
        } else {
            OPTIMISM.logError(`MoveElementToBreadcrumb execute failed for source ${this.elementId}. Model did not return new ID.`);
            return false;
        }
    }

    async undo() {
        // Similar to MoveElementCommand undo:
        // 1. Delete the newly created element (this.newElementId) from the target breadcrumb node (this.targetNodeId).
        // 2. Restore the original element (this.originalElement) to the original node (this.currentNodeId).

        if (!this.originalElement || !this.newElementId) {
             OPTIMISM.logError(`MoveElementToBreadcrumb undo failed: Missing original element or new element ID.`);
             return;
        }
         OPTIMISM.log(`Attempting undo for MoveElementToBreadcrumb (source: ${this.sourceId}, new: ${this.newElementId})`);

        // --- Step 1: Delete the new element from the target node ---
        OPTIMISM.log(`Undo Breadcrumb Move: Deleting newly created element ${this.newElementId} from target node ${this.targetNodeId}`);
        // We might need to navigate to the target node first if deleteElement requires it
        const currentNavId = this.model.currentNode.id;
        let navigatedAway = false;
        if (currentNavId !== this.targetNodeId) {
            OPTIMISM.log(`Undo Breadcrumb Move: Navigating to target node ${this.targetNodeId} to delete new element.`);
            await this.model.navigateToNode(this.targetNodeId); // Potential side effects?
            navigatedAway = true;
        }

        const deleteNewCmd = new DeleteElementCommand(this.model, this.newElementId);
        await deleteNewCmd.execute(); // Execute deletion in the target node

        // Navigate back if we moved
        if (navigatedAway) {
             OPTIMISM.log(`Undo Breadcrumb Move: Navigating back to original node ${this.currentNodeId}.`);
             await this.model.navigateToNode(this.currentNodeId);
        }

        // --- Step 2: Restore the original element ---
        OPTIMISM.log(`Undo Breadcrumb Move: Restoring original element ${this.elementId} to node ${this.currentNodeId}`);
        if (this.deleteCommandForUndo) {
             // Use the stored delete command's undo logic
             await this.deleteCommandForUndo.undo();
        } else {
             // Manual restoration (less robust)
             OPTIMISM.logWarn(`Undo Breadcrumb Move: No internal delete command found. Attempting manual restore.`);
             if (!this.model.currentNode.elements) this.model.currentNode.elements = [];
             this.model.currentNode.elements.push(this.originalElement);
             if (this.originalChildNodeData) {
                 if (!this.model.currentNode.children) this.model.currentNode.children = {};
                 this.model.currentNode.children[this.originalElement.id] = JSON.parse(JSON.stringify(this.originalChildNodeData));
             }
             await this.model.saveData();
        }

        OPTIMISM.log(`MoveElementToBreadcrumb undo completed for original ${this.elementId}.`);
    }
}
