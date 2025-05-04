import { OPTIMISM_UTILS } from './utils.js';
import { SimpleDB } from './database.js'; // Assuming SimpleDB is exported

export class CanvasModel {
    constructor(dbInstance) {
        if (!dbInstance || typeof dbInstance.getData !== 'function') {
             throw new Error("CanvasModel requires a valid SimpleDB instance.");
        }
        this.db = dbInstance;

        // Core Data Structure
        this.data = null; // Root node object, loaded async
        this.currentNode = null; // Reference to the current node object in this.data
        this.selectedElement = null; // ID of the selected element in the current view

        // Navigation
        this.navigationStack = []; // Stack of { nodeId, nodeTitle, node }

        // State Management
        // this.isDarkTheme = true; // REMOVE theme state
        this.editCounter = 0;
        this.lastBackupReminder = 0;
        this.backupReminderThreshold = 200;
        this.isDebugVisible = false;
        this.isNestingDisabled = false;
        this.imagesLocked = false;
        this.lockedCards = []; // IDs of locked cards
        this.priorityCards = []; // IDs of priority cards

        // Panels Visibility State
        this.panels = {
            settings: false,
            inbox: false,
            grid: false,
            arena: false,
            style: false, // Added for consistency, though usually transient
            priorities: false,
        };

        // Features State
        this.inboxCards = []; // Array of card objects in the inbox
        this.quickLinks = []; // Array of { nodeId, nodeTitle, expiresAt }
        this.quickLinkExpiryCount = 100; // Edits before a quick link expires
        this.gridLayout = '1x2'; // Default grid layout

        // Image Management
        this.deletedImageQueue = []; // Array of { imageId, deleteAtCounter }

        // Undo/Redo
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistorySize = 50;
    }

    // --- Initialization ---
    async initialize() {
        try {
            OPTIMISM_UTILS.log('Initializing model...');
            // DB opening is handled in main.js now
            OPTIMISM_UTILS.log('Loading core data...');
            await this.loadData(); // Loads root node and app state
            // OPTIMISM_UTILS.log('Loading theme...'); // REMOVE theme loading call
            // await this.loadTheme(); // REMOVE theme loading call

            // Post-load checks and logs
            if (!this.data || !this.currentNode) {
                throw new Error("Failed to load root node data.");
            }
            OPTIMISM_UTILS.log(`Model Initialized. Current Node: ${this.currentNode.id}`);
            OPTIMISM_UTILS.log(`Edit Counter: ${this.editCounter}, Last Backup: ${this.lastBackupReminder}`);
            OPTIMISM_UTILS.log(`Quick Links: ${this.quickLinks.length}, Inbox Cards: ${this.inboxCards.length}`);
            OPTIMISM_UTILS.log(`Images Locked: ${this.imagesLocked}, Nesting Disabled: ${this.isNestingDisabled}`);

            return true;
        } catch (error) {
            OPTIMISM_UTILS.logError('Failed to initialize model:', error);
             // Attempt to create minimal fallback state if DB failed completely
             if (!this.data) {
                 OPTIMISM_UTILS.log('Creating fallback in-memory data structure.');
                 this.data = { id: 'root', title: 'Home', elements: [], children: {} };
                 this.navigationStack = [{ nodeId: 'root', nodeTitle: 'Home', node: this.data }];
                 this.currentNode = this.data;
                 OPTIMISM_UTILS.showMemoryMode(); // Indicate potential data loss
             }
            return false; // Indicate initialization issue
        }
    }

     // --- Core Data Loading/Saving ---

     async loadData() {
         try {
             // Load root node first
             let rootData = await this.db.getData(this.db.STORE_NAMES.DATA, 'root');
             if (!rootData) {
                 OPTIMISM_UTILS.log('No root node found, creating default structure.');
                 rootData = { id: 'root', title: 'Home', elements: [], children: {} };
                 await this.db.put(this.db.STORE_NAMES.DATA, rootData);
             }
             this.data = rootData;
             this.navigationStack = [{ nodeId: 'root', nodeTitle: 'Home', node: this.data }];
             this.currentNode = this.data;

             // Load app state
             const appState = await this.db.getData(this.db.STORE_NAMES.DATA, 'appState');
             if (appState) {
                 this.deletedImageQueue = appState.deletedImageQueue || [];
                 this.editCounter = appState.editCounter || 0;
                 this.lastBackupReminder = appState.lastBackupReminder || 0;
                 this.imagesLocked = appState.imagesLocked || false;
                 this.quickLinks = appState.quickLinks || [];
                 this.lockedCards = appState.lockedCards || [];
                 this.inboxCards = appState.inboxCards || [];
                 this.gridLayout = appState.gridLayout || '1x2';
                 this.isNestingDisabled = appState.isNestingDisabled || false;
                 this.priorityCards = appState.priorityCards || [];

                 // Load panel states (ensure boolean conversion)
                 this.panels.settings = !!appState.isSettingsVisible;
                 this.panels.inbox = !!appState.isInboxVisible;
                 this.panels.grid = !!appState.isGridVisible;
                 this.panels.arena = !!appState.isArenaVisible;
                 this.panels.priorities = !!appState.isPrioritiesVisible;

                  OPTIMISM_UTILS.log(`Loaded app state (Edit: ${this.editCounter}, Panels: ${JSON.stringify(this.panels)})`);
             } else {
                  OPTIMISM_UTILS.log('No app state found, using defaults.');
             }

         } catch (error) {
             OPTIMISM_UTILS.logError('Error loading core data:', error);
             throw error; // Re-throw to be handled by initialize
         }
     }

     // Saves the *entire* main data structure (root node and all children)
     async saveData() {
         try {
             if (!this.data) throw new Error("Cannot save null data.");
             await this.db.put(this.db.STORE_NAMES.DATA, this.data);
             // OPTIMISM_UTILS.log('Main data saved.'); // Can be too verbose
         } catch (error) {
             OPTIMISM_UTILS.logError('Error saving main data:', error);
             // Consider notifying the user or attempting recovery
         }
     }

     // Saves the application's meta-state
     async saveAppState() {
         try {
             const appState = {
                 id: 'appState',
                 deletedImageQueue: this.deletedImageQueue,
                 editCounter: this.editCounter,
                 lastBackupReminder: this.lastBackupReminder,
                 imagesLocked: this.imagesLocked,
                 quickLinks: this.quickLinks,
                 lockedCards: this.lockedCards,
                 inboxCards: this.inboxCards,
                 gridLayout: this.gridLayout,
                 isNestingDisabled: this.isNestingDisabled,
                 priorityCards: this.priorityCards,
                 // Save panel states from the panels object
                 isSettingsVisible: this.panels.settings,
                 isInboxVisible: this.panels.inbox,
                 isGridVisible: this.panels.grid,
                 isArenaVisible: this.panels.arena,
                 isPrioritiesVisible: this.panels.priorities,
             };
             await this.db.put(this.db.STORE_NAMES.DATA, appState);
              // OPTIMISM_UTILS.log('App state saved.'); // Can be too verbose
         } catch (error) {
             OPTIMISM_UTILS.logError('Error saving app state:', error);
             // Consider notifying the user
         }
     }

     // --- REMOVE Theme Management Methods ---
     // async loadTheme() { ... }
     // async saveTheme() { ... }
     // async toggleTheme() { ... }

     // --- Element Manipulation ---

     // Find element only within the CURRENT node
     findElement(id) {
         return this.currentNode?.elements?.find(el => el && el.id === id);
     }

    // Find node anywhere in the data structure
     findNodeById(nodeId) {
        if (nodeId === 'root') return this.data;
        return this._findNodeRecursive(this.data, nodeId);
    }

    _findNodeRecursive(currentNode, targetId) {
        if (!currentNode) return null;
        // Check children first (most common case for non-root IDs)
        if (currentNode.children && currentNode.children[targetId]) {
            return currentNode.children[targetId];
        }
        // If the current node itself matches (e.g., root was passed)
        if (currentNode.id === targetId) return currentNode;

        // Recurse through children if not found directly
        if (currentNode.children) {
            for (const childId in currentNode.children) {
                const result = this._findNodeRecursive(currentNode.children[childId], targetId);
                if (result) return result;
            }
        }
        return null;
    }

    // Find parent node of a given node ID
    findParentNode(nodeId) {
        if (nodeId === 'root') return null;
        return this._findParentNodeRecursive(this.data, nodeId);
    }

     _findParentNodeRecursive(currentNode, targetId) {
         if (currentNode.children) {
             if (currentNode.children[targetId]) {
                 return currentNode; // Found parent
             }
             for (const childId in currentNode.children) {
                 const result = this._findParentNodeRecursive(currentNode.children[childId], targetId);
                 if (result) return result;
             }
         }
         return null;
     }

     // Finds an element anywhere by ID (used by Priority Panel)
     findElementGlobally(elementId) {
          return OPTIMISM_UTILS.findElementByIdRecursive(this.data, elementId);
     }

     // Updates an element within a specific node (defaults to current)
     async updateElement(id, properties, nodeId = this.currentNode?.id) {
        const parentNode = this.findNodeById(nodeId);
        if (!parentNode || !parentNode.elements) {
            OPTIMISM_UTILS.logError(`Cannot update element ${id}: Parent node ${nodeId} or elements array not found.`);
            return null;
        }

        const elementIndex = parentNode.elements.findIndex(el => el.id === id);
        if (elementIndex === -1) {
            OPTIMISM_UTILS.logError(`Cannot update element ${id}: Element not found in node ${nodeId}.`);
            return null;
        }
        const element = parentNode.elements[elementIndex];

        // Merge properties (careful with nested objects like style)
        for (const key in properties) {
            if (key === 'style' && typeof properties.style === 'object' && element.style) {
                 // Merge style properties instead of overwriting
                 element.style = { ...element.style, ...properties.style };
            } else {
                 element[key] = properties[key];
            }
        }

        // *** ADD Check for Empty Text during Update ***
        if (element.type === 'text' && properties.text !== undefined && String(properties.text).trim() === '') {
             OPTIMISM_UTILS.log(`Update resulted in empty text, deleting element ${id} from node ${nodeId}`);
             // Use deleteElement logic (which handles nested/images)
             // Need to await this and return null AFTER saving potential non-text changes if any
             await this.deleteElement(id, nodeId);
             return null; // Indicate deletion
        }

        await this.saveData();
        return element; // Return the updated element reference
     }

     // Deletes an element from a specific node (defaults to current)
     // Now handles nested node deletion and image queuing
     async deleteElement(id, nodeId = this.currentNode?.id) {
         const parentNode = this.findNodeById(nodeId);
         if (!parentNode || !parentNode.elements) {
             OPTIMISM_UTILS.logError(`Cannot delete element ${id}: Parent node ${nodeId} or elements array not found.`);
             return false;
         }

         const index = parentNode.elements.findIndex(el => el.id === id);
         if (index === -1) {
             OPTIMISM_UTILS.logError(`Cannot delete element ${id}: Element not found in node ${nodeId}.`);
             return false;
         }
         const element = parentNode.elements[index];
         OPTIMISM_UTILS.log(`Deleting element ${id} (type: ${element.type}) from node ${nodeId}`);

         let collectedImageIds = [];
         // If the element itself is an image
         if (element.type === 'image' && element.imageDataId) {
             collectedImageIds.push(element.imageDataId);
         }

         // If the element had a corresponding child node structure
         if (parentNode.children && parentNode.children[id]) {
             OPTIMISM_UTILS.log(`Deleting nested child node structure for element ${id}`);
             const nodeToDelete = parentNode.children[id];
             const nestedImageIds = this.findAllImageIdsRecursive(nodeToDelete);
             collectedImageIds = collectedImageIds.concat(nestedImageIds);
             delete parentNode.children[id]; // Delete the child node entry
             OPTIMISM_UTILS.log(`Removed child node entry for ${id}. Found ${nestedImageIds.length} nested images.`);
         }

         // Remove element from array
         parentNode.elements.splice(index, 1);

         // Remove from priority list if present
         const priorityIndex = this.priorityCards.indexOf(id);
         if (priorityIndex > -1) {
             this.priorityCards.splice(priorityIndex, 1);
             OPTIMISM_UTILS.log(`Removed element ${id} from priority list during deletion.`);
         }

         // Remove from locked cards list if present
         const lockedIndex = this.lockedCards.indexOf(id);
         if (lockedIndex > -1) {
              this.lockedCards.splice(lockedIndex, 1);
              OPTIMISM_UTILS.log(`Removed element ${id} from locked cards list during deletion.`);
         }

         // Queue all collected image IDs for deletion
         this.queueImagesForDeletion(collectedImageIds);

         // Save changes
         await this.saveData();
         await this.saveAppState(); // Save updated priority/locked/queue lists

         OPTIMISM_UTILS.log(`Completed deletion for element ${id}`);
         return true;
     }

     // Check if an element has children cards (nested data)
     hasChildren(elementId, nodeId = this.currentNode?.id) {
          const parentNode = this.findNodeById(nodeId);
          return !!(parentNode?.children && parentNode.children[elementId]);
          // Optionally add check for actual content:
          // const childNode = parentNode?.children?.[elementId];
          // return !!childNode && (childNode.elements?.length > 0 || Object.keys(childNode.children || {}).length > 0);
     }

    // --- Navigation ---

    // Simplified: Navigate to a specific node ID. Assumes node exists.
    // Handles updating navigation stack and current node.
    async _setCurrentNode(nodeId) {
         const targetNode = this.findNodeById(nodeId);
         if (!targetNode) {
             OPTIMISM_UTILS.logError(`Cannot set current node: Node ${nodeId} not found.`);
             return false;
         }
         this.currentNode = targetNode;
         this.selectedElement = null; // Deselect element on navigation
         return true;
    }

    // Navigate into an element, creating child node if needed
    async navigateToElement(elementId) {
        const element = this.findElement(elementId); // Find in current node
        if (!element) {
            OPTIMISM_UTILS.logError(`Cannot navigate: Element ${elementId} not found in current node ${this.currentNode.id}.`);
            return false;
        }

        const parentNode = this.currentNode; // Current node becomes parent

        // Ensure children object exists on parent
        if (!parentNode.children) parentNode.children = {};

        // Get or create the child node
        let childNode = parentNode.children[elementId];
        let nodeTitle = "Untitled";

        if (element.type === 'text') {
             nodeTitle = element.text ? (String(element.text).trim() === "" ? "Untitled" : String(element.text).substring(0, 60)) : "Untitled";
        } else if (element.type === 'image') {
             nodeTitle = "Image"; // Or use filename/alt text if available
        }

        if (!childNode) {
            childNode = {
                id: elementId, // Child node ID matches element ID
                parentId: parentNode.id,
                title: nodeTitle,
                elements: [],
                children: {}
            };
            parentNode.children[elementId] = childNode;
            OPTIMISM_UTILS.log(`Created child node for element ${elementId}`);
        } else {
             // Update title if it exists and element text might have changed
             childNode.title = nodeTitle;
        }

        // Update navigation stack
        this.navigationStack.push({ nodeId: elementId, nodeTitle: childNode.title, node: childNode });
        this.currentNode = childNode;
        this.selectedElement = null;

        this.updateUrlHash(); // Update browser URL
        await this.saveData(); // Save changes (node creation/title update)
        OPTIMISM_UTILS.log(`Navigated into element ${elementId}. Stack depth: ${this.navigationStack.length}`);
        return true;
    }

    // Navigate back one level
    async navigateBack() {
        if (this.navigationStack.length <= 1) return false; // Cannot go back from root

        const leavingNodeId = this.navigationStack.pop().nodeId;
        const newCurrent = this.navigationStack[this.navigationStack.length - 1];
        this.currentNode = newCurrent.node;
        this.selectedElement = null;

        // Optionally clean up empty nodes upon leaving - TBD if needed

        this.updateUrlHash();
        OPTIMISM_UTILS.log(`Navigated back to ${this.currentNode.id}. Stack depth: ${this.navigationStack.length}`);
        // No data save needed usually, unless cleanup happened
        return true;
    }

    // Navigate to a specific index in the breadcrumb trail
    async navigateToIndex(index) {
        if (index < 0 || index >= this.navigationStack.length) return false;

        this.navigationStack = this.navigationStack.slice(0, index + 1);
        const newCurrent = this.navigationStack[index];
        this.currentNode = newCurrent.node;
        this.selectedElement = null;

        this.updateUrlHash();
        OPTIMISM_UTILS.log(`Navigated to index ${index} (${this.currentNode.id}). Stack depth: ${this.navigationStack.length}`);
        return true;
    }

    // Navigate to an arbitrary node ID, rebuilding the stack if needed
    async navigateToNode(targetNodeId) {
        // Check if already there
        if (this.currentNode.id === targetNodeId) return true;

        // Check if it's on the current stack
        const indexOnStack = this.navigationStack.findIndex(item => item.nodeId === targetNodeId);
        if (indexOnStack !== -1) {
            return this.navigateToIndex(indexOnStack);
        }

        // Not on stack, need to find path from root
        const pathIds = this.findPathToNode(targetNodeId); // ['root', 'child1', 'targetNodeId']
        if (!pathIds) {
            OPTIMISM_UTILS.logError(`Cannot navigate: Path to node ${targetNodeId} not found.`);
            return false;
        }

        // Rebuild stack
        const newStack = [];
        let current = this.data; // Start from root data object
        newStack.push({ nodeId: 'root', nodeTitle: 'Home', node: current });

        for (let i = 1; i < pathIds.length; i++) { // Start from 1 (skip root ID)
            const nodeId = pathIds[i];
            const parent = current;
            current = parent.children ? parent.children[nodeId] : null;
            if (!current) {
                OPTIMISM_UTILS.logError(`Navigation path broken at ${nodeId}, child of ${parent.id}`);
                return false; // Path invalid
            }
            newStack.push({ nodeId: nodeId, nodeTitle: current.title || 'Untitled', node: current });
        }

        this.navigationStack = newStack;
        this.currentNode = current;
        this.selectedElement = null;
        this.updateUrlHash();
        OPTIMISM_UTILS.log(`Navigated via path reconstruction to ${targetNodeId}. Stack depth: ${this.navigationStack.length}`);
        return true;
    }

    // Helper to find the sequence of node IDs from root to target
    findPathToNode(targetNodeId) {
         if (targetNodeId === 'root') return ['root'];
         const path = ['root']; // Start with root
         if (this._findPathRecursive(this.data, targetNodeId, path)) {
             return path;
         }
         return null; // Not found
    }

    _findPathRecursive(currentNode, targetNodeId, currentPath) {
        if (currentNode.id === targetNodeId) return true; // Found target (shouldn't happen here usually)

        if (currentNode.children) {
            for (const childId in currentNode.children) {
                if (childId === targetNodeId) { // Direct child found
                     currentPath.push(childId);
                     return true;
                }
                // Recurse
                currentPath.push(childId);
                if (this._findPathRecursive(currentNode.children[childId], targetNodeId, currentPath)) {
                    return true; // Found in sub-branch
                }
                currentPath.pop(); // Backtrack if not found
            }
        }
        return false; // Not in this branch
    }

     // Find path to the PARENT of an element (for direct nav/bookmark)
     findNavigationPathToParent(targetElementId) {
        const path = ['root']; // Start with root
        if (this._findElementPathRecursive(this.data, targetElementId, path)) {
            return path; // Returns the path ending with the PARENT node ID
        }
        return null; // Element not found anywhere
    }

    // Recursive helper for findNavigationPathToParent
    _findElementPathRecursive(currentNode, targetElementId, currentPath) {
        // Check elements in the current node
        if (currentNode.elements?.some(el => el.id === targetElementId)) {
            // Found the element! Path already holds the parent path.
            return true;
        }
        // Check children nodes
        if (currentNode.children) {
            for (const childId in currentNode.children) {
                currentPath.push(childId); // Add child to path tentatively
                if (this._findElementPathRecursive(currentNode.children[childId], targetElementId, currentPath)) {
                    return true; // Found it down this branch
                }
                currentPath.pop(); // Backtrack if not found in this branch
            }
        }
        return false; // Not found in this subtree
    }

    // Direct navigation into an element (used for bookmarks)
    async navigateToElementDirectly(elementId) {
        OPTIMISM_UTILS.log(`Attempting direct navigation into element: ${elementId}`);
        const parentPathIds = this.findNavigationPathToParent(elementId);
        if (!parentPathIds) {
            OPTIMISM_UTILS.logError(`Could not find path to parent of element ${elementId}`);
            return false;
        }

        // Rebuild stack up to the parent node
        const parentStack = [];
        let currentNodeData = this.data;
        for (const nodeId of parentPathIds) {
            if (!currentNodeData) {
                 OPTIMISM_UTILS.logError(`Navigation path broken while building stack for direct nav at ${nodeId}.`);
                 return false;
            }
            parentStack.push({ nodeId: nodeId, nodeTitle: currentNodeData.title || (nodeId === 'root' ? 'Home' : 'Untitled'), node: currentNodeData });
            if (nodeId !== parentPathIds[parentPathIds.length - 1]) { // If not the last parent ID
                 const nextNodeId = parentPathIds[parentPathIds.indexOf(nodeId) + 1];
                 currentNodeData = currentNodeData.children ? currentNodeData.children[nextNodeId] : null;
            }
        }
        const parentNode = parentStack[parentStack.length - 1].node;

        // Now, perform the standard navigateToElement logic from the found parent
        this.currentNode = parentNode; // Temporarily set current node to parent
        this.navigationStack = parentStack; // Set stack to parent path
        const success = await this.navigateToElement(elementId); // This will push the final element onto the stack

        if (!success) {
             OPTIMISM_UTILS.logError(`Direct navigation failed during final step for ${elementId}`);
             // Attempt to restore previous state? Or navigate to parent?
             await this.navigateToNode(parentNode.id); // Go back to parent
             return false;
        }

        OPTIMISM_UTILS.log(`Direct navigation successful to element ${elementId}.`);
        return true;
    }


    // --- URL Hash Management ---
    updateUrlHash() {
        if (this.navigationStack.length === 0) return;
        const currentNodeId = this.navigationStack[this.navigationStack.length - 1].nodeId;
        const hash = this._generateUrlHash(currentNodeId);
        // Use replaceState to avoid polluting browser history during internal navigation
        if (window.location.hash !== hash) {
            window.history.replaceState({ nodeId: currentNodeId }, '', hash);
             // OPTIMISM_UTILS.log(`URL Hash updated to: ${hash}`);
        }
    }

    _generateUrlHash(nodeId) {
        if (nodeId === 'root') return '#';
        const node = this.findNodeById(nodeId); // Node whose *content* is being viewed
        const parentNode = this.findParentNode(nodeId); // Parent node containing the element that *leads* to this node
        if (!node || !parentNode) return '#'; // Should not happen normally

        let slug = 'untitled';
        const element = parentNode.elements?.find(el => el.id === nodeId); // Find the element in the parent
        if (element) {
             if (element.type === 'text') slug = OPTIMISM_UTILS.generateSlug(element.text);
             else if (element.type === 'image') slug = 'image';
        } else {
             slug = OPTIMISM_UTILS.generateSlug(node.title); // Fallback to node title if element not found
        }

        const idPart = nodeId.substring(0, 6);
        return `#${slug}-${idPart}`;
    }

    async navigateToNodeByHash(hash) {
        if (!hash || hash === '#') return this.navigateToNode('root');

        const hashContent = hash.substring(1);
        const parts = hashContent.split('-');
        if (parts.length < 2) return this.navigateToNode('root'); // Invalid format

        const idPrefix = parts[parts.length - 1];
        const slugPart = parts.slice(0, -1).join('-');

        // Crude search for matching ID prefix (can be slow on large dbs)
        // This needs optimization if performance becomes an issue.
        const potentialMatches = this._findAllNodesWithIdPrefix(this.data, idPrefix, []);

        if (potentialMatches.length === 0) {
            OPTIMISM_UTILS.logError(`No node found matching hash ID prefix: ${idPrefix}`);
            return this.navigateToNode('root'); // Fallback to root
        }

        if (potentialMatches.length === 1) {
            return this.navigateToNode(potentialMatches[0].id); // Navigate to the single match
        }

        // Multiple matches, use slug to disambiguate
        for (const node of potentialMatches) {
            const parent = this.findParentNode(node.id);
            const element = parent?.elements?.find(el => el.id === node.id);
            let generatedSlug = 'untitled';
            if (element) {
                 if (element.type === 'text') generatedSlug = OPTIMISM_UTILS.generateSlug(element.text);
                 else if (element.type === 'image') generatedSlug = 'image';
            } else {
                 generatedSlug = OPTIMISM_UTILS.generateSlug(node.title);
            }

            if (generatedSlug === slugPart) {
                return this.navigateToNode(node.id); // Found specific match
            }
        }

        // If slug didn't help, navigate to the first match found
        OPTIMISM_UTILS.log(`Multiple nodes matched prefix ${idPrefix}, navigating to the first: ${potentialMatches[0].id}`);
        return this.navigateToNode(potentialMatches[0].id);
    }

    _findAllNodesWithIdPrefix(currentNode, prefix, results) {
        if (currentNode.id && currentNode.id !== 'appState' && currentNode.id !== 'theme' && currentNode.id.startsWith(prefix)) {
            results.push(currentNode);
        }
        if (currentNode.children) {
            for (const childId in currentNode.children) {
                this._findAllNodesWithIdPrefix(currentNode.children[childId], prefix, results);
            }
        }
        return results;
    }


    // --- Undo/Redo ---

    async execute(command) {
        try {
            //OPTIMISM_UTILS.log(`Executing ${command.constructor.name}`);
            const result = await command.execute();

            this.undoStack.push(command);
            this.redoStack = []; // Clear redo on new action
            if (this.undoStack.length > this.maxHistorySize) {
                this.undoStack.shift(); // Limit history size
            }

            const showBackupReminder = this.incrementEditCounter(); // Handles counter, cleanup, state saving
            return { result, showBackupReminder };

        } catch (error) {
            OPTIMISM_UTILS.logError(`Error executing command ${command?.constructor?.name}:`, error);
            // Optionally try to undo the failed command partially? Risky.
            throw error; // Re-throw so controller/UI can potentially react
        }
    }

    async undo() {
        if (!this.canUndo()) return false;
        const command = this.undoStack.pop();
        try {
            OPTIMISM_UTILS.log(`Undoing ${command.constructor.name}`);
            await command.undo();
            this.redoStack.push(command);
             if (this.redoStack.length > this.maxHistorySize) {
                 this.redoStack.shift();
             }
             // Note: Undoing does NOT increment edit counter
             await this.loadData(); // Reload data fully to reflect undone state
             OPTIMISM_UTILS.log('Undo successful, data reloaded.');
            return true;
        } catch (error) {
            OPTIMISM_UTILS.logError(`Error during undo for ${command.constructor.name}:`, error);
            // Put command back on stack? Or discard? Discarding is safer.
            this.redoStack.pop(); // Remove from redo if undo failed halfway
            return false;
        }
    }

    async redo() {
        if (!this.canRedo()) return false;
        const command = this.redoStack.pop();
        try {
             OPTIMISM_UTILS.log(`Redoing ${command.constructor.name}`);
             // Re-execute the command
             await command.execute(); // Assumes execute is safe to re-run
             this.undoStack.push(command); // Add back to undo stack
             // Note: Redoing increments the edit counter via the execute call chain
             OPTIMISM_UTILS.log('Redo successful.');
             // No full reload needed here as execute modified the current state
             return true;
        } catch (error) {
             OPTIMISM_UTILS.logError(`Error during redo for ${command.constructor.name}:`, error);
             // Put command back on redo stack? Discard is safer.
             return false;
        }
    }

    canUndo() { return this.undoStack.length > 0; }
    canRedo() { return this.redoStack.length > 0; }

    // --- Edit Counter & Backup ---
    incrementEditCounter() {
        this.editCounter++;
        const editsUntilBackup = this.backupReminderThreshold - (this.editCounter - this.lastBackupReminder);
        //OPTIMISM_UTILS.log(`Edit #${this.editCounter} (${editsUntilBackup} until backup)`);

        if (this.deletedImageQueue.length > 0) {
            this.cleanupDeletedImages(); // Run cleanup async
        }
        if (this.quickLinks.length > 0) {
             this.cleanupExpiredQuickLinks(); // Run cleanup async
        }

        this.saveAppState(); // Save state after incrementing

        return this.editCounter - this.lastBackupReminder >= this.backupReminderThreshold;
    }

    resetBackupReminder() {
        this.lastBackupReminder = this.editCounter;
        OPTIMISM_UTILS.log(`Reset backup reminder (next around edit #${this.editCounter + this.backupReminderThreshold})`);
        this.saveAppState();
    }

    // --- Image Management ---
    async saveImageData(imageId, imageData) {
        try {
            await this.db.saveImage(imageId, imageData);
        } catch (error) {
            OPTIMISM_UTILS.logError(`Error saving image data ${imageId}:`, error);
            throw error; // Propagate
        }
    }
    async getImageData(imageId) {
        try {
            return await this.db.getImage(imageId);
        } catch (error) {
            OPTIMISM_UTILS.logError(`Error getting image data ${imageId}:`, error);
            return null; // Return null on error
        }
    }
    async deleteImageData(imageId) {
         try {
             await this.db.deleteImage(imageId);
         } catch (error) {
             OPTIMISM_UTILS.logError(`Error deleting image data ${imageId}:`, error);
             // Don't throw, just log
         }
    }

    // Finds all image IDs within a node structure
    findAllImageIdsRecursive(nodeData) {
        let imageIds = [];
        if (!nodeData) return imageIds;
        if (nodeData.elements) {
            nodeData.elements.forEach(el => {
                if (el?.type === 'image' && el.imageDataId) {
                    imageIds.push(el.imageDataId);
                }
            });
        }
        if (nodeData.children) {
            for (const childId in nodeData.children) {
                imageIds = imageIds.concat(this.findAllImageIdsRecursive(nodeData.children[childId]));
            }
        }
        return [...new Set(imageIds)]; // Return unique IDs
    }

    // Queues image IDs for deletion after a delay
    queueImagesForDeletion(imageIds) {
         if (!imageIds || imageIds.length === 0) return;
         const uniqueImageIds = [...new Set(imageIds)]; // Ensure unique
         const deleteAtCounter = this.editCounter + 10; // Configurable delay?
         OPTIMISM_UTILS.log(`Queueing ${uniqueImageIds.length} image(s) for deletion at edit #${deleteAtCounter}`);
         uniqueImageIds.forEach(imageId => {
              // Avoid adding duplicates to the queue
              if (!this.deletedImageQueue.some(item => item.imageId === imageId)) {
                  this.deletedImageQueue.push({ imageId, deleteAtCounter });
              }
         });
         // No need to save app state here, deleteElement/incrementEditCounter will do it
    }

    // Removes images from the deletion queue (used by undo)
    dequeueImagesForDeletion(imageIdsToDequeue) {
        if (!imageIdsToDequeue || imageIdsToDequeue.length === 0) return;
        const initialQueueLength = this.deletedImageQueue.length;
        this.deletedImageQueue = this.deletedImageQueue.filter(
             item => !imageIdsToDequeue.includes(item.imageId)
        );
        const removedCount = initialQueueLength - this.deletedImageQueue.length;
        if (removedCount > 0) {
             OPTIMISM_UTILS.log(`Dequeued ${removedCount} restored image(s) from deletion.`);
             // Need to save state if called outside normal flow
             // this.saveAppState(); // Caller should save state
        }
    }


    // Deletes images from DB whose deletion counter is met
    async cleanupDeletedImages() {
        const imagesToDeleteNow = this.deletedImageQueue.filter(item => this.editCounter >= item.deleteAtCounter);
        if (imagesToDeleteNow.length === 0) return;

        OPTIMISM_UTILS.log(`Cleaning up ${imagesToDeleteNow.length} old deleted images (Edit Counter: ${this.editCounter})`);
        this.deletedImageQueue = this.deletedImageQueue.filter(item => this.editCounter < item.deleteAtCounter);

        // Save the updated queue immediately *before* DB deletion attempts
        await this.saveAppState();

        // Delete from DB
        for (const item of imagesToDeleteNow) {
            try {
                await this.deleteImageData(item.imageId);
                // OPTIMISM_UTILS.log(`Deleted old image data: ${item.imageId}`);
            } catch (error) {
                // Logged in deleteImageData
            }
        }
         OPTIMISM_UTILS.log(`Image cleanup complete. ${this.deletedImageQueue.length} items remain in queue.`);
    }

    // Deep copy element data, generating new IDs and collecting image mappings
    async deepCopyElementData(originalElementId, sourceNode, newParentId) {
        const originalElement = sourceNode.elements?.find(el => el.id === originalElementId);
        if (!originalElement) return null;

        const originalChildNodeData = sourceNode.children ? sourceNode.children[originalElementId] : null;
        const imageIdMap = new Map(); // Map<originalImageDataId, newImageDataId>

        // Create new element structure
        const newElement = { ...structuredClone(originalElement), id: crypto.randomUUID() };
        if (newElement.type === 'image' && newElement.imageDataId) {
            const newImageDataId = crypto.randomUUID();
            imageIdMap.set(newElement.imageDataId, newImageDataId);
            newElement.imageDataId = newImageDataId;
        }
        // Reset position? Optional. Keep original relative position for now.
        // newElement.x = 20; newElement.y = 20;

        let newChildNodeData = null;
        if (originalChildNodeData) {
            newChildNodeData = {
                ...structuredClone(originalChildNodeData),
                id: newElement.id, // Match new element ID
                parentId: newParentId,
                elements: [],
                children: {}
            };
            if (originalChildNodeData.elements) {
                for (const elem of originalChildNodeData.elements) {
                    const nestedCopyResult = await this.deepCopyElementData(elem.id, originalChildNodeData, newChildNodeData.id);
                    if (nestedCopyResult) {
                        newChildNodeData.elements.push(nestedCopyResult.newElement);
                        if (nestedCopyResult.newChildNodeData) {
                            newChildNodeData.children[nestedCopyResult.newElement.id] = nestedCopyResult.newChildNodeData;
                        }
                        nestedCopyResult.imageIdMap.forEach((newId, oldId) => imageIdMap.set(oldId, newId));
                    }
                }
            }
        }
        return { newElement, newChildNodeData, imageIdMap };
    }

    // Duplicate image data based on the map created by deepCopyElementData
    async duplicateImageDataBatch(imageIdMap) {
        if (imageIdMap.size === 0) return;
        OPTIMISM_UTILS.log(`Duplicating image data for ${imageIdMap.size} images.`);
        const promises = [];
        for (const [originalId, newId] of imageIdMap.entries()) {
            promises.push(
                this.getImageData(originalId).then(imageData => {
                    if (imageData) return this.saveImageData(newId, imageData);
                    else OPTIMISM_UTILS.logError(`Original image data not found for ID: ${originalId} during duplication.`);
                }).catch(error => {
                     OPTIMISM_UTILS.logError(`Error duplicating image data from ${originalId} to ${newId}:`, error);
                })
            );
        }
        await Promise.all(promises);
        OPTIMISM_UTILS.log(`Finished duplicating image data.`);
    }

     // --- Move Operations (using deep copy) ---

     // Moves element within the same parent node, nesting it under targetElementId
     async moveElement(sourceElementId, targetElementId, parentNodeId = this.currentNode?.id) {
         OPTIMISM_UTILS.log(`Attempting move: ${sourceElementId} -> ${targetElementId} in node ${parentNodeId}`);
         const parentNode = this.findNodeById(parentNodeId);
         if (!parentNode) return false;

         const targetElement = parentNode.elements?.find(el => el.id === targetElementId);
         if (!targetElement) {
              OPTIMISM_UTILS.logError(`Target element ${targetElementId} not found for move.`);
              return false;
         }

         // Ensure target node exists or create it
         if (!parentNode.children) parentNode.children = {};
         if (!parentNode.children[targetElementId]) {
             let nodeTitle = targetElement.type === 'text' ? (targetElement.text?.substring(0, 60) || 'Untitled') : 'Image';
             parentNode.children[targetElementId] = {
                 id: targetElementId, parentId: parentNode.id, title: nodeTitle, elements: [], children: {}
             };
         }
         const targetNode = parentNode.children[targetElementId];

         // Perform deep copy (generates new IDs)
         const copyResult = await this.deepCopyElementData(sourceElementId, parentNode, targetNode.id);
         if (!copyResult) return false; // Error logged in deepCopy

         const { newElement, newChildNodeData, imageIdMap } = copyResult;

         // Add the new element to the target node
         if (!targetNode.elements) targetNode.elements = [];
         targetNode.elements.push(newElement);
         if (newChildNodeData) {
             if (!targetNode.children) targetNode.children = {};
             targetNode.children[newElement.id] = newChildNodeData;
         }

         // Duplicate image data
         if (imageIdMap.size > 0) await this.duplicateImageDataBatch(imageIdMap);

         // Save data *before* deleting the original
         await this.saveData();

         // Delete the ORIGINAL element (triggers image queuing etc.)
         OPTIMISM_UTILS.log(`Deleting original element ${sourceElementId} after successful move/copy.`);
         const deleteSuccess = await this.deleteElement(sourceElementId, parentNodeId);
         if (!deleteSuccess) {
             OPTIMISM_UTILS.logError(`Failed to delete original element ${sourceElementId} after move. Data might be inconsistent.`);
             // TODO: Consider rollback strategy? Complex.
         }

         return { success: true, newElementId: newElement.id }; // Return new ID for undo command
     }

     // Moves element from sourceNode to targetNode (usually a breadcrumb node)
     async moveElementToBreadcrumb(sourceElementId, navIndex, sourceNodeId = this.currentNode?.id) {
         const sourceNode = this.findNodeById(sourceNodeId);
         const targetNode = this.navigationStack[navIndex]?.node;
         if (!sourceNode || !targetNode) {
              OPTIMISM_UTILS.logError(`Invalid source or target node for breadcrumb move.`);
              return false;
         }
         if (sourceNode.id === targetNode.id) {
              OPTIMISM_UTILS.log(`Cannot move element to its own parent node via breadcrumb.`);
              return false; // Avoid moving to same node
         }

         OPTIMISM_UTILS.log(`Attempting breadcrumb move: ${sourceElementId} (from ${sourceNodeId}) -> ${targetNode.id}`);

         // Perform deep copy into the target node
         const copyResult = await this.deepCopyElementData(sourceElementId, sourceNode, targetNode.id);
         if (!copyResult) return false;

         const { newElement, newChildNodeData, imageIdMap } = copyResult;

         // Add the new element to the target node
         if (!targetNode.elements) targetNode.elements = [];
         targetNode.elements.push(newElement);
         if (newChildNodeData) {
             if (!targetNode.children) targetNode.children = {};
             targetNode.children[newElement.id] = newChildNodeData;
         }

         // Duplicate image data
         if (imageIdMap.size > 0) await this.duplicateImageDataBatch(imageIdMap);

         // Save data *before* deleting the original
         await this.saveData();

         // Delete the ORIGINAL element from the source node
         OPTIMISM_UTILS.log(`Deleting original element ${sourceElementId} after successful move/copy to breadcrumb node ${targetNode.id}.`);
         const deleteSuccess = await this.deleteElement(sourceElementId, sourceNodeId);
         if (!deleteSuccess) {
              OPTIMISM_UTILS.logError(`Failed to delete original element ${sourceElementId} after breadcrumb move. Data might be inconsistent.`);
         }

         return { success: true, newElementId: newElement.id }; // Return new ID for undo
     }


     // --- Quick Links ---
     async addQuickLink(nodeId, nodeTitle) {
         if (this.quickLinks.some(link => link.nodeId === nodeId)) return false; // Already exists
         if (this.quickLinks.length >= 5) { // Increased limit to 5
             this.quickLinks.shift(); // Remove oldest
         }
         const newLink = { nodeId, nodeTitle, expiresAt: this.editCounter + this.quickLinkExpiryCount };
         this.quickLinks.push(newLink);
         OPTIMISM_UTILS.log(`Added quick link: ${nodeTitle} (${nodeId})`);
         await this.saveAppState();
         return true;
     }
     async removeQuickLink(nodeId) {
         const initialLength = this.quickLinks.length;
         this.quickLinks = this.quickLinks.filter(link => link.nodeId !== nodeId);
         if (initialLength !== this.quickLinks.length) {
             OPTIMISM_UTILS.log(`Removed quick link for node ${nodeId}`);
             await this.saveAppState();
             return true;
         }
         return false;
     }
     async cleanupExpiredQuickLinks() {
         const initialLength = this.quickLinks.length;
         this.quickLinks = this.quickLinks.filter(link => link.expiresAt > this.editCounter);
         if (initialLength !== this.quickLinks.length) {
             OPTIMISM_UTILS.log(`Removed ${initialLength - this.quickLinks.length} expired quick link(s)`);
             await this.saveAppState(); // Save if changed
         }
     }
     async refreshQuickLinkExpiry(nodeId) {
        const link = this.quickLinks.find(link => link.nodeId === nodeId);
        if (link) {
            link.expiresAt = this.editCounter + this.quickLinkExpiryCount;
            OPTIMISM_UTILS.log(`Refreshed quick link expiry for ${nodeId}`);
            await this.saveAppState();
            return true;
        }
        return false;
    }

    // --- Locking ---
    isCardLocked(cardId) { return this.lockedCards.includes(cardId); }
    async toggleCardLock(cardId) {
        const index = this.lockedCards.indexOf(cardId);
        if (index > -1) { this.lockedCards.splice(index, 1); } // Unlock
        else { this.lockedCards.push(cardId); } // Lock
        OPTIMISM_UTILS.log(`Card ${cardId} lock toggled to: ${this.isCardLocked(cardId)}`);
        await this.saveAppState();
        return this.isCardLocked(cardId);
    }
    async toggleImagesLocked() {
        this.imagesLocked = !this.imagesLocked;
        OPTIMISM_UTILS.log(`Images locked toggled to: ${this.imagesLocked}`);
        await this.saveAppState();
        return this.imagesLocked;
    }

    // --- Title Updates ---
    async updateNavigationTitles(elementId, newText) {
         // Update title in the direct child node if it exists
         const parentNode = this.currentNode; // Assume element is in current node
         let updated = false;
         if (parentNode.children && parentNode.children[elementId]) {
             const childNode = parentNode.children[elementId];
             const newTitle = newText ? (String(newText).trim() === "" ? "Untitled" : String(newText).substring(0, 60)) : "Untitled";
             if (childNode.title !== newTitle) {
                  childNode.title = newTitle;
                  OPTIMISM_UTILS.log(`Updated child node title for ${elementId} to "${newTitle}"`);
                  updated = true;
             }
         }
         // Update title in the navigation stack if this element ID is a node ID in the stack
         for (const navItem of this.navigationStack) {
             if (navItem.nodeId === elementId) {
                  const newTitle = newText ? (String(newText).trim() === "" ? "Untitled" : String(newText).substring(0, 60)) : "Untitled";
                  if (navItem.nodeTitle !== newTitle) {
                      navItem.nodeTitle = newTitle;
                      OPTIMISM_UTILS.log(`Updated navigation stack title for ${elementId} to "${newTitle}"`);
                      // Note: We don't necessarily need to save data here, stack is in memory.
                      // But if the node title itself needs saving, 'updated' flag handles it.
                  }
             }
         }
         if (updated) await this.saveData();
         return updated;
    }


    // --- Inbox ---
    async addToInbox(element, childNodeData = null) {
         OPTIMISM_UTILS.log(`Adding element ${element.id} to inbox.`);
         const inboxCard = {
             ...structuredClone(element), // Deep clone element data
             id: crypto.randomUUID(), // New unique ID for the inbox card
             originalId: element.id, // Reference original (optional)
             addedToInboxAt: new Date().toISOString(),
             nestedData: childNodeData ? structuredClone(childNodeData) : null // Deep clone nested data
         };
         this.inboxCards.unshift(inboxCard); // Add to start
         await this.saveAppState();
         return inboxCard;
    }
    async removeFromInbox(cardId) {
         const initialLength = this.inboxCards.length;
         this.inboxCards = this.inboxCards.filter(card => card.id !== cardId);
         if (initialLength !== this.inboxCards.length) {
             OPTIMISM_UTILS.log(`Removed card ${cardId} from inbox.`);
             await this.saveAppState();
             return true;
         }
         return false;
    }
    async updateInboxCard(id, properties) {
        const card = this.inboxCards.find(card => card.id === id);
        if (card) {
            Object.assign(card, properties);
            // Handle deletion if text becomes empty
            if (card.type === 'text' && properties.text !== undefined && String(properties.text).trim() === '') {
                 OPTIMISM_UTILS.log(`Inbox card ${id} text empty, deleting.`);
                 await this.removeFromInbox(id);
                 return null;
            }
            await this.saveAppState();
            return card;
        }
        return null;
    }
     async addBlankCardToInbox() {
        const blankCard = {
            id: crypto.randomUUID(), type: 'text', text: '',
            addedToInboxAt: new Date().toISOString(), style: { textSize: 'small', textColor: 'default' }
        };
        this.inboxCards.unshift(blankCard);
        OPTIMISM_UTILS.log(`Added blank card to inbox: ${blankCard.id}`);
        await this.saveAppState();
        return blankCard;
    }
    async moveFromInboxToCanvas(cardId, x, y) {
        const cardIndex = this.inboxCards.findIndex(card => card.id === cardId);
        if (cardIndex === -1) return null;
        const card = this.inboxCards[cardIndex];

        // Create new element data for canvas
        const newElement = {
            id: crypto.randomUUID(),
            type: card.type, x, y,
            width: card.width || 200, height: card.height || 100,
            style: card.style || { textSize: 'small', textColor: 'default' }, // Copy style
            // Copy other relevant props based on type
            ...(card.type === 'text' && { text: card.text || '' }),
            ...(card.type === 'image' && {
                 imageDataId: card.imageDataId,
                 storageWidth: card.storageWidth,
                 storageHeight: card.storageHeight,
                 zIndex: card.zIndex // Copy zIndex if present
            })
        };

        // Restore nested data if present
        let newChildNodeData = null;
        if (card.nestedData) {
            newChildNodeData = structuredClone(card.nestedData);
            newChildNodeData.id = newElement.id; // Match new element ID
            newChildNodeData.parentId = this.currentNode.id; // Set parent
        }

        // Add to current canvas node
        if (!this.currentNode.elements) this.currentNode.elements = [];
        this.currentNode.elements.push(newElement);
        if (newChildNodeData) {
            if (!this.currentNode.children) this.currentNode.children = {};
            this.currentNode.children[newElement.id] = newChildNodeData;
        }

        // Remove from inbox
        this.inboxCards.splice(cardIndex, 1);

        // Save both main data and app state (inbox changes)
        await this.saveData();
        await this.saveAppState();

        OPTIMISM_UTILS.log(`Moved inbox card ${cardId} to canvas element ${newElement.id}${newChildNodeData ? ' (with nested data)' : ''}`);
        return newElement.id; // Return ID of element created on canvas
    }

    // --- Priorities ---
    isCardPriority(cardId) { return this.priorityCards.includes(cardId); }
    async toggleCardPriority(cardId) {
        const index = this.priorityCards.indexOf(cardId);
        if (index > -1) { this.priorityCards.splice(index, 1); } // Remove
        else { this.priorityCards.push(cardId); } // Add
        OPTIMISM_UTILS.log(`Card ${cardId} priority toggled to: ${this.isCardPriority(cardId)}`);
        await this.saveAppState();
        return this.isCardPriority(cardId);
    }

    // --- Grid ---
    async setGridLayout(layout) { // layout like "1x2"
        if (this.gridLayout !== layout) {
            this.gridLayout = layout;
            OPTIMISM_UTILS.log(`Grid layout set to: ${this.gridLayout}`);
            await this.saveAppState();
        }
    }

    // --- Panel Management ---
    // async togglePanel(panelName) {
    //     if (!Object.hasOwnProperty.call(this.panels, panelName)) return false;
    //
    //     const currentState = this.panels[panelName];
    //     const newState = !currentState;
    //
    //     // Close conflicting panels
    //     const isLeft = panelName === 'inbox' || panelName === 'priorities';
    //     const isRight = panelName === 'settings' || panelName === 'style' || panelName === 'grid';
    //
    //     for (const pName in this.panels) {
    //          const pIsLeft = pName === 'inbox' || pName === 'priorities';
    //          const pIsRight = pName === 'settings' || pName === 'style' || pName === 'grid';
    //          // Close if: opening a new panel AND (it's not the one being opened AND it's on the same side)
    //          // OR if opening Arena (which closes all side panels)
    //          if (newState && pName !== panelName && ((isLeft && pIsLeft) || (isRight && pIsRight) || panelName === 'arena')) {
    //              this.panels[pName] = false;
    //          }
    //          // Special case: opening a side panel closes Arena
    //          if (newState && (isLeft || isRight) && panelName !== 'arena') {
    //               this.panels.arena = false;
    //          }
    //     }
    //
    //     // Toggle the requested panel
    //     this.panels[panelName] = newState;
    //     OPTIMISM_UTILS.log(`Panel '${panelName}' visibility toggled to: ${newState}`);
    //
    //     await this.saveAppState();
    //     return newState;
    // }

     // --- NEW: Centralized Panel State Logic ---

     // Sets a specific panel's state, handling exclusivity
     _setPanelState(panelNameToSet, isVisible) {
         if (!Object.hasOwnProperty.call(this.panels, panelNameToSet)) return false;

         // If setting to visible
         if (isVisible) {
             // Determine if the panel being opened is left/right/arena/style
             const isLeft = panelNameToSet === 'inbox' || panelNameToSet === 'priorities';
             const isRight = panelNameToSet === 'settings' || panelNameToSet === 'grid'; // Style panel handled specially
             const isSidePanel = isLeft || isRight;

             // Close conflicting panels based on rules
             for (const pName in this.panels) {
                 if (pName === panelNameToSet) continue; // Don't close self

                 const pIsLeft = pName === 'inbox' || pName === 'priorities';
                 const pIsRight = pName === 'settings' || pName === 'grid';

                 // Rule 1: Opening Arena closes all side panels
                 if (panelNameToSet === 'arena' && (pIsLeft || pIsRight)) {
                     this.panels[pName] = false;
                 }
                 // Rule 2: Opening a Left panel closes other Left panels & Arena
                 else if (isLeft && (pIsLeft || pName === 'arena')) {
                     this.panels[pName] = false;
                 }
                 // Rule 3: Opening a Right panel closes other Right panels & Arena
                 else if (isRight && (pIsRight || pName === 'arena')) {
                      this.panels[pName] = false;
                 }
                 // Rule 4: Opening Style panel closes Settings & Grid (Right panels) & Arena
                 else if (panelNameToSet === 'style' && (pIsRight || pName === 'arena')) {
                       this.panels[pName] = false;
                 }
                 // Rule 5: Opening Settings/Grid closes Style panel
                 else if (isRight && pName === 'style') {
                       this.panels[pName] = false;
                 }
             }
         }
         // Else (setting to invisible): No automatic closing of others needed

         // Set the state for the target panel
         this.panels[panelNameToSet] = isVisible;
         OPTIMISM_UTILS.log(`Model: Panel state updated - ${panelNameToSet}: ${isVisible}`);
         return true; // Indicate state potentially changed
     }


     // --- Other Toggles ---
     toggleDebugPanel() {
         // ... (debug logic remains the same) ...
         this.isDebugVisible = !this.isDebugVisible; // Assuming this was the original logic
         // No need to save state for debug panel visibility
         return this.isDebugVisible;
     }
     async toggleNestingDisabled() {
         console.error(`%%%%% Model.toggleNestingDisabled CALLED! Current state: ${this.isNestingDisabled} %%%%%`); // Log entry and current state
         this.isNestingDisabled = !this.isNestingDisabled;
         console.error(`%%%%% Model.toggleNestingDisabled: NEW state: ${this.isNestingDisabled} %%%%%`); // Log the new state
         OPTIMISM_UTILS.log(`Nesting disabled toggled to: ${this.isNestingDisabled}`);
         try {
             await this.saveAppState(); // Ensure state is saved
              console.error(`%%%%% Model.toggleNestingDisabled: saveAppState finished. %%%%%`);
         } catch(error) {
              console.error(`%%%%% Model.toggleNestingDisabled: ERROR saving app state: ${error} %%%%%`);
         }
         return this.isNestingDisabled;
     }
     async toggleArenaView() { return this.togglePanel('arena'); }
    // Replace simple togglePanel calls with more controlled logic
     // async toggleSettingsVisibility() { return this.togglePanel('settings'); }
     async toggleInboxVisibility() { return this.togglePanel('inbox'); }
     async toggleGridVisibility() { return this.togglePanel('grid'); }
     async togglePrioritiesVisibility() { return this.togglePanel('priorities'); }
     // async toggleStyleVisibility() - Style panel is usually shown contextually, not toggled directly by user button

     // Revised togglePanel using new logic
     async togglePanel(panelName) {
         if (!Object.hasOwnProperty.call(this.panels, panelName)) return false;
         const currentState = this.panels[panelName];
         const success = this._setPanelState(panelName, !currentState);
         if (success) await this.saveAppState();
         return this.panels[panelName]; // Return the new state
     }

      // Method to explicitly show a panel (e.g., style panel on element select)
      async showPanel(panelName) {
           if (this._setPanelState(panelName, true)) await this.saveAppState();
           return this.panels[panelName];
      }

} // End CanvasModel Class
