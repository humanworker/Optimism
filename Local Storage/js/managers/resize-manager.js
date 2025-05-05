import { OPTIMISM_UTILS } from '../utils.js';

export class ResizeManager {
    constructor(model, controller, view) {
        this.model = model;
        this.controller = controller;
        this.view = view; // Reference to main view for workspace access

        // Resize State
        this.resizingElement = null; // The DOM element container being resized
        this.initialWidth = 0;
        this.initialHeight = 0;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.minAllowedWidth = 30; // Default min width
        this.minAllowedHeight = 30; // Default min height
    }

    // Setup listeners (delegated from ElementRenderer or a global setup)
    // This manager doesn't need its own global listeners,
    // startResize is called directly when a handle is mousedown'd.
    setup() {
        // No global listeners needed here, setup is implicit via startResize call
        OPTIMISM_UTILS.log("ResizeManager: Ready.");
    }

    // Called by element resize handle mousedown listener
    startResize(event, elementContainer) {
        // Basic checks (caller should have already checked locks)
        if (!elementContainer || event.button !== 0) return;

        // *** ADD Check and Force Blur for Text Edit Mode ***
        if (elementContainer.dataset.type === 'text') {
            const textarea = elementContainer.querySelector('textarea.text-element');
            // Check if the textarea is currently visible (indicating edit mode)
            if (textarea && textarea.style.display !== 'none') {
                OPTIMISM_UTILS.log("ResizeManager: Textarea is visible, forcing blur before resize.");
                // Triggering blur programmatically ensures the text update logic runs
                textarea.blur(); // This should trigger the 'blur' event listener in ElementRenderer
                // NOTE: The blur handler is async. Waiting for it perfectly here is complex.
                // Usually, triggering blur() is sufficient as the subsequent resize calculations
                // will happen after the current JS task (including the blur handler's start) finishes.
                // If timing issues persist, a small timeout *might* be needed before proceeding, but try without first.
            }
        }

        this.resizingElement = elementContainer;
        this.model.selectedElement = elementContainer.dataset.id; // Ensure selection

        this.initialWidth = elementContainer.offsetWidth;
        this.initialHeight = elementContainer.offsetHeight;
        this.dragStartX = event.clientX;
        this.dragStartY = event.clientY;

        // Set minimum dimensions based on type
        this.minAllowedWidth = (elementContainer.dataset.type === 'image') ? 50 : 30;
        this.minAllowedHeight = (elementContainer.dataset.type === 'image') ? 50 : 30;

        // Add resizing class to body for cursor changes (optional)
        document.body.classList.add('resizing');
        // Prevent text selection during resize
        document.body.style.userSelect = 'none';

        // Attach temporary listeners for mousemove and mouseup on the document
        document.addEventListener('mousemove', this.handleMouseMove, { passive: false }); // Use bound function
        document.addEventListener('mouseup', this.handleMouseUp, { once: true }); // Use bound function, capture once

        OPTIMISM_UTILS.log(`ResizeManager: Started resize for ${elementContainer.dataset.id}`);
        event.preventDefault(); // Prevent default actions
    }

    // Bound function for document mousemove listener
    handleMouseMove = (event) => {
        if (!this.resizingElement) return;
        event.preventDefault(); // Prevent unwanted scrolling/selection

        const deltaWidth = event.clientX - this.dragStartX;
        const deltaHeight = event.clientY - this.dragStartY;

        let newWidth = Math.max(this.minAllowedWidth, this.initialWidth + deltaWidth);
        let newHeight = Math.max(this.minAllowedHeight, this.initialHeight + deltaHeight);

        // Workspace boundary constraint (prevent resizing past right edge)
        const workspaceWidth = this.view.workspace.clientWidth; // Visible width
        const elementLeft = this.resizingElement.offsetLeft;
        const maxWidth = workspaceWidth - elementLeft - 2; // Subtract a couple pixels for buffer
        newWidth = Math.min(newWidth, maxWidth);


        // --- Grid Snapping during Resize ---
        if (this.model.panels.grid) { // Check model if grid is active
             const snapThreshold = 10;
             const elementRect = this.resizingElement.getBoundingClientRect();
             const workspaceRect = this.view.workspace.getBoundingClientRect();

             // Calculate potential right/bottom edges based on current mouse position
             const checkRight = elementRect.left - workspaceRect.left + newWidth;
             const checkBottom = elementRect.top - workspaceRect.top + newHeight;

             const gridLines = this.view.workspace.querySelectorAll('#grid-container .grid-line');

             gridLines.forEach(line => {
                 if (line.classList.contains('grid-line-vertical')) {
                     const lineX = parseInt(line.style.left);
                     // Snap right edge
                     if (Math.abs(checkRight - lineX) < snapThreshold) {
                          // Adjust width based on the original left position
                          newWidth = lineX - (elementRect.left - workspaceRect.left);
                     }
                 } else { // Horizontal line
                     const lineY = parseInt(line.style.top);
                     // Snap bottom edge
                     if (Math.abs(checkBottom - lineY) < snapThreshold) {
                          // Adjust height based on the original top position
                          newHeight = lineY - (elementRect.top - workspaceRect.top);
                     }
                 }
             });
             // Re-apply minimums and maximums after snapping
             newWidth = Math.max(this.minAllowedWidth, Math.min(newWidth, maxWidth));
             newHeight = Math.max(this.minAllowedHeight, newHeight);
        }


        // Update element style directly during resize
        this.resizingElement.style.width = `${newWidth}px`;
        this.resizingElement.style.height = `${newHeight}px`;
    }

    // Bound function for document mouseup listener
    handleMouseUp = (event) => {
        if (!this.resizingElement) return;

        // Remove temporary listeners
        document.removeEventListener('mousemove', this.handleMouseMove);
        // mouseup is already {once: true}

        document.body.classList.remove('resizing');
        document.body.style.userSelect = '';

        const id = this.resizingElement.dataset.id;
        const finalWidth = parseFloat(this.resizingElement.style.width);
        const finalHeight = parseFloat(this.resizingElement.style.height);

        // Check if size actually changed
        if (Math.abs(finalWidth - this.initialWidth) > 1 || Math.abs(finalHeight - this.initialHeight) > 1) {
             OPTIMISM_UTILS.log(`ResizeManager: Resize complete for ${id}: ${finalWidth}x${finalHeight}`);
             // Update model via controller (uses UpdateElementCommand for undo)
             this.controller.updateElementWithUndo(id,
                 { width: finalWidth, height: finalHeight }, // New properties
                 { width: this.initialWidth, height: this.initialHeight } // Old properties
             );
        } else {
             // OPTIMISM_UTILS.log(`ResizeManager: Size unchanged for ${id}`);
        }

        this.resizingElement = null; // Reset state
        this.view.updateSpacerPosition(); // Update spacer after resize
    }

} // End ResizeManager Class
