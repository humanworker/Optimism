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
            currentCanvasNodeIdForLastFocus: null, // NEW: Track context for focus
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

        this.containerElement.setAttribute('tabindex', '-1');
        this.containerElement.addEventListener('keydown', this._handleKeyDown.bind(this));
        this.containerElement.addEventListener('click', this._handleClick.bind(this));

        OPTIMISM_UTILS.log("OutlineManager: Setup complete.");
    }

    onPanelVisible() {
        if (this.model.panels.outliner && this.containerElement) {
            OPTIMISM_UTILS.log("OutlineManager: onPanelVisible called, panel is becoming visible.");
            if (!document.body.classList.contains('outliner-visible')) { // Add class if not present
                document.body.classList.add('outliner-visible');
                // When outliner becomes visible, ensure Arena specific class is removed if present
                // as they occupy similar screen space roles.
                document.body.classList.remove('arena-view-active');
            }
            this.refreshOutline();
            setTimeout(() => {
                const activeEl = document.activeElement;
                OPTIMISM_UTILS.log(`OutlineManager onPanelVisible timeout: Current activeElement is:`, activeEl, `TagName: ${activeEl?.tagName}`);
                if (!activeEl || (activeEl.tagName !== 'TEXTAREA' && activeEl.tagName !== 'INPUT')) {
                    OPTIMISM_UTILS.log("OutlineManager onPanelVisible timeout: Focusing containerElement because activeElement is not an input/textarea.");
                    this.containerElement.focus();
                    if (this.focusedItem.elementId) { 
                        const domElToFocus = this.containerElement.querySelector(`.outliner-item[data-element-id="${this.focusedItem.elementId}"]`);
                        if (domElToFocus) {
                            if(this.focusedItem.domElement && this.focusedItem.domElement !== domElToFocus) {
                                this.focusedItem.domElement.classList.remove('focused');
                            }
                            domElToFocus.classList.add('focused');
                            this.focusedItem.domElement = domElToFocus;
                            this.ensureFocusedItemVisible();
                        }
                    }
                } else {
                    OPTIMISM_UTILS.log("OutlineManager onPanelVisible timeout: Skipping container focus, input/textarea element is active:", activeEl.tagName, activeEl);
                }
            }, 0);
        } else {
            // Panel is becoming hidden
            OPTIMISM_UTILS.log("OutlineManager: onPanelVisible called, panel is becoming hidden.");
            if (document.body.classList.contains('outliner-visible')) {
                document.body.classList.remove('outliner-visible');
            }
        }
    }

    refreshOutline() {
        if (!this.containerElement) {
             OPTIMISM_UTILS.logError("OutlineManager: Container element missing, cannot refresh outline.");
             return;
        }
        
        const previouslyFocusedId = this.focusedItem.elementId;
        const previousCanvasNodeId = this.focusedItem.currentCanvasNodeIdForLastFocus || null;
        this.focusedItem.currentCanvasNodeIdForLastFocus = this.model.currentNode.id; // Update for next time

        OPTIMISM_UTILS.log("OutlineManager: Refreshing outline... Previously focused:", previouslyFocusedId, "Prev Canvas Node:", previousCanvasNodeId);

        this.outlineItems = this._buildOutlineDataStructure();
        OPTIMISM_UTILS.log(`OutlineManager: Built ${this.outlineItems.length} outline items.`);
        
        this.focusedItem.domElement = null; // DOM will be rebuilt

        if (this.outlineItems.length === 0) {
            OPTIMISM_UTILS.log("OutlineManager: No outline items built. Rendering empty panel.");
            this.view.renderer.panel.renderOutlinerPanel([], null);
            this.focusedItem.elementId = null;
            this.focusedItem.path = [];
            this.focusedItem.index = -1;
            return;
        }

        let currentTargetIdForFocus;
        if (!previouslyFocusedId || previousCanvasNodeId !== this.model.currentNode.id || !this.outlineItems.some(item => item.elementId === previouslyFocusedId)) {
            OPTIMISM_UTILS.log(`OutlineManager: Recalculating focus. Prev ID: ${previouslyFocusedId}, Prev Canvas Node: ${previousCanvasNodeId}, Current Canvas Node: ${this.model.currentNode.id}`);
            currentTargetIdForFocus = this._determineInitialFocusTargetId();
        } else {
            OPTIMISM_UTILS.log("OutlineManager: Attempting to maintain focus on ID:", previouslyFocusedId, "as canvas node context is same.");
            currentTargetIdForFocus = previouslyFocusedId;
        }
        
        const targetIndex = this.outlineItems.findIndex(item => item.elementId === currentTargetIdForFocus);

        if (targetIndex !== -1) {
            this.focusedItem.elementId = currentTargetIdForFocus;
            this.focusedItem.path = this.outlineItems[targetIndex].parentPath;
            this.focusedItem.index = targetIndex;
            OPTIMISM_UTILS.log(`OutlineManager: Focus target for render: ${this.focusedItem.elementId} at index ${this.focusedItem.index}`);
        } else if (this.outlineItems.length > 0) { 
            OPTIMISM_UTILS.log(`OutlineManager: Target ID ${currentTargetIdForFocus} not found OR invalid after build. Defaulting to first item of new outline.`);
            this.focusedItem.elementId = this.outlineItems[0].elementId;
            this.focusedItem.path = this.outlineItems[0].parentPath;
            this.focusedItem.index = 0;
        } else { 
            this.focusedItem.elementId = null;
            this.focusedItem.path = [];
            this.focusedItem.index = -1;
        }
        
        this.view.renderer.panel.renderOutlinerPanel(this.outlineItems, this.focusedItem.elementId); 
        this.ensureFocusedItemVisible(); 
    }

    _buildOutlineDataStructure() {
        const items = [];
        const GMaxLevel = 15; 

        const processNode = (node, level, parentPath, parentIsCollapsed) => {
            if (!node || level > GMaxLevel) {
                return;
            }

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

                const isCollapsedInStyle = element.style?.outlineCollapsed || false;
                const hasModelChildren = this.model.hasChildren(element.id, node.id); 

                items.push({
                    elementId: element.id,
                    parentId: node.id, 
                    displayText: element.type === 'text' ? (element.text || '') : "Image",
                    type: element.type,
                    level: level,
                    isCollapsed: isCollapsedInStyle,
                    hasChildren: hasModelChildren, 
                    parentPath: [...parentPath] 
                });

                if (hasModelChildren && !isCollapsedInStyle && !parentIsCollapsed) {
                    const childNodeData = node.children?.[element.id];
                    if (childNodeData) {
                        processNode(childNodeData, level + 1, [...parentPath, element.id], false);
                    }
                }
            }
        };
        
        processNode(this.model.data, 0, [], false); 
        return items;
    }
    
    _determineInitialFocusTargetId() {
        if (this.outlineItems.length === 0) return null;

        const currentCanvasNode = this.model.currentNode;
        let targetElementIdToFocus = null;

        OPTIMISM_UTILS.log(`_determineInitialFocusTargetId: Current canvas node ID: ${currentCanvasNode.id}`);

        if (currentCanvasNode.id === 'root') {
            const firstRootChild = this.outlineItems.find(item => item.parentId === 'root');
            if (firstRootChild) {
                targetElementIdToFocus = firstRootChild.elementId;
                OPTIMISM_UTILS.log(`_determineInitialFocusTargetId: Root view, target is first root child: ${targetElementIdToFocus}`);
            } else {
                OPTIMISM_UTILS.log("_determineInitialFocusTargetId: Root view, no root children found in outlineItems.");
            }
        } else {
            const parentOutlineItem = this.outlineItems.find(item => item.elementId === currentCanvasNode.id);
            if (parentOutlineItem) {
                OPTIMISM_UTILS.log(`_determineInitialFocusTargetId: Found parent outline item for current node ${currentCanvasNode.id}:`, JSON.stringify(parentOutlineItem));
                if (!parentOutlineItem.isCollapsed && parentOutlineItem.hasChildren) {
                    const firstChildInOutline = this.outlineItems.find(item => item.parentId === currentCanvasNode.id);
                    if (firstChildInOutline) {
                        targetElementIdToFocus = firstChildInOutline.elementId;
                        OPTIMISM_UTILS.log(`_determineInitialFocusTargetId: Parent expanded with children, target is first child: ${targetElementIdToFocus}`);
                    } else {
                        targetElementIdToFocus = parentOutlineItem.elementId;
                        OPTIMISM_UTILS.log("_determineInitialFocusTargetId: Parent expanded, hasChildren true, but no child found in outlineItems. Targeting parent itself:", targetElementIdToFocus);
                    }
                } else {
                    targetElementIdToFocus = parentOutlineItem.elementId;
                    OPTIMISM_UTILS.log(`_determineInitialFocusTargetId: Parent collapsed or no children in outline, target is parent itself: ${targetElementIdToFocus}`);
                }
            } else {
                OPTIMISM_UTILS.log(`_determineInitialFocusTargetId: Parent outline item for current node ${currentCanvasNode.id} NOT found.`);
            }
        }
        
        if (!targetElementIdToFocus && this.outlineItems.length > 0) {
            targetElementIdToFocus = this.outlineItems[0].elementId;
            OPTIMISM_UTILS.log(`_determineInitialFocusTargetId: Fallback to first outline item: ${targetElementIdToFocus}`);
        }
        
        OPTIMISM_UTILS.log("_determineInitialFocusTargetId: Determined target ID:", targetElementIdToFocus);
        return targetElementIdToFocus;
    }

    ensureFocusedItemVisible() {
        if (this.focusedItem.elementId && this.containerElement) {
            const focusedDom = this.containerElement.querySelector(`.outliner-item[data-element-id="${this.focusedItem.elementId}"]`);
            if (focusedDom) {
                if (this.focusedItem.domElement !== focusedDom) {
                    if(this.focusedItem.domElement) this.focusedItem.domElement.classList.remove('focused');
                    this.focusedItem.domElement = focusedDom;
                    this.focusedItem.domElement.classList.add('focused');
                }
                focusedDom.scrollIntoView({ behavior: 'auto', block: 'nearest' });
            } else {
                if(this.focusedItem.domElement) this.focusedItem.domElement.classList.remove('focused');
                this.focusedItem.domElement = null;
            }
        }
    }

    setFocusByElementId(elementId, domElement = null, shouldRender = true) {
        const newIndex = this.outlineItems.findIndex(item => item.elementId === elementId);
        if (newIndex === -1) {
            OPTIMISM_UTILS.logError(`setFocusByElementId: Item ${elementId} not found in current outlineItems.`);
            return;
        }

        if (this.focusedItem.domElement && this.focusedItem.domElement !== domElement) {
            this.focusedItem.domElement.classList.remove('focused');
        }
        
        this.focusedItem.elementId = elementId;
        this.focusedItem.index = newIndex;
        this.focusedItem.path = this.outlineItems[newIndex].parentPath;
        this.focusedItem.domElement = domElement; // Assign new domElement

        if (shouldRender) {
            OPTIMISM_UTILS.log(`setFocusByElementId: Re-rendering panel to focus ${elementId}`);
            this.view.renderer.panel.renderOutlinerPanel(this.outlineItems, this.focusedItem.elementId);
            // PanelRenderer should set this.focusedItem.domElement after render if it finds the ID
        } else if (this.focusedItem.domElement) {
            this.focusedItem.domElement.classList.add('focused');
        } else { 
             const foundDom = this.containerElement?.querySelector(`.outliner-item[data-element-id="${elementId}"]`);
             if (foundDom) {
                 foundDom.classList.add('focused');
                 this.focusedItem.domElement = foundDom;
             }
        }
        
        this.ensureFocusedItemVisible();
        OPTIMISM_UTILS.log(`Outline focus set to: ${elementId} at index ${this.focusedItem.index}`);
    }

    moveFocusUp() {
        if (this.isInlineEditing || this.outlineItems.length === 0 || this.focusedItem.index <= 0) return;

        const newIndex = this.focusedItem.index - 1;
        const newItemData = this.outlineItems[newIndex];
        const newDomElement = this.containerElement?.children[newIndex];

        if (newItemData && newDomElement && newDomElement.classList.contains('outliner-item')) {
            this.setFocusByElementId(newItemData.elementId, newDomElement, false);
        } else {
            OPTIMISM_UTILS.logError("moveFocusUp: Could not find new item or DOM element at index", newIndex);
        }
    }

    moveFocusDown() {
        if (this.isInlineEditing || this.outlineItems.length === 0 || this.focusedItem.index >= this.outlineItems.length - 1) return;

        const newIndex = this.focusedItem.index + 1;
        const newItemData = this.outlineItems[newIndex];
        const newDomElement = this.containerElement?.children[newIndex];

        if (newItemData && newDomElement && newDomElement.classList.contains('outliner-item')) {
            this.setFocusByElementId(newItemData.elementId, newDomElement, false);
        } else {
            OPTIMISM_UTILS.logError("moveFocusDown: Could not find new item or DOM element at index", newIndex);
        }
    }

    _handleKeyDown(event) {
        if (!this.model.panels.outliner || this.isInlineEditing) return;

        switch (event.key) {
            case 'ArrowUp':
                event.preventDefault();
                this.moveFocusUp();
                break;
            case 'ArrowDown':
                event.preventDefault();
                this.moveFocusDown();
                break;
            case ' ':
                if (event.shiftKey) {
                    event.preventDefault();
                    this.toggleCollapseFocusedItem();
                }
                break;
        }
    }

    _handleClick(event) {
        OPTIMISM_UTILS.log('OutlineManager _handleClick triggered. Target:', event.target, 'Closest .outliner-item:', event.target.closest('.outliner-item'));
        if (this.isInlineEditing) {
            return;
        }

        const targetItemElement = event.target.closest('.outliner-item');
        if (!targetItemElement) return;

        const elementId = targetItemElement.dataset.elementId;
        if (!elementId) return;

        const isToggleClick = event.target.classList.contains('outliner-item-toggle');

        if (isToggleClick) {
            event.stopPropagation();
            this.setFocusByElementId(elementId, targetItemElement, false);
            this.toggleCollapseFocusedItem();
        } else {
            this.setFocusByElementId(elementId, targetItemElement, false); // Set to false to avoid re-render, just update class
            // TODO: Phase 4 - this.startEditingFocusedItem(); 
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
        if (!this.focusedItem.elementId || this.isInlineEditing || this.focusedItem.index === -1) return;

        const itemData = this.outlineItems[this.focusedItem.index];
        if (!itemData || !itemData.hasChildren) {
            OPTIMISM_UTILS.log("Cannot toggle collapse: No focused item data or item has no children.");
            return;
        }

        const newCollapsedState = !itemData.isCollapsed;
        OPTIMISM_UTILS.log(`Toggling collapse for ${itemData.elementId} to ${newCollapsedState}`);

        const element = this.model.findElementGlobally(itemData.elementId);
        if (element) {
            if (!element.style) element.style = {};
            
            // TODO: Replace with Command for undoability in a later phase
            element.style.outlineCollapsed = newCollapsedState;
            await this.model.saveData();
            this.model.incrementEditCounter(); 

            this.refreshOutline(); 
        } else {
            OPTIMISM_UTILS.logError(`Element ${itemData.elementId} not found in model for toggling collapse.`);
        }
    }
}
// --- END OF FILE js/managers/outline-manager.js ---