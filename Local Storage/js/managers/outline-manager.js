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
            path: [], 
            domElement: null,
            index: -1 // Index in the flat outlineItems array
        };
        this.outlineItems = []; 
        this.isInlineEditing = false; // To track if an item is being edited
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
                this.controller.toggleOutlinerPanel();
            });
        } else {
            OPTIMISM_UTILS.logError("OutlineManager: Toggle button (#outliner-toggle) not found.");
        }

        // Listen for keyboard events when the panel is focused or has focus within
        // We'll make the container focusable and listen on it.
        this.containerElement.setAttribute('tabindex', '-1'); // Make it focusable
        this.containerElement.addEventListener('keydown', this._handleKeyDown.bind(this));

        // Allow clicking on items to focus them
        this.containerElement.addEventListener('click', this._handleClick.bind(this));


        OPTIMISM_UTILS.log("OutlineManager: Setup complete.");
    }
    
    // Called by PanelManager when panel visibility changes
    onPanelVisible() {
        if (this.model.panels.outliner && this.containerElement) {
            this.refreshOutline(); // Refresh content

            // Only try to focus the outliner container if no other input/textarea has focus.
            // This prevents stealing focus from a canvas textarea that just became active.
            setTimeout(() => {
                const activeEl = document.activeElement;
                if (!activeEl || (activeEl.tagName !== 'TEXTAREA' && activeEl.tagName !== 'INPUT')) {
                    this.containerElement.focus();
                    // If a specific item was focused, ensure it's still visually focused
                    if (this.focusedItem.elementId && !this.focusedItem.domElement) { // domElement might be null after refreshOutline
                        const domEl = this.containerElement.querySelector(`.outliner-item[data-element-id="${this.focusedItem.elementId}"]`);
                        if (domEl) this.setFocusByElementId(this.focusedItem.elementId, domEl, false);
                    } else if (this.focusedItem.domElement) { // If we still have a valid domElement reference
                        this.focusedItem.domElement.classList.add('focused'); 
                        this.ensureFocusedItemVisible();
                    }
                }
            }, 0);
        }
    }


    refreshOutline() {
        if (!this.containerElement) return; // Guard against missing container
        
        // Preserve focus if possible, or re-determine if lost/first load
        const previouslyFocusedId = this.focusedItem.elementId;
        let shouldRefocus = !!previouslyFocusedId;

        OPTIMISM_UTILS.log("OutlineManager: Refreshing outline...");

        this.outlineItems = this._buildOutlineDataStructure();
        
        if (this.outlineItems.length === 0) {
            this.view.renderer.panel.renderOutlinerPanel([], null);
            this.focusedItem = { elementId: null, path: [], domElement: null, index: -1 };
            return;
        }

        if (!shouldRefocus || !this.outlineItems.some(item => item.elementId === previouslyFocusedId)) {
            this._determineInitialFocus();
        } else {
            // If previously focused item still exists, find its new index
            this.focusedItem.index = this.outlineItems.findIndex(item => item.elementId === previouslyFocusedId);
            if (this.focusedItem.index === -1) { // Should not happen if some() passed
                this._determineInitialFocus();
            }
        }
        
        this.view.renderer.panel.renderOutlinerPanel(this.outlineItems, this.focusedItem.elementId);
        this.ensureFocusedItemVisible(); 
    }

    _buildOutlineDataStructure() {
        const items = [];
        const GMaxLevel = 15; 

        const processNode = (node, level, parentPath, parentIsCollapsed) => {
            if (!node || level > GMaxLevel) { // Removed !node.elements check to allow empty nodes to be processed if they are parents
                return;
            }

            // Ensure elements array exists, even if empty
            const elements = node.elements || [];
            const sortedElements = [...elements].sort((a, b) => {
                const orderA = a.outlineOrder !== undefined ? a.outlineOrder : Infinity; 
                const orderB = b.outlineOrder !== undefined ? b.outlineOrder : Infinity;
                if (orderA !== orderB) {
                    return orderA - orderB;
                }
                return 0; 
            });

            for (const element of sortedElements) {
                if (!element) continue;

                const isCollapsed = element.style?.outlineCollapsed || false;
                const hasModelChildren = this.model.hasChildren(element.id, node.id); 

                items.push({
                    elementId: element.id,
                    parentId: node.id, 
                    displayText: element.type === 'text' ? (element.text || '') : "Image",
                    type: element.type,
                    level: level,
                    isCollapsed: isCollapsed,
                    hasChildren: hasModelChildren, 
                    parentPath: [...parentPath] 
                });

                if (hasModelChildren && !isCollapsed && !parentIsCollapsed) {
                    const childNode = node.children?.[element.id];
                    if (childNode) {
                        processNode(childNode, level + 1, [...parentPath, element.id], false);
                    }
                }
            }
        };
        
        processNode(this.model.data, 0, [], false); 
        return items;
    }
    
    // In outline-manager.js
    _determineInitialFocus() {
        if (this.outlineItems.length === 0) {
            this.focusedItem = { elementId: null, path: [], domElement: null, index: -1 };
            return;
        }

        const currentCanvasNode = this.model.currentNode;
        let targetElementIdToFocus = null;

        if (currentCanvasNode.id === 'root') {
            // If viewing root, focus the first element directly under root in the outline
            const firstRootChild = this.outlineItems.find(item => item.parentId === 'root'); 
            if (firstRootChild) {
                targetElementIdToFocus = firstRootChild.elementId;
            }
        } else {
            // We are viewing the contents of a node that corresponds to an element (currentCanvasNode.id is an elementId)
            // First, find this "parent" element in the outline.
            const parentOutlineItem = this.outlineItems.find(item => item.elementId === currentCanvasNode.id);
            if (parentOutlineItem) {
                if (!parentOutlineItem.isCollapsed && parentOutlineItem.hasChildren) {
                    // If it's expanded and has children, focus its first child in the outline.
                    // Children in the outline will have their parentId set to currentCanvasNode.id
                    const firstChildInOutline = this.outlineItems.find(item => item.parentId === currentCanvasNode.id);
                    if (firstChildInOutline) {
                        targetElementIdToFocus = firstChildInOutline.elementId;
                    } else {
                        // Should be rare if hasChildren is true and not collapsed. Focus parent itself.
                        targetElementIdToFocus = parentOutlineItem.elementId;
                    }
                } else {
                    // If it's collapsed or has no children displayed in outline, focus the parent element itself.
                    targetElementIdToFocus = parentOutlineItem.elementId;
                }
            }
        }
        
        // Fallback to the very first item in the entire outline if no specific target found
        if (!targetElementIdToFocus && this.outlineItems.length > 0) {
            targetElementIdToFocus = this.outlineItems[0].elementId;
        }

        if (targetElementIdToFocus) {
            const focusIndex = this.outlineItems.findIndex(item => item.elementId === targetElementIdToFocus);
            if (focusIndex !== -1) {
                this.focusedItem.elementId = targetElementIdToFocus;
                this.focusedItem.path = this.outlineItems[focusIndex].parentPath;
                this.focusedItem.index = focusIndex;
            } else {
                // Default to very first item if specific target not in the flattened list
                this.focusedItem.elementId = this.outlineItems[0]?.elementId || null;
                this.focusedItem.path = this.outlineItems[0]?.parentPath || [];
                this.focusedItem.index = this.outlineItems.length > 0 ? 0 : -1;
            }
        } else {
             this.focusedItem = { elementId: null, path: [], domElement: null, index: -1 };
        }

        OPTIMISM_UTILS.log("OutlineManager: Initial focus determined for elementId:", this.focusedItem.elementId, "at index", this.focusedItem.index);
    }

    ensureFocusedItemVisible() {
        // domElement might be stale after a refreshOutline, so re-query
        if (this.focusedItem.elementId) {
            const focusedDom = this.containerElement.querySelector(`.outliner-item[data-element-id="${this.focusedItem.elementId}"]`);
            if (focusedDom) {
                this.focusedItem.domElement = focusedDom; // Update reference
                focusedDom.scrollIntoView({ behavior: 'auto', block: 'nearest' });
            }
        }
    }

    // --- Focus Management ---
    setFocusByElementId(elementId, domElement = null, shouldRender = true) { 
        const newIndex = this.outlineItems.findIndex(item => item.elementId === elementId);
        if (newIndex === -1) return; // Item not found in current outline data

        // Remove focus from previous
        if (this.focusedItem.domElement) {
            this.focusedItem.domElement.classList.remove('focused');
        }
        
        this.focusedItem.elementId = elementId;
        this.focusedItem.index = newIndex;
        this.focusedItem.path = this.outlineItems[newIndex].parentPath;
        
        if (domElement) {
            domElement.classList.add('focused');
            this.focusedItem.domElement = domElement;
        } else if (shouldRender) { 
            // If domElement not provided and shouldRender is true, re-render will set it.
            // This case is typically handled by refreshOutline itself.
        }


        if (shouldRender) {
            // Re-render to apply focus class correctly if not directly providing domElement
            // Or, if domElement was provided, but other visual aspects might need updating due to focus change
            this.view.renderer.panel.renderOutlinerPanel(this.outlineItems, this.focusedItem.elementId);
        } else if (this.focusedItem.domElement) { // if shouldRender is false, but we have a domElement
             this.focusedItem.domElement.classList.add('focused'); // ensure class is set
        }
        
        this.ensureFocusedItemVisible();
        OPTIMISM_UTILS.log(`Outline focus set to: ${elementId} at index ${this.focusedItem.index}`);
    }

    moveFocusUp() { 
        if (this.isInlineEditing || this.outlineItems.length === 0 || this.focusedItem.index <= 0) return;
        
        const newIndex = this.focusedItem.index - 1;
        const newItem = this.outlineItems[newIndex];
        const newDomElement = this.containerElement.children[newIndex]; // Assumes direct children match outlineItems

        if (newItem && newDomElement) {
            this.setFocusByElementId(newItem.elementId, newDomElement, false); // false: don't re-render full panel
        }
    }

    moveFocusDown() { 
        if (this.isInlineEditing || this.outlineItems.length === 0 || this.focusedItem.index >= this.outlineItems.length - 1) return;

        const newIndex = this.focusedItem.index + 1;
        const newItem = this.outlineItems[newIndex];
        const newDomElement = this.containerElement.children[newIndex]; // Assumes direct children match outlineItems
        
        if (newItem && newDomElement) {
            this.setFocusByElementId(newItem.elementId, newDomElement, false); // false: don't re-render full panel
        }
    }

    // --- Keyboard & Click Handling ---
    _handleKeyDown(event) {
        if (!this.model.panels.outliner) return; // Only process if panel is active

        // Prevent default browser behavior for keys we handle
        switch (event.key) {
            case 'ArrowUp':
                event.preventDefault();
                this.moveFocusUp();
                break;
            case 'ArrowDown':
                event.preventDefault();
                this.moveFocusDown();
                break;
            case ' ': // Spacebar
                if (event.shiftKey) { // Shift + Space
                    event.preventDefault();
                    this.toggleCollapseFocusedItem();
                }
                // Potentially allow regular space for inline editing later
                break;
            // Enter, Escape, Shift+Arrows will be handled later
        }
    }

    _handleClick(event) {
        if (this.isInlineEditing) {
            // If clicking outside while editing, consider it a save
            // This needs careful handling with _saveEdit an _cancelEdit later
        }

        const targetItem = event.target.closest('.outliner-item');
        if (targetItem && targetItem.dataset.elementId) {
            const elementId = targetItem.dataset.elementId;
            const toggleClicked = event.target.classList.contains('outliner-item-toggle');

            if (toggleClicked) {
                event.stopPropagation(); // Prevent click from also triggering item focus/edit
                this.setFocusByElementId(elementId, targetItem, true); // Focus item first
                this.toggleCollapseFocusedItem();
            } else {
                this.setFocusByElementId(elementId, targetItem, true); // Focus the clicked item
                // TODO: Initiate inline editing on click (Phase 4)
                // this.startEditingFocusedItem(); 
            }
        }
    }

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
    
    async toggleCollapseFocusedItem() { 
        if (!this.focusedItem.elementId || this.isInlineEditing) return;

        const itemData = this.outlineItems[this.focusedItem.index];
        if (!itemData || !itemData.hasChildren) {
            OPTIMISM_UTILS.log("Cannot toggle collapse: No focused item or item has no children.");
            return;
        }

        const newCollapsedState = !itemData.isCollapsed;
        OPTIMISM_UTILS.log(`Toggling collapse for ${itemData.elementId} to ${newCollapsedState}`);

        // Update the model
        // We need a command for this to make it undoable.
        // For now, directly update model for testing, then wrap in command.
        const element = this.model.findElementGlobally(itemData.elementId);
        if (element) {
            if (!element.style) element.style = {};
            element.style.outlineCollapsed = newCollapsedState;
            // This direct model manipulation won't be undoable yet.
            // We'll replace this with a command later.
            await this.model.saveData(); // Save the change
            this.model.incrementEditCounter(); // Manually increment if not using a command

            // Refresh the outline to reflect the change
            this.refreshOutline();
        } else {
            OPTIMISM_UTILS.logError(`Element ${itemData.elementId} not found in model for toggling collapse.`);
        }
    }
}
// --- END OF FILE js/managers/outline-manager.js ---