// --- START OF FILE commands.js ---

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
        // For AddElementCommand, nodeId is always the current canvas node where it's being added.
        this.nodeId = model.currentNode?.id; 
        if (!this.nodeId) {
             throw new Error("AddElementCommand could not determine the current node ID for element creation.");
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
        const targetNode = this.model.findNodeById(this.nodeId);
        if (!targetNode) {
             throw new Error(`Target node ${this.nodeId} not found for adding element ${this.element.id}`);
        }
        if (!targetNode.elements) {
            targetNode.elements = [];
        }
        targetNode.elements.push(this.element);
        await this.model.saveData(); 
        return this.element.id; 
    }

    async undo() {
        OPTIMISM_UTILS.log(`Undoing AddElementCommand for ${this.element.id} in node ${this.nodeId}`);
        const success = await this.model.deleteElement(this.element.id, this.nodeId); 
        if (!success) {
            OPTIMISM_UTILS.logError(`Undo failed: Could not delete element ${this.element.id} from node ${this.nodeId}`);
        }
    }
}

export class DeleteElementCommand extends Command {
    constructor(model, elementId, targetNodeId = null) { // Added targetNodeId
        super(model);
        this.elementId = elementId;
        this.nodeId = targetNodeId || model.currentNode?.id; // Use targetNodeId or default
        this.parentNodeId = this.nodeId; // The node from which element is deleted

        if (!this.nodeId) {
             throw new Error("DeleteElementCommand could not determine the target node ID for deletion.");
        }

        const parentNodeForBackup = model.findNodeById(this.nodeId);
        const elementToBackup = parentNodeForBackup?.elements?.find(el => el.id === elementId);

        if (elementToBackup) {
            this.element = structuredClone(elementToBackup); 
            const childNodeStructure = parentNodeForBackup.children ? parentNodeForBackup.children[elementId] : null;
            this.originalChildNodeData = childNodeStructure ? structuredClone(childNodeStructure) : null; 
            this.allOriginalImageData = new Map(); 
        } else {
            OPTIMISM_UTILS.logError(`Element ${elementId} not found in node ${this.nodeId} for DeleteElementCommand backup.`);
            this.element = null;
            this.originalChildNodeData = null;
            this.allOriginalImageData = new Map();
        }
    }

    async execute() {
        OPTIMISM_UTILS.log(`Executing DeleteElementCommand for ${this.elementId} in node ${this.nodeId}`);
        if (!this.element) {
            OPTIMISM_UTILS.log(`DeleteElementCommand: Element ${this.elementId} was not found during constructor, cannot execute.`);
            return { success: false, parentNodeId: this.nodeId };
        }

        let idsToBackup = [];
        if (this.element.type === 'image' && this.element.imageDataId) {
            idsToBackup.push(this.element.imageDataId);
        }
        if (this.originalChildNodeData) {
            idsToBackup = idsToBackup.concat(this.model.findAllImageIdsRecursive(this.originalChildNodeData));
        }
        idsToBackup = [...new Set(idsToBackup)];

        if (idsToBackup.length > 0) {
            OPTIMISM_UTILS.log(`DeleteElementCommand: Backing up image data for ${idsToBackup.length} images.`);
            const backupPromises = idsToBackup.map(async (id) => {
                try {
                    const data = await this.model.getImageData(id);
                    if (data) this.allOriginalImageData.set(id, data);
                } catch (error) { OPTIMISM_UTILS.logError(`Failed to backup image data for ${id}:`, error); }
            });
            await Promise.all(backupPromises);
        }

        const deleteSuccess = await this.model.deleteElement(this.elementId, this.nodeId); 
        return { success: deleteSuccess, parentNodeId: this.nodeId }; 
    }

    async undo() {
        OPTIMISM_UTILS.log(`Undoing DeleteElementCommand for ${this.elementId} into node ${this.nodeId}`);
        if (!this.element) {
            OPTIMISM_UTILS.logError(`Undo DeleteElementCommand: Original element data for ${this.elementId} is missing.`);
            return;
        }

        const parentNodeToRestore = this.model.findNodeById(this.nodeId);
        if (!parentNodeToRestore) {
             OPTIMISM_UTILS.logError(`Undo DeleteElementCommand failed: Original parent node ${this.nodeId} not found.`);
             return;
        }

        if (!parentNodeToRestore.elements) parentNodeToRestore.elements = [];
        if (!parentNodeToRestore.elements.some(el => el.id === this.element.id)) {
             parentNodeToRestore.elements.push(this.element); // Restore to its original position/order implicitly if model.elements maintains order
        } else {
             OPTIMISM_UTILS.log(`Undo DeleteElementCommand Warning: Element ${this.element.id} already exists in node ${this.nodeId}`);
        }

        if (this.originalChildNodeData) {
            if (!parentNodeToRestore.children) parentNodeToRestore.children = {};
            parentNodeToRestore.children[this.element.id] = structuredClone(this.originalChildNodeData);
            OPTIMISM_UTILS.log(`Restored nested data for element ${this.element.id} during delete undo`);
        }

        if (this.allOriginalImageData.size > 0) {
            OPTIMISM_UTILS.log(`Restoring ${this.allOriginalImageData.size} images during delete undo.`);
            const restorePromises = [];
            this.allOriginalImageData.forEach((data, id) => {
                restorePromises.push(this.model.saveImageData(id, data).catch(err => {
                    OPTIMISM_UTILS.logError(`Failed to restore image ${id} during delete undo:`, err);
                }));
            });
            await Promise.all(restorePromises);
        }

        const restoredImageIds = Array.from(this.allOriginalImageData.keys());
        if (restoredImageIds.length > 0) {
             this.model.dequeueImagesForDeletion(restoredImageIds); 
        }

        await this.model.saveData(); 
        await this.model.saveAppState(); 

         return { success: true, parentNodeId: this.nodeId, createdElementId: this.element.id };
    }
}

export class UpdateElementCommand extends Command {
    constructor(model, elementId, newProperties, explicitOldProperties = null, targetNodeId = null) { // Added targetNodeId
        super(model);
        this.elementId = elementId;
        this.newProperties = structuredClone(newProperties);
        this.nodeId = targetNodeId || model.currentNode?.id; // Use targetNodeId or default

        if (!this.nodeId) {
             throw new Error("UpdateElementCommand could not determine the target node ID for update.");
        }

        const parentNodeForBackup = model.findNodeById(this.nodeId);
        const elementToBackup = parentNodeForBackup?.elements?.find(el => el.id === elementId);

        if (!elementToBackup) {
            OPTIMISM_UTILS.logError(`Element ${elementId} not found in node ${this.nodeId} for UpdateElementCommand backup.`);
            this.oldProperties = null;
            this.isText = false;
            this.fullElement = null; 
        } else {
             this.isText = elementToBackup.type === 'text';
             if (explicitOldProperties) {
                 this.oldProperties = structuredClone(explicitOldProperties);
             } else {
                 this.oldProperties = {};
                 for (const key in newProperties) {
                     if (Object.hasOwnProperty.call(elementToBackup, key)) {
                          this.oldProperties[key] = structuredClone(elementToBackup[key]);
                     }
                 }
             }
             this.mightDelete = this.isText &&
                newProperties.text !== undefined &&
                (String(newProperties.text).trim() === '');

             if (this.mightDelete) {
                 this.fullElement = structuredClone(elementToBackup); 
             }
        }
        this.wasDeleted = false; 
    }

    async execute() {
        OPTIMISM_UTILS.log(`Executing UpdateElementCommand for ${this.elementId} in node ${this.nodeId}`);
        if (!this.oldProperties && !this.mightDelete) {
            OPTIMISM_UTILS.log(`UpdateElementCommand: Element ${this.elementId} not found during constructor or no properties to update.`);
            return false; 
        }

        if (this.mightDelete) {
            OPTIMISM_UTILS.log(`Update command triggering deletion for ${this.elementId} in node ${this.nodeId}`);
            if (!this.fullElement) { 
                 OPTIMISM_UTILS.logError(`Update->Delete Error: Full element backup missing for ${this.elementId}`);
                 return false; 
            }
            this.wasDeleted = true;
            const deleteCmd = new DeleteElementCommand(this.model, this.elementId, this.nodeId); 
            const deleteResult = await deleteCmd.execute(); 
            this.allOriginalImageData = deleteCmd.allOriginalImageData; // Store backed up image data
            return deleteResult.success; // Return success from delete command
        }

        const updatedElement = await this.model.updateElement(this.elementId, this.newProperties, this.nodeId);
        return !!updatedElement;
    }

    async undo() {
        OPTIMISM_UTILS.log(`Undoing UpdateElementCommand for ${this.elementId} in node ${this.nodeId}`);
        if (this.wasDeleted) {
             if (!this.fullElement) {
                 OPTIMISM_UTILS.logError(`Undo Update(Delete): Original fullElement backup missing for ${this.elementId}.`);
                 return;
             }
             const parentNodeToRestore = this.model.findNodeById(this.nodeId);
             if (parentNodeToRestore) {
                 if (!parentNodeToRestore.elements) parentNodeToRestore.elements = [];
                 if (!parentNodeToRestore.elements.some(el => el.id === this.fullElement.id)) {
                     parentNodeToRestore.elements.push(this.fullElement); 
                     
                     if (this.originalChildNodeData) { // Also restore child node structure if it existed
                        if (!parentNodeToRestore.children) parentNodeToRestore.children = {};
                        parentNodeToRestore.children[this.fullElement.id] = structuredClone(this.originalChildNodeData);
                     }

                     if (this.allOriginalImageData && this.allOriginalImageData.size > 0) {
                          OPTIMISM_UTILS.log(`Restoring ${this.allOriginalImageData.size} images during update>delete undo.`);
                          const restorePromises = [];
                          this.allOriginalImageData.forEach((data, id) => {
                              restorePromises.push(this.model.saveImageData(id, data).catch(err => {
                                  OPTIMISM_UTILS.logError(`Failed to restore image ${id} during undo:`, err);
                              }));
                          });
                          await Promise.all(restorePromises);
                          this.model.dequeueImagesForDeletion(Array.from(this.allOriginalImageData.keys()));
                          await this.model.saveAppState(); // Save app state for dequeued images
                     }
                     await this.model.saveData(); // Save main data
                 } else {
                      OPTIMISM_UTILS.log(`Undo Update(Delete) Warning: Element ${this.fullElement.id} already exists in node ${this.nodeId}`);
                 }
             } else {
                 OPTIMISM_UTILS.logError(`Undo Update(Delete) failed: Parent node ${this.nodeId} not found.`);
             }
        } else if (this.oldProperties) {
            await this.model.updateElement(this.elementId, this.oldProperties, this.nodeId);
        }
    }
}

export class MoveElementCommand extends Command {
    constructor(model, sourceElementId, targetElementId) {
        super(model);
        this.sourceElementId = sourceElementId; 
        this.targetElementId = targetElementId; 
        this.sourceNodeId = model.currentNode?.id; 
         if (!this.sourceNodeId) {
             throw new Error("MoveElementCommand could not determine the source node ID.");
        }

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
         this.newElementId = null;
    }

    async execute() {
        OPTIMISM_UTILS.log(`Executing MoveElementCommand: ${this.sourceElementId} -> ${this.targetElementId} in source node ${this.sourceNodeId}`);
        if (!this.originalElement) return false;

        const result = await this.model.moveElement(this.sourceElementId, this.targetElementId, this.sourceNodeId);

        if (result && result.newElementId) {
             this.newElementId = result.newElementId; 
             OPTIMISM_UTILS.log(`Move successful. New element ID in target node: ${this.newElementId}`);
            return true;
        } else {
             OPTIMISM_UTILS.logError(`MoveElement command failed for source ${this.sourceElementId}.`);
             this.newElementId = null;
            return false;
        }
    }

    async undo() {
        OPTIMISM_UTILS.log(`Undoing MoveElementCommand for original ${this.sourceElementId} (new was ${this.newElementId})`);
        if (!this.originalElement || !this.newElementId) {
             OPTIMISM_UTILS.logError(`Undo MoveElementCommand failed: Missing original element or new element ID.`);
             return;
        }

        const sourceNode = this.model.findNodeById(this.sourceNodeId);
        if (!sourceNode) {
            OPTIMISM_UTILS.logError(`Undo MoveElementCommand failed: Source node ${this.sourceNodeId} not found.`);
            return;
        }
        const targetParentOfMovedElement = sourceNode.children ? sourceNode.children[this.targetElementId] : null;
        
        if (!targetParentOfMovedElement) {
             OPTIMISM_UTILS.logError(`Undo MoveElementCommand failed: Target parent node (where ${this.newElementId} was moved to, child of ${this.targetElementId}) not found.`);
        } else {
            OPTIMISM_UTILS.log(`Deleting moved element ${this.newElementId} from its new parent node ${targetParentOfMovedElement.id}`);
            // DeleteElementCommand needs the actual parent ID of the element to be deleted.
            const deleteCmd = new DeleteElementCommand(this.model, this.newElementId, targetParentOfMovedElement.id); 
            await deleteCmd.execute(); 
        }

        if (!sourceNode.elements) sourceNode.elements = [];
         if (!sourceNode.elements.some(el => el.id === this.originalElement.id)) {
             sourceNode.elements.push(this.originalElement); 
         } else {
             OPTIMISM_UTILS.log(`Undo MoveElementCommand Warning: Original element ${this.originalElement.id} already exists in source node ${this.sourceNodeId}`);
         }

        if (this.originalChildNodeData) {
            if (!sourceNode.children) sourceNode.children = {};
            sourceNode.children[this.originalElement.id] = structuredClone(this.originalChildNodeData);
        }
        
        // Image data restoration associated with the *original* element relies on the image deletion queue.
        // If `model.moveElement` involves deep copying images, then `deleteCmd.execute()` above would have backed up
        // images associated with `this.newElementId`. The `originalElement`'s images (if any) should
        // still be in the DB unless they were explicitly queued for deletion and that queue processed.
        // If the images were part of `originalChildNodeData`, they are restored with it.

        await this.model.saveData(); 
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
        this.newElementId = null;
    }

    async execute() {
         OPTIMISM_UTILS.log(`Executing MoveElementToBreadcrumbCommand: ${this.sourceElementId} (from ${this.sourceNodeId}) -> NavIndex ${this.navIndex} (Node ${this.targetNodeId})`);
        if (!this.originalElement) return false;

        const result = await this.model.moveElementToBreadcrumb(this.sourceElementId, this.navIndex, this.sourceNodeId);

        if (result && result.newElementId) {
             this.newElementId = result.newElementId; 
             OPTIMISM_UTILS.log(`Breadcrumb move successful. New element ID: ${this.newElementId} in node ${this.targetNodeId}`);
            return true;
        } else {
            OPTIMISM_UTILS.logError(`MoveElementToBreadcrumb command failed for source ${this.sourceElementId}.`);
             this.newElementId = null;
            return false;
        }
    }

    async undo() {
        OPTIMISM_UTILS.log(`Undoing MoveElementToBreadcrumbCommand for original ${this.sourceElementId} (new was ${this.newElementId} in ${this.targetNodeId})`);
         if (!this.originalElement || !this.newElementId) {
             OPTIMISM_UTILS.logError(`Undo MoveToBreadcrumb failed: Missing original element or new element ID.`);
             return;
        }

        // The new element was created in targetNodeId. Delete it from there.
        OPTIMISM_UTILS.log(`Deleting moved element ${this.newElementId} from target node ${this.targetNodeId}`);
        const deleteCmd = new DeleteElementCommand(this.model, this.newElementId, this.targetNodeId); 
        await deleteCmd.execute();
        
        const sourceNode = this.model.findNodeById(this.sourceNodeId);
        if (!sourceNode) {
             OPTIMISM_UTILS.logError(`Undo MoveToBreadcrumb failed: Source node ${this.sourceNodeId} not found.`);
             return;
        }
        if (!sourceNode.elements) sourceNode.elements = [];
         if (!sourceNode.elements.some(el => el.id === this.originalElement.id)) {
            sourceNode.elements.push(this.originalElement);
         } else {
             OPTIMISM_UTILS.log(`Undo MoveToBreadcrumb Warning: Original element ${this.originalElement.id} already exists in source node ${this.sourceNodeId}`);
         }

        if (this.originalChildNodeData) {
            if (!sourceNode.children) sourceNode.children = {};
            sourceNode.children[this.originalElement.id] = structuredClone(this.originalChildNodeData);
        }

        await this.model.saveData();
        OPTIMISM_UTILS.log(`Restored original element ${this.originalElement.id} to node ${this.sourceNodeId} during breadcrumb move undo.`);
    }
}

export class MoveToInboxCommand extends Command {
    constructor(model, elementId) {
        super(model);
        this.elementId = elementId;
        this.nodeId = model.currentNode?.id; 
        if (!this.nodeId) {
             throw new Error("MoveToInboxCommand could not determine the current node ID.");
        }

        const parentNodeForBackup = model.findNodeById(this.nodeId);
        const elementToBackup = parentNodeForBackup?.elements?.find(el => el.id === elementId);

        if (elementToBackup) {
            this.element = structuredClone(elementToBackup); 
            const childNodeStructure = parentNodeForBackup.children ? parentNodeForBackup.children[elementId] : null;
            this.originalChildNodeData = childNodeStructure ? structuredClone(childNodeStructure) : null;
            this.allOriginalImageData = new Map(); 
        } else {
            OPTIMISM_UTILS.logError(`Element ${elementId} not found in node ${this.nodeId} for MoveToInboxCommand`);
            this.element = null;
            this.originalChildNodeData = null;
            this.allOriginalImageData = new Map();
        }
        this.inboxCard = null; 
    }

    async execute() {
        OPTIMISM_UTILS.log(`Executing MoveToInboxCommand for ${this.elementId} from node ${this.nodeId}`);
        if (!this.element) return false;

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

        this.inboxCard = await this.model.addToInbox(this.element, this.originalChildNodeData);
        if (!this.inboxCard) {
            OPTIMISM_UTILS.logError(`Failed to add element ${this.elementId} to inbox`);
            return false;
        }

        const deleteSuccess = await this.model.deleteElement(this.elementId, this.nodeId);
        if (!deleteSuccess) {
             OPTIMISM_UTILS.logError(`Failed to delete original element ${this.elementId} after moving to inbox.`);
             await this.model.removeFromInbox(this.inboxCard.id);
             this.inboxCard = null;
             return false;
        }

        OPTIMISM_UTILS.log(`Moved element ${this.elementId}${this.originalChildNodeData ? ' (with nested data)' : ''} to inbox as card ${this.inboxCard.id}`);
        return true;
    }

    async undo() {
         OPTIMISM_UTILS.log(`Undoing MoveToInboxCommand for original element ${this.elementId} (inbox card ${this.inboxCard?.id})`);
        if (!this.element || !this.inboxCard) {
            OPTIMISM_UTILS.logError(`Undo MoveToInbox failed: Missing original element or inbox card info.`);
            return;
        }

        const removed = await this.model.removeFromInbox(this.inboxCard.id);
        if (!removed) {
             OPTIMISM_UTILS.logError(`Failed to remove card ${this.inboxCard.id} from inbox during undo`);
        }

         const parentNodeToRestore = this.model.findNodeById(this.nodeId);
         if (!parentNodeToRestore) {
              OPTIMISM_UTILS.logError(`Undo MoveToInbox failed: Original parent node ${this.nodeId} not found.`);
              return;
         }

        if (!parentNodeToRestore.elements) parentNodeToRestore.elements = [];
         if (!parentNodeToRestore.elements.some(el => el.id === this.element.id)) {
             parentNodeToRestore.elements.push(this.element); 
         } else {
             OPTIMISM_UTILS.log(`Undo MoveToInbox Warning: Element ${this.element.id} already exists in node ${this.nodeId}`);
         }

        if (this.originalChildNodeData) {
            if (!parentNodeToRestore.children) parentNodeToRestore.children = {};
            parentNodeToRestore.children[this.element.id] = structuredClone(this.originalChildNodeData);
        }

         if (this.allOriginalImageData.size > 0) {
             OPTIMISM_UTILS.log(`Restoring ${this.allOriginalImageData.size} images during move to inbox undo.`);
             const restorePromises = [];
             this.allOriginalImageData.forEach((data, id) => {
                 restorePromises.push(this.model.saveImageData(id, data).catch(err => {
                     OPTIMISM_UTILS.logError(`Failed to restore image ${id} during undo:`, err);
                 }));
             });
             await Promise.all(restorePromises);
             this.model.dequeueImagesForDeletion(Array.from(this.allOriginalImageData.keys()));
             await this.model.saveAppState();
         }

        await this.model.saveData(); 
        OPTIMISM_UTILS.log(`Restored element ${this.elementId} to node ${this.nodeId} during move to inbox undo`);
    }
}
// --- END OF FILE commands.js ---