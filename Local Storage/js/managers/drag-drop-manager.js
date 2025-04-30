import { OPTIMISM_UTILS } from '../utils.js';

export class DragDropManager {
    constructor(model, controller, view) {
        this.model = model;
        this.controller = controller;
        this.view = view; // Reference to main view for accessing elements/renderers

        // Drag State
        this.draggedElement = null; // The DOM element being dragged from workspace
        this.inboxDragTarget = null; // The DOM element being dragged from inbox
        this.arenaImageBeingDragged = null; // URL of image dragged from Arena iframe

        // Drag Offsets/Start Position
        this.elemOffsetX = 0;
        this.elemOffsetY = 0;
        this.dragStartX = 0; // For calculating movement delta if needed
        this.dragStartY = 0;

        // Drop Target Cache (cleared on mouse move)
        this.currentDropTarget = null; // The element being hovered over for nesting
        this.currentBreadcrumbTargetIndex = null; // Index of breadcrumb target
        this.isOverQuickLinks = false;          // Is mouse over quick links area
        this.isOverInbox = false;               // Is mouse over inbox panel/toggle
    }

    // Setup master listeners on document/window
    setup() {
        OPTIMISM_UTILS.log("DragDropManager: Setting up listeners...");

        // --- Global Mouse Move (Handles element dragging) ---
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));

        // --- Global Mouse Up (Handles end of drag/drop) ---
        document.addEventListener('mouseup', (e) => this.handleMouseUp(e));

        // --- Workspace Drop (For inbox cards) ---
        this.view.workspace.addEventListener('dragover', (e) => this.handleWorkspaceDragOver(e));
        this.view.workspace.addEventListener('drop', (e) => this.handleWorkspaceDrop(e));
        this.view.workspace.addEventListener('dragleave', (e) => this.handleWorkspaceDragLeave(e)); // Optional: clear indicators

        // --- Document Drop (For external files/Arena images) ---
        document.addEventListener('dragover', (e) => this.handleDocumentDragOver(e));
        document.addEventListener('dragleave', (e) => this.handleDocumentDragLeave(e));
        document.addEventListener('drop', (e) => this.handleDocumentDrop(e));

        // --- Title Bar Drag Over/Leave/Drop (For breadcrumbs/quicklinks) ---
        const titleBar = document.getElementById('title-bar');
        if (titleBar) {
            titleBar.addEventListener('dragover', (e) => this.handleTitleBarDragOver(e));
            titleBar.addEventListener('dragleave', (e) => this.handleTitleBarDragLeave(e));
            // Drop handled by document listener, but checking target in handleMouseUp
        }

         // --- Inbox Panel/Toggle Drag Over/Leave ---
         const inboxToggle = document.getElementById('inbox-toggle');
         const inboxPanel = document.getElementById('inbox-panel');
         if (inboxToggle) {
             inboxToggle.addEventListener('dragenter', (e) => this.handleInboxDragEnter(e));
             inboxToggle.addEventListener('dragleave', (e) => this.handleInboxDragLeave(e));
             // Drop handled by handleMouseUp checking isOverInbox
         }
         if (inboxPanel) {
             inboxPanel.addEventListener('dragenter', (e) => this.handleInboxDragEnter(e));
             inboxPanel.addEventListener('dragleave', (e) => this.handleInboxDragLeave(e));
             // Drop handled by handleMouseUp checking isOverInbox
         }

        // Listen for messages from Arena iframe
        window.addEventListener('message', (e) => this.handleArenaMessage(e));

        OPTIMISM_UTILS.log("DragDropManager: Listeners set up.");
    }

    // --- Drag Start Handlers ---

    // Called by element mousedown listener in ElementRenderer
    startDrag(event, elementContainer) {
        // Basic checks already done by caller (button, locks etc)
        this.draggedElement = elementContainer;
        this.model.selectedElement = elementContainer.dataset.id; // Ensure selection matches model

        const elementRect = elementContainer.getBoundingClientRect();
        this.elemOffsetX = event.clientX - elementRect.left;
        this.elemOffsetY = event.clientY - elementRect.top;
        this.dragStartX = event.clientX; // Store start position if needed
        this.dragStartY = event.clientY;

        // Store original position for potential snap back (if dropped on invalid target or quick link)
        elementContainer.dataset.originalLeft = elementContainer.style.left;
        elementContainer.dataset.originalTop = elementContainer.style.top;

        elementContainer.classList.add('dragging');
        // Hide style panel immediately on drag start
        this.view.panelManager.hidePanel('style');
        event.preventDefault(); // Prevent text selection etc.
    }

    // Called by inbox card dragstart listener in PanelRenderer
    startInboxDrag(event, cardElement) {
         OPTIMISM_UTILS.log(`DragDropManager: Starting drag of inbox card ${cardElement.dataset.id}`);
         this.inboxDragTarget = cardElement;
         event.dataTransfer.setData('text/plain', cardElement.dataset.id); // Use card ID
         event.dataTransfer.effectAllowed = 'move';
         cardElement.classList.add('dragging');
         // Optionally hide drop zone indicator if shown for external files
         this.view.hideDropZone();
    }

    // --- Drag Over/Move Handlers ---

    handleMouseMove(event) {
         // Only handle if dragging an element from the workspace
         if (!this.draggedElement) return;

         event.preventDefault(); // Prevent default actions during move
         // Prevent dragging locked elements (double check)
         const id = this.draggedElement.dataset.id;
         const type = this.draggedElement.dataset.type;
         if (this.model.isCardLocked(id) || (type === 'image' && this.model.imagesLocked)) {
              // Should not happen if startDrag checks work, but as safety
              this.cancelDrag();
              return;
         }

         // --- Position Update ---
         const workspaceRect = this.view.workspace.getBoundingClientRect();
         let desiredX = event.clientX - workspaceRect.left - this.elemOffsetX + this.view.workspace.scrollLeft;
         let desiredY = event.clientY - workspaceRect.top - this.elemOffsetY + this.view.workspace.scrollTop;

         // Boundary Constraints
         const minX = 0;
         const maxX = this.view.workspace.scrollWidth - this.draggedElement.offsetWidth;
         const minY = 0;
         // No bottom constraint during drag allows scrolling down

         let finalX = Math.max(minX, Math.min(desiredX, maxX));
         let finalY = Math.max(minY, desiredY);


         // --- Grid Snapping ---
         if (this.model.panels.grid) { // Check model if grid is active
             const snapThreshold = 10;
             const elementRect = this.draggedElement.getBoundingClientRect(); // Get current screen rect
             const workspaceScroll = this.view.getScrollPosition();

             // Adjust element position based on current screen pos + scroll for accurate snapping checks
             const checkX = event.clientX - workspaceRect.left + workspaceScroll.left - this.elemOffsetX;
             const checkY = event.clientY - workspaceRect.top + workspaceScroll.top - this.elemOffsetY;
             const checkRight = checkX + this.draggedElement.offsetWidth;
             const checkBottom = checkY + this.draggedElement.offsetHeight;


             const gridLines = this.view.workspace.querySelectorAll('#grid-container .grid-line');
             let snappedX = false;
             let snappedY = false;

             gridLines.forEach(line => {
                 if (line.classList.contains('grid-line-vertical')) {
                     const lineX = parseInt(line.style.left);
                     // Snap left edge
                     if (!snappedX && Math.abs(checkX - lineX) < snapThreshold) { finalX = lineX; snappedX = true; }
                     // Snap right edge
                     if (!snappedX && Math.abs(checkRight - lineX) < snapThreshold) { finalX = lineX - this.draggedElement.offsetWidth; snappedX = true; }
                 } else { // Horizontal line
                     const lineY = parseInt(line.style.top);
                     // Snap top edge
                     if (!snappedY && Math.abs(checkY - lineY) < snapThreshold) { finalY = lineY; snappedY = true; }
                     // Snap bottom edge
                     if (!snappedY && Math.abs(checkBottom - lineY) < snapThreshold) { finalY = lineY - this.draggedElement.offsetHeight; snappedY = true; }
                 }
             });
             // Re-apply bounds after snapping
             finalX = Math.max(minX, Math.min(finalX, maxX));
             finalY = Math.max(minY, finalY);
         }


         // Apply final position
         // OPTIMISM_UTILS.log(`Dragging ${this.draggedElement.dataset.id} to style: ${finalX}, ${finalY}`);
         this.draggedElement.style.left = `${finalX}px`;
         this.draggedElement.style.top = `${finalY}px`;
         this.draggedElement.dataset.numX = finalX; // Store numeric position
         this.draggedElement.dataset.numY = finalY;
         OPTIMISM_UTILS.log(`Dragging element style set to: left=${this.draggedElement.style.left}, top=${this.draggedElement.style.top}`);


         // --- Update Drop Target Highlighting ---
         this.updateDropTargets(event);
    }

    handleDocumentDragOver(event) {
         event.preventDefault(); // Necessary to allow drop
         // Show drop zone only for external file/image drags
         if (!this.draggedElement && !this.inboxDragTarget && !this.arenaImageBeingDragged) {
              // Check if files are being dragged
              if (event.dataTransfer.types.includes('Files')) {
                   this.view.showDropZone();
              }
         } else if (this.arenaImageBeingDragged) {
              this.view.showDropZone('Drop Are.na image here'); // Specific message
         } else {
              this.view.hideDropZone(); // Hide if dragging internal elements
         }
    }

     handleWorkspaceDragOver(event) {
          event.preventDefault(); // Allow drop
          // Indicate workspace is a valid drop target for inbox items
          if (this.inboxDragTarget) {
               event.dataTransfer.dropEffect = 'move';
               // Optionally add a workspace highlight class here
               // this.view.workspace.classList.add('inbox-drop-target');
          }
     }

     handleTitleBarDragOver(event) {
          // Only handle if dragging a workspace element
          if (!this.draggedElement) return;
          event.preventDefault(); // Allow drop
          event.stopPropagation();
           // Highlighting handled by updateDropTargets during mousemove
     }

     handleInboxDragEnter(event) {
          if (!this.draggedElement) return; // Only handle workspace elements being dragged TO inbox
          event.preventDefault();
          event.stopPropagation();
          this.isOverInbox = true;
          this.updateDropTargets(event); // Update highlighting
          // Hide style panel if dragging over inbox
          this.view.panelManager.hidePanel('style');
     }


    // --- Drag Leave Handlers ---

    handleDocumentDragLeave(event) {
         // Hide drop zone if cursor leaves the window entirely
         if (!event.relatedTarget || event.relatedTarget.nodeName === 'HTML') {
             this.view.hideDropZone();
              this.arenaImageBeingDragged = null; // Cancel Arena drag if leaving window
         }
    }

     handleWorkspaceDragLeave(event) {
           // Remove workspace highlight if added in dragover
           // this.view.workspace.classList.remove('inbox-drop-target');
     }

     handleTitleBarDragLeave(event) {
          // Clear title bar highlights if mouse leaves the area
          const titleBar = document.getElementById('title-bar');
           if (titleBar && !titleBar.contains(event.relatedTarget)) {
               this.clearNavigationHighlights();
           }
     }

     handleInboxDragLeave(event) {
          const inboxToggle = document.getElementById('inbox-toggle');
          const inboxPanel = document.getElementById('inbox-panel');
          const relatedTarget = event.relatedTarget;

           // Check if the mouse is leaving both the toggle and the panel
          const leavingToggle = inboxToggle ? !inboxToggle.contains(relatedTarget) : true;
          const leavingPanel = inboxPanel ? !inboxPanel.contains(relatedTarget) : true;

          if (leavingToggle && leavingPanel) {
               this.isOverInbox = false;
               this.updateDropTargets(event); // Update highlighting
          }
     }

    // --- Drop Handlers ---

    handleMouseUp(event) {
         // --- Handle End of Workspace Element Drag ---
         if (this.draggedElement) {
             const draggedId = this.draggedElement.dataset.id;
             const type = this.draggedElement.dataset.type;

             // Final lock check
             if (this.model.isCardLocked(draggedId) || (type === 'image' && this.model.imagesLocked)) {
                  this.cancelDrag(); // Just resets state
                  OPTIMISM_UTILS.log(`MouseUp cancelled for locked element ${draggedId}`);
                  return;
             }

             this.draggedElement.classList.remove('dragging');

             // --- Determine Drop Action ---
             let dropActionTaken = false;

             if (this.isOverInbox) {
                  OPTIMISM_UTILS.log(`DragDropManager: Element ${draggedId} dropped onto Inbox`);
                  this.controller.moveToInbox(draggedId);
                  dropActionTaken = true;
             } else if (this.currentBreadcrumbTargetIndex !== null) {
                  OPTIMISM_UTILS.log(`DragDropManager: Element ${draggedId} dropped onto Breadcrumb index ${this.currentBreadcrumbTargetIndex}`);
                  this.controller.moveElementToBreadcrumb(draggedId, this.currentBreadcrumbTargetIndex);
                  dropActionTaken = true;
             } else if (this.isOverQuickLinks) {
                  OPTIMISM_UTILS.log(`DragDropManager: Element ${draggedId} dropped onto Quick Links`);
                   const element = this.model.findElement(draggedId); // Get data for title
                   if (element) {
                       let title = (element.type === 'text' && element.text) ? element.text.substring(0, 60) : (element.type === 'image' ? 'Image' : 'Untitled');
                       this.controller.addQuickLink(draggedId, title);
                       // Snap back visually (model handles data)
                       this.snapDraggedElementBack();
                       dropActionTaken = true; // Even though snapped back, action was adding link
                   }
             } else if (this.currentDropTarget && !this.model.isNestingDisabled) {
                 OPTIMISM_UTILS.log(`DragDropManager: Element ${draggedId} dropped onto element ${this.currentDropTarget.dataset.id}`);
                 this.controller.moveElement(draggedId, this.currentDropTarget.dataset.id);
                 dropActionTaken = true;
             }

             // --- Update Position if No Specific Drop Action ---
             if (!dropActionTaken) {
                 const finalX = parseFloat(this.draggedElement.dataset.numX);
                 const finalY = parseFloat(this.draggedElement.dataset.numY);
                  const originalX = parseFloat(this.draggedElement.dataset.originalLeft || finalX); // Fallback needed?
                  const originalY = parseFloat(this.draggedElement.dataset.originalTop || finalY);

                  OPTIMISM_UTILS.log(`Final Pos: ${finalX},${finalY} | Original Pos: ${originalX},${originalY}`);

                  // Only update if position actually changed significantly
                  if (Math.abs(finalX - originalX) > 0.1 || Math.abs(finalY - originalY) > 0.1) {
                     OPTIMISM_UTILS.log(`DragDropManager: Element ${draggedId} moved to (${finalX}, ${finalY})`);
                      const updateProps = { x: finalX, y: finalY };
                      // Update zIndex for images moved freely
                      OPTIMISM_UTILS.log(`Updating position for ${draggedId} via controller...`);
                      if (type === 'image') {
                          const newZIndex = this.view.renderer.element.findHighestImageZIndex() + 1;
                           updateProps.zIndex = Math.min(newZIndex, 99);
                      }
                     this.controller.updateElement(draggedId, updateProps)
                          .catch(err => OPTIMISM_UTILS.logError(`Error updating element position for ${draggedId}`, err)); // Add catch
                  } else {
                       OPTIMISM_UTILS.log(`DragDropManager: Element ${draggedId} position effectively unchanged.`);
                       // If it wasn't dropped on a target and didn't move, re-show style panel?
                       if(type === 'text' && !this.isOverInbox) this.view.panelManager.updatePanelVisibility('style', true);
                  }
             }

             // --- Cleanup ---
             this.clearDragState();
              this.clearAllHighlights();
              this.view.updateSpacerPosition(); // Update spacer after potential moves
         }

         // --- Handle End of Inbox Card Drag ---
         // Drop handled by workspace listener if successful
         if (this.inboxDragTarget) {
             this.inboxDragTarget.classList.remove('dragging');
             this.inboxDragTarget = null;
             // Workspace highlight removal handled by its dragleave/drop
         }
    }

    handleWorkspaceDrop(event) {
        if (this.inboxDragTarget) { // Check if the drag originated from the inbox
             event.preventDefault();
             event.stopPropagation(); // Prevent document drop handler

             const cardId = event.dataTransfer.getData('text/plain');
             if (cardId) {
                 const rect = this.view.workspace.getBoundingClientRect();
                 const x = event.clientX - rect.left + this.view.workspace.scrollLeft;
                 const y = event.clientY - rect.top + this.view.workspace.scrollTop;
                 OPTIMISM_UTILS.log(`DragDropManager: Inbox card ${cardId} dropped on workspace at (${x}, ${y})`);
                 this.controller.moveFromInboxToCanvas(cardId, x, y);
             }
             // State cleared in mouseup/dragend
        }
        // Allow external file drops to fall through to the document handler
    }


    handleDocumentDrop(event) {
        // Prevent default only if we handle the drop
        // Allow drop to proceed if it wasn't something we explicitly started dragging

        if (this.draggedElement || this.inboxDragTarget) {
             // If dragging internal elements, mouseup handles it, ignore drop here
             // This prevents trying to process internal drags as external file drops
             return;
        }

         event.preventDefault();
         this.view.hideDropZone(); // Always hide zone on drop

         const rect = this.view.workspace.getBoundingClientRect();
         const x = event.clientX - rect.left + this.view.workspace.scrollLeft;
         const y = event.clientY - rect.top + this.view.workspace.scrollTop;

         let handled = false;

         // --- Handle Arena Image Drop ---
         if (this.arenaImageBeingDragged) {
             OPTIMISM_UTILS.log(`DragDropManager: Arena image dropped: ${this.arenaImageBeingDragged}`);
             this.view.showLoading('Adding image from Are.na...');
             this.controller.addImageFromUrl(this.arenaImageBeingDragged, x, y)
                 .then(() => handled = true)
                 .catch(err => alert('Failed to add image from Are.na.'))
                 .finally(() => {
                      this.view.hideLoading();
                      this.arenaImageBeingDragged = null; // Clear state AFTER attempt
                 });
             return; // Handled (or attempted)
         }

         // --- Handle External File Drop ---
         if (event.dataTransfer.files.length > 0) {
             const file = event.dataTransfer.files[0];
             if (file.type.startsWith('image/')) {
                  OPTIMISM_UTILS.log(`DragDropManager: External image file dropped: ${file.name}`);
                  this.view.showLoading('Adding dropped image...');
                  this.controller.addImage(file, x, y)
                      .then(() => handled = true)
                      .catch(err => alert('Failed to add dropped image file.'))
                      .finally(() => this.view.hideLoading());
                  return; // Handled (or attempted)
             } else {
                  OPTIMISM_UTILS.log(`Dropped file is not an image: ${file.type}`);
             }
         }

        // --- Handle URL/Text Drop (potentially images) ---
        const types = event.dataTransfer.types;
        if (types.includes('text/uri-list') || types.includes('text/plain')) {
             const url = event.dataTransfer.getData('text/uri-list') || event.dataTransfer.getData('text/plain');
             if (url && url.match(/^https?:\/\//i)) { // Basic URL check
                  OPTIMISM_UTILS.log(`DragDropManager: URL dropped: ${url}`);
                  this.view.showLoading('Adding image from URL...');
                  this.controller.addImageFromUrl(url, x, y)
                      .then(() => handled = true)
                      .catch(err => { /* Logged in controller, maybe no alert here */ })
                      .finally(() => this.view.hideLoading());
                  return; // Attempted
             }
        }

        // TODO: Handle HTML drop (img tags, base64) if necessary

         if (!handled) {
              OPTIMISM_UTILS.log('Dropped content could not be processed as an image or URL.');
              // Optionally provide feedback: alert('Cannot process dropped content.');
         }
    }

    // --- Highlighting and Target Finding ---

    updateDropTargets(event) {
         // 1. Clear previous highlights and reset state
         this.clearAllHighlights();
         this.currentDropTarget = null;
         this.currentBreadcrumbTargetIndex = null;
         this.isOverQuickLinks = false;
         // isOverInbox state managed by its specific enter/leave handlers

         // 2. Check potential targets based on cursor position

         // Check Inbox (uses isOverInbox state updated by enter/leave)
         if (this.isOverInbox) {
              const inboxToggle = document.getElementById('inbox-toggle');
              const inboxPanel = document.getElementById('inbox-panel');
              if(inboxToggle) inboxToggle.classList.add('drag-highlight');
              if(inboxPanel) inboxPanel.classList.add('drag-highlight'); // Highlight panel too
              return; // Inbox takes precedence
         }

         // Check Title Bar (Breadcrumbs / Quick Links)
         const titleBar = document.getElementById('title-bar');
         if (titleBar && titleBar.contains(event.target)) {
              // Check Breadcrumbs
              const breadcrumb = this.findBreadcrumbDropTarget(event);
              if (breadcrumb) {
                   this.currentBreadcrumbTargetIndex = parseInt(breadcrumb.dataset.index);
                   this.view.renderer.navigation.highlightBreadcrumbTarget(this.currentBreadcrumbTargetIndex, true);
                   return; // Found breadcrumb target
              }
              // Check Quick Links Area
              if (this.isOverQuickLinksArea(event)) {
                   this.isOverQuickLinks = true;
                   this.view.renderer.navigation.highlightQuickLinkTarget(true);
                   return; // Found quick link target
              }
         }

         // Check Elements for Nesting (if enabled)
         if (!this.model.isNestingDisabled) {
             const elementTarget = this.findNestingDropTarget(event);
             if (elementTarget) {
                 this.currentDropTarget = elementTarget;
                 elementTarget.classList.add('drag-over');
                 return; // Found element target
             }
         }
    }

     // Finds the breadcrumb element under the cursor
     findBreadcrumbDropTarget(e) {
          const breadcrumbs = document.querySelectorAll('#breadcrumb-container .breadcrumb-item');
          // Only allow dropping on previous levels (not the last/current one)
          for (let i = 0; i < breadcrumbs.length - 1; i++) {
               const crumb = breadcrumbs[i];
               const rect = crumb.getBoundingClientRect();
               if (e.clientX >= rect.left && e.clientX <= rect.right &&
                   e.clientY >= rect.top && e.clientY <= rect.bottom) {
                    return crumb; // Return the DOM element
               }
          }
          return null;
     }

     // Checks if the cursor is over the approximate quick links area in the title bar
     isOverQuickLinksArea(e) {
          const titleBar = document.getElementById('title-bar');
          if (!titleBar || !titleBar.contains(e.target)) return false;
          const rect = titleBar.getBoundingClientRect();
          // Check middle 40% of the title bar width
          const leftBound = rect.left + rect.width * 0.3;
          const rightBound = rect.right - rect.width * 0.3;
          return e.clientX >= leftBound && e.clientX <= rightBound;
     }

     // Finds an element suitable for nesting under the cursor
     findNestingDropTarget(e) {
          // Get elements under point, exclude self, check locks/type
          const elements = document.elementsFromPoint(e.clientX, e.clientY);
          for (const element of elements) {
               if (element.classList.contains('element-container') && element !== this.draggedElement) {
                    // Cannot drop onto locked cards or images
                    if (element.classList.contains('card-locked')) continue;
                    if (element.dataset.type === 'image' && this.model.imagesLocked) continue;
                    // Found valid target
                    return element;
               }
          }
          return null;
     }


    // --- Cleanup and State Reset ---

    clearDragState() {
        if (this.draggedElement) {
             this.draggedElement.classList.remove('dragging');
             // Clear dataset properties used during drag
              delete this.draggedElement.dataset.originalLeft;
              delete this.draggedElement.dataset.originalTop;
              delete this.draggedElement.dataset.numX;
              delete this.draggedElement.dataset.numY;
        }
        if (this.inboxDragTarget) {
             this.inboxDragTarget.classList.remove('dragging');
        }
        this.draggedElement = null;
        this.inboxDragTarget = null;
        this.arenaImageBeingDragged = null;
        this.elemOffsetX = 0;
        this.elemOffsetY = 0;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.currentDropTarget = null;
        this.currentBreadcrumbTargetIndex = null;
        this.isOverQuickLinks = false;
        this.isOverInbox = false;
         // OPTIMISM_UTILS.log("Drag state cleared.");
    }

     clearAllHighlights() {
          document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
          document.querySelectorAll('.drag-highlight').forEach(el => el.classList.remove('drag-highlight'));
          const inboxToggle = document.getElementById('inbox-toggle');
          const inboxPanel = document.getElementById('inbox-panel');
          if(inboxToggle) inboxToggle.classList.remove('drag-highlight');
          if(inboxPanel) inboxPanel.classList.remove('drag-highlight');
          this.view.renderer.navigation.clearAllHighlights(); // Clear nav highlights
     }

     cancelDrag() {
          if (this.draggedElement) {
              // Snap back to original position if stored
               this.snapDraggedElementBack();
          }
          this.clearDragState();
           this.clearAllHighlights();
          OPTIMISM_UTILS.log("Drag cancelled.");
     }

     snapDraggedElementBack() {
         if (!this.draggedElement) return;
         const originalLeft = this.draggedElement.dataset.originalLeft;
         const originalTop = this.draggedElement.dataset.originalTop;
         if (originalLeft && originalTop) {
             this.draggedElement.style.left = originalLeft;
             this.draggedElement.style.top = originalTop;
             OPTIMISM_UTILS.log("Snapped dragged element back to original position.");
         }
     }

     // --- Arena Message Handling ---
     handleArenaMessage(event) {
          // Check origin for security if iframe source is external
          // if (event.origin !== "expected_arena_origin") return;

          if (event.data?.type === 'arenaImageDragStart') {
               this.arenaImageBeingDragged = event.data.imageUrl;
               this.view.showDropZone('Drop Are.na image here');
               OPTIMISM_UTILS.log(`Arena drag started: ${this.arenaImageBeingDragged}`);
          } else if (event.data?.type === 'arenaImageDragEnd') {
               // Use timeout to allow drop event to process first
               setTimeout(() => {
                   if (this.arenaImageBeingDragged) { // Check if drop didn't already clear it
                        OPTIMISM_UTILS.log('Arena drag ended (timeout check)');
                        this.arenaImageBeingDragged = null;
                        this.view.hideDropZone();
                   }
               }, 100);
          }
     }

} // End DragDropManager Class
