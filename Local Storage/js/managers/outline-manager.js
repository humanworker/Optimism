// --- START OF FILE js/managers/outline-manager.js ---

import { OPTIMISM_UTILS } from '../utils.js';

export class OutlineManager {
    constructor(model, controller, view) {
        this.model = model;
        this.controller = controller;
        this.view = view;
        this.panelElement = null;
        this.toggleButton = null;
        this.containerElement = null;

        this.focusedItem = {
            elementId: null,
            path: [], // Path of node IDs to the focused element's parent node
            domElement: null
        };
        this.outlineItems = []; // The flat list of items for rendering
    }

    setup() {
        OPTIMISM_UTILS.log("OutlineManager: Setting up...");
        this.panelElement = document.getElementById('outliner-panel');
        this.toggleButton = document.getElementById('outliner-toggle');
        this.containerElement = this.panelElement?.querySelector('.outliner-container');

        if (!this.panelElement || !this.containerElement) {
            OPTIMISM_UTILS.logError("OutlineManager: Panel or container element not found.");
            return;
        }

        if (this.toggleButton) {
            this.toggleButton.style.display = 'inline-block';
            this.toggleButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.controller.toggleOutlinerPanel(); // Corrected method name
            });
        } else {
            OPTIMISM_UTILS.logError("OutlineManager: Toggle button (#outliner-toggle) not found.");
        }
        OPTIMISM_UTILS.log("OutlineManager: Setup complete.");
    }

    // Called when the outliner panel becomes visible or data changes significantly
    refreshOutline() {
        if (!this.model.panels.outliner || !this.containerElement) {
            // OPTIMISM_UTILS.log("OutlineManager: Refresh skipped, panel not visible or container missing.");
            return;
        }
        OPTIMISM_UTILS.log("OutlineManager: Refreshing outline...");

        this.outlineItems = this._buildOutlineDataStructure();
        this._determineInitialFocus(); // Determine focus based on current canvas view
        
        this.view.renderer.panel.renderOutlinerPanel(this.outlineItems, this.focusedItem.elementId);
        // Post-render, ensure the focused item is scrolled into view if needed (later refinement)
        this.ensureFocusedItemVisible(); 
    }

    _buildOutlineDataStructure() {
        const items = [];
        const GMaxLevel = 15; // Maximum indentation level to prevent infinite recursion or excessively deep outlines

        // Recursive helper function
        // parentPath is an array of node IDs leading to the current 'node'
        const processNode = (node, level, parentPath, parentIsCollapsed) => {
            if (!node || !node.elements || level > GMaxLevel) {
                return;
            }

            // Sort elements by outlineOrder, then perhaps by a creation timestamp or ID for stable sort
            const sortedElements = [...node.elements].sort((a, b) => {
                const orderA = a.outlineOrder !== undefined ? a.outlineOrder : Infinity; // Treat undefined as last
                const orderB = b.outlineOrder !== undefined ? b.outlineOrder : Infinity;
                if (orderA !== orderB) {
                    return orderA - orderB;
                }
                // Fallback sort if outlineOrder is same or undefined (e.g., by original index or an ID)
                // For now, this simple comparison should be okay if outlineOrder is consistently managed.
                // A more robust fallback might use element creation time or original array index.
                return 0; 
            });

            for (const element of sortedElements) {
                if (!element) continue;

                const isCollapsed = element.style?.outlineCollapsed || false;
                const hasModelChildren = this.model.hasChildren(element.id, node.id); // Check if element has a child *node* in the model

                items.push({
                    elementId: element.id,
                    parentId: node.id, // ID of the node this element belongs to
                    displayText: element.type === 'text' ? (element.text || '') : "Image",
                    type: element.type,
                    level: level,
                    isCollapsed: isCollapsed,
                    hasChildren: hasModelChildren, // True if it *can* have children shown in outline
                    // isCurrentlyFocused: false, // Will be set by focus logic
                    // isEditable: false, // For inline editing state
                    // editText: '',    // For inline editing buffer
                    parentPath: [...parentPath] // Path to the parent node of this element
                });

                // If this item has children in the model AND it's not collapsed AND its parent wasn't collapsed, process its children
                if (hasModelChildren && !isCollapsed && !parentIsCollapsed) {
                    const childNode = node.children?.[element.id];
                    if (childNode) {
                        processNode(childNode, level + 1, [...parentPath, element.id], false);
                    }
                }
            }
        };
        
        // Start processing from the root node
        // The root node itself doesn't have elements displayed directly, its elements are the top-level cards
        processNode(this.model.data, 0, [], false); 
        return items;
    }
    
    _determineInitialFocus() {
        if (this.outlineItems.length === 0) {
            this.focusedItem = { elementId: null, path: [], domElement: null };
            return;
        }

        // Logic based on I.3:
        // "When opening the panel when not on the root level, 
        //  the level the user is on will be expanded already 
        //  with the first card being the selected card."
        //  Correction: "first *child* of Card X in the outline (if Card X has children) will be focused. 
        //               If Card X has no children, Card X itself will be focused."

        const currentCanvasNodeId = this.model.currentNode.id;
        const currentCanvasNodeIsRoot = currentCanvasNodeId === 'root';

        if (currentCanvasNodeIsRoot) {
            // Focus the first item in the outline (first child of root)
            this.focusedItem.elementId = this.outlineItems[0].elementId;
            this.focusedItem.path = this.outlineItems[0].parentPath;
        } else {
            // Current canvas node is NOT root. It means we are "inside" an element.
            // This element `currentCanvasNodeId` should be represented in the outline.
            // We need to find the first child *element* of this `currentCanvasNodeId` in the outline.
            
            let foundFocusTarget = false;
            for (const item of this.outlineItems) {
                // Find the element that represents the current canvas view (it's a child of its parent in the outline)
                if (item.parentId === currentCanvasNodeId) { // This item is a direct child of the current canvas node
                    this.focusedItem.elementId = item.elementId;
                    this.focusedItem.path = item.parentPath;
                    foundFocusTarget = true;
                    break;
                }
            }

            if (!foundFocusTarget) {
                // If no direct children were found in the outline (e.g., current canvas node is empty or all its children are collapsed higher up)
                // then try to focus the element that LED to this current canvas view.
                const itemRepresentingCurrentNode = this.outlineItems.find(it => it.elementId === currentCanvasNodeId);
                if (itemRepresentingCurrentNode) {
                    this.focusedItem.elementId = itemRepresentingCurrentNode.elementId;
                    this.focusedItem.path = itemRepresentingCurrentNode.parentPath;
                } else {
                    // Fallback to the first item if the specific target isn't found (should be rare)
                    this.focusedItem.elementId = this.outlineItems[0]?.elementId || null;
                    this.focusedItem.path = this.outlineItems[0]?.parentPath || [];
                }
            }
        }
        OPTIMISM_UTILS.log("OutlineManager: Initial focus determined for elementId:", this.focusedItem.elementId);
    }

    ensureFocusedItemVisible() {
        if (this.focusedItem.domElement) {
            this.focusedItem.domElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    // --- Focus Management ---
    setFocusByElementId(elementId, domElement = null) { 
        this.focusedItem.elementId = elementId;
        const itemData = this.outlineItems.find(item => item.elementId === elementId);
        this.focusedItem.path = itemData ? itemData.parentPath : [];
        
        // Remove focus from previous
        if (this.focusedItem.domElement) {
            this.focusedItem.domElement.classList.remove('focused');
            // If inline editing was active, potentially save/cancel
        }
        
        // Set new focus
        if (domElement) {
            domElement.classList.add('focused');
            this.focusedItem.domElement = domElement;
            this.ensureFocusedItemVisible();
        } else {
            // If domElement not provided, find it in the panel (e.g., after a refresh)
            const newFocusedDom = this.containerElement.querySelector(`.outliner-item[data-element-id="${elementId}"]`);
            if (newFocusedDom) {
                newFocusedDom.classList.add('focused');
                this.focusedItem.domElement = newFocusedDom;
                this.ensureFocusedItemVisible();
            } else {
                this.focusedItem.domElement = null; // Not found in current render
            }
        }
        OPTIMISM_UTILS.log(`Outline focus set to: ${elementId}`);
    }

    moveFocusUp() { /* ... to be implemented ... */ }
    moveFocusDown() { /* ... to be implemented ... */ }

    // --- Editing ---
    startEditingFocusedItem() { /* ... to be implemented ... */ }
    saveEdit() { /* ... to be implemented ... */ }
    cancelEdit() { /* ... to be implemented ... */ }

    // --- Structural Changes ---
    createNewItem() { /* ... to be implemented ... */ }
    moveItemUp() { /* ... to be implemented ... */ }
    moveItemDown() { /* ... to be implemented ... */ }
    indentItem() { /* ... to be implemented ... */ }
    outdentItem() { /* ... to be implemented ... */ }
    toggleCollapseFocusedItem() { /* ... to be implemented ... */ }

}
// --- END OF FILE js/managers/outline-manager.js ---