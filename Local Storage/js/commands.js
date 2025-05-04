import { OPTIMISM_UTILS } from './utils.js';

// --- Base Command Class ---
class Command {
    constructor(model) {
        if (!model) {
            throw new Error("Command requires a model instance.");
        }
        this.model = model;
    }

    async execute() {
        throw new Error('Execute method must be implemented by subclasses');
    }

    async undo() {
        throw new Error('Undo method must be implemented by subclasses');
    }
}

// --- Specific Command Classes ---

export class AddElementCommand extends Command {
    constructor(model, element) {
        super(model);
        if (!element || !element.id) {
             throw new Error("AddElementCommand requires an element object with an ID.");
        }
        this.element = structuredClone(element); // Store a clone
        this.nodeId = model.currentNode?.id; // Store the parent node ID at time of creation
        if (!this.nodeId) {
             throw new Error("AddElementCommand could not determine the current node ID.");
        }
        this.isImage = element.type === 'image';
        this.imageData = null; // For potential image data saving
    }

    // Call this before execute if it's an image
    setImageData(imageData) {
        if (this.isImage) {
            this.imageData = imageData;
        }
    }

    async execute() {
        OPTIMISM_UTILS.log(`Executing AddElementCommand for ${this.element.id} in node ${this.nodeId}`);
        if (this.isImage && this.imageData) {
            try {
                 await this.model.saveImageData(this.element.imageDataId, this.imageData);
            } catch (error) {
                 OPTIMISM_UTILS.logError(`Failed to save image data for ${this.element.imageDataId}`, error);
                 throw error; // Propagate error
            }
        }
        // Add element to the specific node it was created in
        const targetNode = this.model.findNodeById(this.nodeId);
        if (!targetNode) {
             throw new Error(`Target node ${this.nodeId} not found for adding element ${this.element.id}`);
        }
        if (!targetNode.elements) {
            targetNode.elements = [];
        }
        targetNode.elements.push(this.element);
        await this.model.saveData(); // Save the modified node data
        return this.element.id; // Return the ID of the added element
    }

    async undo() {
        OPTIMISM_UTILS.log(`Undoing AddElementCommand for ${this.element.id}`);
         // Model's deleteElement handles nested data and image queuing
        const success = await this.model.deleteElement(this.element.id, this.nodeId); // Pass nodeId for context
        if (!success) {
            OPTIMISM_UTILS.logError(`Undo failed: Could not delete element ${this.element.id} from node ${this.nodeId}`);
        }
         // Image data deletion is handled by the model's queue, no need to explicitly delete here
    }
}

export class DeleteElementCommand extends Command {
    constructor(model, elementId) {
        super(model);
        this.elementId = elementId;
        this.nodeId = model.currentNode?.id; // Node where the element existed
        if (!this.nodeId) {
             throw new Error("DeleteElementCommand could not determine the current node ID.");
        }

        // Find element within the specific node for accurate backup
        const parentNode = model.findNodeById(this.nodeId);
        const element = parentNode?.elements?.find(el => el.id === elementId);

        if (element) {
            this.element = structuredClone(element); // Store a copy
            const childNode = parentNode.children ? parentNode.children[elementId] : null;
            this.originalChildNodeData = childNode ? structuredClone(childNode) : null; // Deep copy
            this.allOriginalImageData = new Map(); // Map<imageDataId, base64Data>
        } else {
            OPTIMISM_UTILS.logError(`Element ${elementId} not found in node ${this.nodeId} for DeleteElementCommand`);
            this.element = null;
            this.originalChildNodeData = null;
            this.allOriginalImageData = new Map();
        }
    }

    async execute() {
        OPTIMISM_UTILS.log(`Executing DeleteElementCommand for ${this.elementId}`);
        if (!this.element) return false;

        // Backup image data (top-level and nested) before deletion
        let idsToBackup = [];
        if (this.element.type === 'image' && this.element.imageDataId) {
            idsToBackup.push(this.element.imageDataId);
        }
        if (this.originalChildNodeData) {
            idsToBackup = idsToBackup.concat(this.model.findAllImageIdsRecursive(this.originalChildNodeData));
        }
        idsToBackup = [...new Set(idsToBackup)];

        if (idsToBackup.length > 0) {
            OPTIMISM_UTILS.log(`Backing up image data for ${idsToBackup.length} images before deletion.`);
            const backupPromises = idsToBackup.map(async (id) => {
                try {
                    const data = await this.model.getImageData(id);
                    if (data) this.allOriginalImageData.set(id, data);
                } catch (error) { OPTIMISM_UTILS.logError(`Failed to backup image data for ${id}:`, error); }
            });
            await Promise.all(backupPromises);
        }

        // Model's deleteElement handles queuing images and removing nested node data
        return await this.model.deleteElement(this.elementId, this.nodeId); // Pass context
    }

    async undo() {
        OPTIMISM_UTILS.log(`Undoing DeleteElementCommand for ${this.elementId}`);
        if (!this.element) return;

        // Find the original parent node again
        const parentNode = this.model.findNodeById(this.nodeId);
        if (!parentNode) {
             OPTIMISM_UTILS.logError(`Undo failed: Original parent node ${this.nodeId} not found for element ${this.elementId}`);
             return;
        }

        // Restore element
        if (!parentNode.elements) parentNode.elements = [];
        // Prevent duplicate addition if element somehow already exists
        if (!parentNode.elements.some(el => el.id === this.element.id)) {
             parentNode.elements.push(this.element);
        } else {
             OPTIMISM_UTILS.log(`Undo Warning: Element ${this.element.id} already exists in node ${this.nodeId}`);
        }


        // Restore nested data
        if (this.originalChildNodeData) {
            if (!parentNode.children) parentNode.children = {};
            parentNode.children[this.element.id] = structuredClone(this.originalChildNodeData);
            OPTIMISM_UTILS.log(`Restored nested data for element ${this.element.id} during delete undo`);
        }

        // Restore image data
        if (this.allOriginalImageData.size > 0) {
            OPTIMISM_UTILS.log(`Restoring ${this.allOriginalImageData.size} images during delete undo.`);
            const restorePromises = [];
            this.allOriginalImageData.forEach((data, id) => {
                restorePromises.push(this.model.saveImageData(id, data).catch(err => {
                    OPTIMISM_UTILS.logError(`Failed to restore image ${id} during undo:`, err);
                }));
            });
            await Promise.all(restorePromises);
        }

        // Remove images from deletion queue
        const restoredImageIds = Array.from(this.allOriginalImageData.keys());
        if (restoredImageIds.length > 0) {
             this.model.dequeueImagesForDeletion(restoredImageIds); // Use model method
        }

        await this.model.saveData(); // Save the restored node data
        await this.model.saveAppState(); // Save updated deletion queue
    }
}

export class UpdateElementCommand extends Command {
    constructor(model, elementId, newProperties, explicitOldProperties = null) {
        super(model);
        this.elementId = elementId;
        this.newProperties = structuredClone(newProperties);
        this.nodeId = model.currentNode?.id;
        if (!this.nodeId) {
             throw new Error("UpdateElementCommand could not determine the current node ID.");
        }

        const parentNode = model.findNodeById(this.nodeId);
        const element = parentNode?.elements?.find(el => el.id === elementId);

        if (!element) {
            OPTIMISM_UTILS.logError(`Element ${elementId} not found in node ${this.nodeId} for UpdateElementCommand`);
            this.oldProperties = null;
            this.isText = false;
            this.fullElement = null; // Needed if mightDelete logic applies
        } else {
             this.isText = element.type === 'text';
             if (explicitOldProperties) {
                 this.oldProperties = structuredClone(explicitOldProperties);
             } else {
                 this.oldProperties = {};
                 for (const key in newProperties) {
                     if (Object.hasOwnProperty.call(element, key)) {
                          // Deep clone potentially nested properties like 'style'
                          this.oldProperties[key] = structuredClone(element[key]);
                     }
                 }
             }
             // Special handling for empty text deletion
             this.mightDelete = this.isText &&
                newProperties.text !== undefined &&
                (newProperties.text === '' || newProperties.text === null || String(newProperties.text).trim() === '');

             if (this.mightDelete) {
                 this.fullElement = structuredClone(element); // Backup full element for undo
             }
        }
        this.wasDeleted = false; // Flag if deletion occurred during execute
    }

    async execute() {
        OPTIMISM_UTILS.log(`Executing UpdateElementCommand for ${this.elementId}`);
        if (!this.oldProperties && !this.mightDelete) return false; // Cannot execute if element wasn't found initially

        // If element should be deleted due to empty text
        if (this.mightDelete) {
            OPTIMISM_UTILS.log(`Update command triggering deletion for ${this.elementId}`);
            // Ensure we actually have the element backup if mightDelete was true
            if (!this.fullElement) { // This shouldn't happen if constructor logic is right, but safe check
                 OPTIMISM_UTILS.logError(`Update&gt;Delete Error: Full element backup missing for ${this.elementId}`);
                 return false; // Prevent deletion without backup for undo
            }
            this.wasDeleted = true;
            // Backup images before deletion occurs within deleteElement
            const deleteCmd = new DeleteElementCommand(this.model, this.elementId); // Use the command
            await deleteCmd.execute(); // Use DeleteElementCommand to handle image backup/queuing
            // Store the backed up image data for potential undo
            this.allOriginalImageData = deleteCmd.allOriginalImageData;
            return true;
        }

        // Normal update
        const updatedElement = await this.model.updateElement(this.elementId, this.newProperties, this.nodeId);
        return !!updatedElement;
    }

    async undo() {
        OPTIMISM_UTILS.log(`Undoing UpdateElementCommand for ${this.elementId}`);
        if (this.wasDeleted) {
             // Restore the full element if it was deleted
             const parentNode = this.model.findNodeById(this.nodeId);
             if (parentNode && this.fullElement) {
                 if (!parentNode.elements) parentNode.elements = [];
                  // Prevent duplicate addition if element somehow already exists
                 if (!parentNode.elements.some(el => el.id === this.fullElement.id)) {
                     parentNode.elements.push(this.fullElement); // Restore original
                     // Restore images if they were backed up
                     if (this.allOriginalImageData && this.allOriginalImageData.size > 0) {
                          OPTIMISM_UTILS.log(`Restoring ${this.allOriginalImageData.size} images during update>delete undo.`);
                          const restorePromises = [];
                          this.allOriginalImageData.forEach((data, id) => {
                              restorePromises.push(this.model.saveImageData(id, data).catch(err => {
                                  OPTIMISM_UTILS.logError(`Failed to restore image ${id} during undo:`, err);
                              }));
                          });
                          await Promise.all(restorePromises);
                          // Dequeue restored images
                          this.model.dequeueImagesForDeletion(Array.from(this.allOriginalImageData.keys()));
                          await this.model.saveAppState();
                     }
                     await this.model.saveData();
                 } else {
                      OPTIMISM_UTILS.log(`Undo Warning: Element ${this.fullElement.id} already exists in node ${this.nodeId}`);
                 }
             } else {
                 OPTIMISM_UTILS.logError(`Undo failed: Cannot restore deleted element ${this.elementId}. Parent node or backup missing.`);
             }
        } else if (this.oldProperties) {
            // Revert to old properties
            await this.model.updateElement(this.elementId, this.oldProperties, this.nodeId);
        }
    }
}

export class MoveElementCommand extends Command {
    constructor(model, sourceElementId, targetElementId) {
        super(model);
        this.sourceElementId = sourceElementId; // Original ID
        this.targetElementId = targetElementId; // ID of the element to drop onto
        this.sourceNodeId = model.currentNode?.id; // Node where the move originates
         if (!this.sourceNodeId) {
             throw new Error("MoveElementCommand could not determine the source node ID.");
        }

        // Find source element and its data within the source node
        const sourceNode = model.findNodeById(this.sourceNodeId);
        const sourceElement = sourceNode?.elements?.find(el => el.id === sourceElementId);

        if (sourceElement) {
            this.originalElement = structuredClone(sourceElement);
            const childNode = sourceNode.children ? sourceNode.children[sourceElementId] : null;
            this.originalChildNodeData = childNode ? structuredClone(childNode) : null;
        } else {
            this.originalElement = null;
            this.originalChildNodeData = null;
            OPTIMISM_UTILS.logError(`Source element ${sourceElementId} not found in node ${this.sourceNodeId} for MoveElementCommand.`);
        }
         // We need the ID of the element *created* in the target node for undo
         this.newElementId = null;
    }

    async execute() {
        OPTIMISM_UTILS.log(`Executing MoveElementCommand: ${this.sourceElementId} -> ${this.targetElementId}`);
        if (!this.originalElement) return false;

        // Use the model's moveElement method, which handles deep copy, deletion, etc.
        // *** Assumption: model.moveElement now returns the ID of the newly created element ***
        const result = await this.model.moveElement(this.sourceElementId, this.targetElementId, this.sourceNodeId);

        if (result && result.newElementId) {
             this.newElementId = result.newElementId; // Store the ID of the moved element
             OPTIMISM_UTILS.log(`Move successful. New element ID: ${this.newElementId}`);
            return true;
        } else {
             OPTIMISM_UTILS.logError(`MoveElement command failed for source ${this.sourceElementId}.`);
             this.newElementId = null;
            return false;
        }
    }

    async undo() {
        OPTIMISM_UTILS.log(`Undoing MoveElementCommand for original ${this.sourceElementId}`);
        if (!this.originalElement || !this.newElementId) {
             OPTIMISM_UTILS.logError(`Undo failed: Missing original element or new element ID.`);
             return;
        }

        // 1. Delete the *new* element from the *target* node.
        // Find the target node first (it's a child of the source node)
        const sourceNode = this.model.findNodeById(this.sourceNodeId);
        const targetNode = sourceNode?.children ? sourceNode.children[this.targetElementId] : null;
        if (!targetNode) {
             OPTIMISM_UTILS.logError(`Undo failed: Target node for element ${this.targetElementId} not found in source node ${this.sourceNodeId}.`);
             // Attempt to restore original anyway? Or fail? Let's try restoring.
        } else {
            OPTIMISM_UTILS.log(`Deleting moved element ${this.newElementId} from target node ${targetNode.id}`);
            // Use DeleteElementCommand logic to handle nested data/images of the *moved* element
            const deleteCmd = new DeleteElementCommand(this.model, this.newElementId); // This will use the *targetNode* context internally if model.findElement is smart enough or context is passed
            await deleteCmd.execute(); // This deletes the moved element + backs up/queues its images
        }


        // 2. Restore the *original* element and its *original* child node data to the *source* node.
        if (!sourceNode.elements) sourceNode.elements = [];
         // Prevent duplicate addition
         if (!sourceNode.elements.some(el => el.id === this.originalElement.id)) {
             sourceNode.elements.push(this.originalElement); // Restore original element
         } else {
             OPTIMISM_UTILS.log(`Undo Warning: Original element ${this.originalElement.id} already exists in source node ${this.sourceNodeId}`);
         }


        if (this.originalChildNodeData) {
            if (!sourceNode.children) sourceNode.children = {};
            sourceNode.children[this.originalElement.id] = structuredClone(this.originalChildNodeData);
            OPTIMISM_UTILS.log(`Restored original nested data for element ${this.originalElement.id} during move undo`);
        }

        // 3. Restore original image data (using data backed up by the internal DeleteElementCommand)
        // We need access to the backup made when the *original* was deleted during the 'move'
        // This suggests the `model.moveElement` needs to manage this internally or the command needs refinement.
        // Let's assume the image deletion queue handles this for now. If the original images were queued,
        // this undo might trigger their dequeueing if the timing is right.

        await this.model.saveData(); // Save changes
        OPTIMISM_UTILS.log(`Restored original element ${this.originalElement.id} to node ${this.sourceNodeId} during move undo.`);
    }
}

export class MoveElementToBreadcrumbCommand extends Command {
    constructor(model, elementId, navIndex) {
        super(model);
        this.sourceElementId = elementId;
        this.navIndex = navIndex;
        this.sourceNodeId = model.currentNode?.id;
        this.targetNodeId = model.navigationStack[navIndex]?.node?.id;

        if (!this.sourceNodeId || !this.targetNodeId) {
            throw new Error("MoveElementToBreadcrumbCommand could not determine source or target node ID.");
        }

        // Find source element and its data within the source node
        const sourceNode = model.findNodeById(this.sourceNodeId);
        const sourceElement = sourceNode?.elements?.find(el => el.id === elementId);

        if (sourceElement) {
            this.originalElement = structuredClone(sourceElement);
            const childNode = sourceNode.children ? sourceNode.children[elementId] : null;
            this.originalChildNodeData = childNode ? structuredClone(childNode) : null;
        } else {
            this.originalElement = null;
            this.originalChildNodeData = null;
            OPTIMISM_UTILS.logError(`Source element ${elementId} not found in node ${this.sourceNodeId} for MoveElementToBreadcrumbCommand.`);
        }
         // We need the ID of the element *created* in the target node for undo
        this.newElementId = null;
    }

    async execute() {
         OPTIMISM_UTILS.log(`Executing MoveElementToBreadcrumbCommand: ${this.sourceElementId} -> NavIndex ${this.navIndex} (Node ${this.targetNodeId})`);
        if (!this.originalElement) return false;

        // *** Assumption: model.moveElementToBreadcrumb now returns the ID of the newly created element ***
        const result = await this.model.moveElementToBreadcrumb(this.sourceElementId, this.navIndex, this.sourceNodeId);

        if (result && result.newElementId) {
             this.newElementId = result.newElementId; // Store the ID
             OPTIMISM_UTILS.log(`Breadcrumb move successful. New element ID: ${this.newElementId}`);
            return true;
        } else {
            OPTIMISM_UTILS.logError(`MoveElementToBreadcrumb command failed for source ${this.sourceElementId}.`);
             this.newElementId = null;
            return false;
        }
    }

    async undo() {
        OPTIMISM_UTILS.log(`Undoing MoveElementToBreadcrumbCommand for original ${this.sourceElementId}`);
         if (!this.originalElement || !this.newElementId) {
             OPTIMISM_UTILS.logError(`Undo failed: Missing original element or new element ID.`);
             return;
        }

        // 1. Delete the *new* element from the *target* (breadcrumb) node.
        const targetNode = this.model.findNodeById(this.targetNodeId);
        if (!targetNode) {
             OPTIMISM_UTILS.logError(`Undo failed: Target breadcrumb node ${this.targetNodeId} not found.`);
             // Attempt restore anyway?
        } else {
            OPTIMISM_UTILS.log(`Deleting moved element ${this.newElementId} from target node ${targetNode.id}`);
            // Use DeleteElementCommand logic
            const deleteCmd = new DeleteElementCommand(this.model, this.newElementId); // Assumes model context works correctly here
            await deleteCmd.execute();
        }

        // 2. Restore the *original* element and data to the *source* node.
        const sourceNode = this.model.findNodeById(this.sourceNodeId);
        if (!sourceNode) {
             OPTIMISM_UTILS.logError(`Undo failed: Source node ${this.sourceNodeId} not found.`);
             return;
        }
        if (!sourceNode.elements) sourceNode.elements = [];
         // Prevent duplicate addition
         if (!sourceNode.elements.some(el => el.id === this.originalElement.id)) {
            sourceNode.elements.push(this.originalElement);
         } else {
             OPTIMISM_UTILS.log(`Undo Warning: Original element ${this.originalElement.id} already exists in source node ${this.sourceNodeId}`);
         }

        if (this.originalChildNodeData) {
            if (!sourceNode.children) sourceNode.children = {};
            sourceNode.children[this.originalElement.id] = structuredClone(this.originalChildNodeData);
        }

        // 3. Image data restoration relies on the delete queue mechanism.

        await this.model.saveData();
        OPTIMISM_UTILS.log(`Restored original element ${this.originalElement.id} to node ${this.sourceNodeId} during breadcrumb move undo.`);
    }
}

export class MoveToInboxCommand extends Command {
    constructor(model, elementId) {
        super(model);
        this.elementId = elementId;
        this.nodeId = model.currentNode?.id; // Node where the element originated
        if (!this.nodeId) {
             throw new Error("MoveToInboxCommand could not determine the current node ID.");
        }

        const parentNode = model.findNodeById(this.nodeId);
        const element = parentNode?.elements?.find(el => el.id === elementId);

        if (element) {
            this.element = structuredClone(element); // Store a copy of the original element
            const childNode = parentNode.children ? parentNode.children[elementId] : null;
            this.originalChildNodeData = childNode ? structuredClone(childNode) : null;
            this.allOriginalImageData = new Map(); // Backup images
        } else {
            OPTIMISM_UTILS.logError(`Element ${elementId} not found in node ${this.nodeId} for MoveToInboxCommand`);
            this.element = null;
            this.originalChildNodeData = null;
            this.allOriginalImageData = new Map();
        }
        this.inboxCard = null; // Will store the created inbox card info
    }

    async execute() {
        OPTIMISM_UTILS.log(`Executing MoveToInboxCommand for ${this.elementId}`);
        if (!this.element) return false;

        // Backup images before deletion from canvas
        let idsToBackup = [];
        if (this.element.type === 'image' && this.element.imageDataId) {
            idsToBackup.push(this.element.imageDataId);
        }
        if (this.originalChildNodeData) {
            idsToBackup = idsToBackup.concat(this.model.findAllImageIdsRecursive(this.originalChildNodeData));
        }
        idsToBackup = [...new Set(idsToBackup)];

        if (idsToBackup.length > 0) {
            OPTIMISM_UTILS.log(`Backing up image data for ${idsToBackup.length} images before moving to inbox.`);
            const backupPromises = idsToBackup.map(async (id) => {
                try {
                    const data = await this.model.getImageData(id);
                    if (data) this.allOriginalImageData.set(id, data);
                } catch (error) { OPTIMISM_UTILS.logError(`Failed to backup image data for ${id}:`, error); }
            });
            await Promise.all(backupPromises);
        }

        // Add to inbox (model handles copying data and nested structure)
        this.inboxCard = await this.model.addToInbox(this.element, this.originalChildNodeData);
        if (!this.inboxCard) {
            OPTIMISM_UTILS.logError(`Failed to add element ${this.elementId} to inbox`);
            // Should we restore backed up images here? No, let delete handle cleanup.
            return false;
        }

        // Delete the original element from the canvas (model handles image queueing)
        const deleteSuccess = await this.model.deleteElement(this.elementId, this.nodeId);
        if (!deleteSuccess) {
             OPTIMISM_UTILS.logError(`Failed to delete original element ${this.elementId} after moving to inbox.`);
             // Rollback: remove from inbox
             await this.model.removeFromInbox(this.inboxCard.id);
             this.inboxCard = null;
             return false;
        }

        OPTIMISM_UTILS.log(`Moved element ${this.elementId}${this.originalChildNodeData ? ' (with nested data)' : ''} to inbox`);
        return true;
    }

    async undo() {
         OPTIMISM_UTILS.log(`Undoing MoveToInboxCommand for original ${this.elementId}`);
        if (!this.element || !this.inboxCard) {
            OPTIMISM_UTILS.logError(`Undo failed: Missing original element or inbox card info.`);
            return;
        }

        // Remove from inbox
        const removed = await this.model.removeFromInbox(this.inboxCard.id);
        if (!removed) {
             OPTIMISM_UTILS.logError(`Failed to remove card ${this.inboxCard.id} from inbox during undo`);
             // Continue anyway to try restoring to canvas
        }

        // Restore the original element to the original node
         const parentNode = this.model.findNodeById(this.nodeId);
         if (!parentNode) {
              OPTIMISM_UTILS.logError(`Undo failed: Original parent node ${this.nodeId} not found for element ${this.elementId}`);
              return;
         }

        if (!parentNode.elements) parentNode.elements = [];
         // Prevent duplicate addition
         if (!parentNode.elements.some(el => el.id === this.element.id)) {
             parentNode.elements.push(this.element); // Restore original element
         } else {
             OPTIMISM_UTILS.log(`Undo Warning: Element ${this.element.id} already exists in node ${this.nodeId}`);
         }


        // Restore original nested data
        if (this.originalChildNodeData) {
            if (!parentNode.children) parentNode.children = {};
            parentNode.children[this.element.id] = structuredClone(this.originalChildNodeData);
            OPTIMISM_UTILS.log(`Restored nested data for element ${this.element.id} during move to inbox undo`);
        }

         // Restore images
         if (this.allOriginalImageData.size > 0) {
             OPTIMISM_UTILS.log(`Restoring ${this.allOriginalImageData.size} images during move to inbox undo.`);
             const restorePromises = [];
             this.allOriginalImageData.forEach((data, id) => {
                 restorePromises.push(this.model.saveImageData(id, data).catch(err => {
                     OPTIMISM_UTILS.logError(`Failed to restore image ${id} during undo:`, err);
                 }));
             });
             await Promise.all(restorePromises);
             // Dequeue restored images
             this.model.dequeueImagesForDeletion(Array.from(this.allOriginalImageData.keys()));
             await this.model.saveAppState();
         }

        await this.model.saveData(); // Save the restored node data
        OPTIMISM_UTILS.log(`Restored element ${this.elementId} to node ${this.nodeId} during move to inbox undo`);
    }
}
