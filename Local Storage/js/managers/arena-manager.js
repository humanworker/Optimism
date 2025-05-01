import { OPTIMISM_UTILS } from '../utils.js';

export class ArenaManager {
    constructor(model, controller, view) {
        this.model = model;
        this.controller = controller;
        this.view = view; // Reference to main view for DOM access

        this.arenaViewport = null; // Reference to the viewport container div
        this.arenaIframe = null;   // Reference to the iframe element
        this.toggleButton = null; // Reference to the toggle button
    }

    // Setup the toggle button and initial state
    setup() {
        OPTIMISM_UTILS.log("ArenaManager: Setting up...");
        this.toggleButton = document.getElementById('arena-toggle');

        if (this.toggleButton) {
            // *** Add check for existing listener ***
            this.toggleButton.style.display = 'inline-block'; // Make button visible
            if (this.toggleButton.dataset.listenerAttached === 'true') {
                 console.warn("%%%%% ArenaManager: Listener ALREADY attached to Arena toggle. Skipping.");
            } else {
                 console.error("%%%%% ArenaManager: Attaching listener to Arena toggle. %%%%%");
                 this.toggleButton.addEventListener('click', (e) => { // Add event 'e'
                     console.error("%%%%% Arena Toggle CLICKED (ArenaManager Listener) %%%%%");
                     e.stopPropagation(); // Add stopPropagation
                     e.preventDefault();  // Add preventDefault if it's an anchor/button
                     this.controller.toggleArenaView();
                 });
                 this.toggleButton.dataset.listenerAttached = 'true'; // Mark as attached
            }
            this._updateButtonText(); // Set initial text
        } else {
            OPTIMISM_UTILS.logError("ArenaManager: Toggle button (#arena-toggle) not found.");
        }

        // Initial layout update based on model state
        if (this.model.panels.arena) {
            this.updateLayout(true);
        }

        // Setup message listener for iframe communication (drag events)
        // Moved from view.js to keep Arena logic contained
        window.addEventListener('message', (e) => this._handleIframeMessage(e));

        OPTIMISM_UTILS.log("ArenaManager: Setup complete.");
    }

    // Handles showing/hiding the Arena panel and adjusting workspace layout
    updateLayout(showArena) {
        OPTIMISM_UTILS.log(`ArenaManager: Updating layout - Show Arena: ${showArena}`);

        // --- Force Hide Conflicting Left Panels ---
         if (showArena) {
              if (this.model.panels.inbox) {
                  OPTIMISM_UTILS.log("Arena enabling: Hiding Inbox panel.");
                  this.controller.toggleInboxVisibility(); // Use controller to update model state too
              }
              if (this.model.panels.priorities) {
                  OPTIMISM_UTILS.log("Arena enabling: Hiding Priorities panel.");
                  this.controller.togglePrioritiesVisibility();
              }
         }

        // --- Create/Remove Viewport ---
        if (showArena && !this.arenaViewport) {
            // Create viewport and iframe
            this._createArenaViewport();
             document.body.classList.add('arena-view-active'); // Add class for CSS adjustments
        } else if (!showArena && this.arenaViewport) {
            // Remove viewport
            this._removeArenaViewport();
             document.body.classList.remove('arena-view-active'); // Ensure class is removed
        }

        // --- Adjust Workspace ---
        this._adjustWorkspaceLayout(showArena);

        // --- Update Button ---
        this._updateButtonText();

        // --- Ensure correct z-indexing (might be handled globally) ---
        // this.view.panelManager.ensurePanelZIndices(); // If needed
    }

    _createArenaViewport() {
        if (this.arenaViewport) return; // Already exists
        OPTIMISM_UTILS.log("ArenaManager: Creating Arena viewport...");

        this.arenaViewport = document.createElement('div');
        this.arenaViewport.id = 'arena-viewport';
        // Styles applied via CSS primarily

        this.arenaIframe = document.createElement('iframe');
        this.arenaIframe.id = 'arena-iframe';
        this.arenaIframe.src = './arena/index.html'; // Path relative to index.html
        // Set necessary iframe attributes (sandbox, allow, etc.)
         Object.assign(this.arenaIframe.style, {
            width: '100%', height: '100%', border: 'none', display: 'block'
         });
         this.arenaIframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; camera; microphone; payment; geolocation');
         this.arenaIframe.setAttribute('allowfullscreen', 'true');
         this.arenaIframe.setAttribute('loading', 'eager');
         this.arenaIframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-popups allow-forms allow-downloads allow-popups-to-escape-sandbox');
         this.arenaIframe.setAttribute('referrerpolicy', 'origin');
         this.arenaIframe.setAttribute('importance', 'high');
         this.arenaIframe.setAttribute('crossorigin', 'anonymous'); // Needed if interacting across origins

        this.arenaViewport.appendChild(this.arenaIframe);
        document.body.appendChild(this.arenaViewport); // Append to body

        // REMOVE shadow creation call
        // this._addShadow();

        OPTIMISM_UTILS.log("ArenaManager: Viewport created.");
    }

    _removeArenaViewport() {
        if (!this.arenaViewport) return;
        OPTIMISM_UTILS.log("ArenaManager: Removing Arena viewport...");
        this.arenaViewport.remove();
        this.arenaViewport = null;
        this.arenaIframe = null;
        OPTIMISM_UTILS.log("ArenaManager: Viewport removed.");
    }

    _adjustWorkspaceLayout(showArena) {
         const workspace = this.view.workspace;
         if (!workspace) return;

         OPTIMISM_UTILS.log(`ArenaManager: Adjusting workspace for showArena = ${showArena}`);

         if (showArena) {
              // Styles are primarily handled by adding 'arena-view-active' class to body
              // We don't need to set inline styles here that duplicate the CSS
              OPTIMISM_UTILS.log("ArenaManager: Applying Arena active styles via CSS class.");
         } else {
              // Restore workspace layout (handled by PanelManager based on other panels)
               // Ensure overflow is restored (CSS should handle this ideally)
              OPTIMISM_UTILS.log("ArenaManager: Removing Arena active styles (CSS default will apply).");
               // Explicitly set overflow back if needed, though CSS should handle it
               // workspace.style.overflow = 'auto';
               // workspace.style.overflowY = 'auto';
         }
         // Trigger grid redraw if needed
         if (this.model.panels.grid) this.view.renderer.grid.renderGrid();
    }


    _updateButtonText() {
        if (this.toggleButton) {
            this.toggleButton.textContent = this.model.panels.arena ? 'Hide Are.na' : 'Show Are.na';
        }
    }

    // Handles messages from the Arena iframe (for drag events)
    _handleIframeMessage(event) {
        // Basic security check - verify origin if iframe source is external
        // if (event.origin !== "YOUR_IFRAME_EXPECTED_ORIGIN") return;

        const data = event.data;
        if (!data || !data.type) return;

        // Delegate drag events to the DragDropManager
        if (data.type === 'arenaImageDragStart' && data.imageUrl) {
            this.view.dragDropManager.arenaImageBeingDragged = data.imageUrl;
            // Defer showing drop zone slightly to avoid flicker if drag ends immediately
            setTimeout(() => { if(this.view.dragDropManager.arenaImageBeingDragged) this.view.showDropZone('Drop Are.na image here'); }, 50);
            // OPTIMISM_UTILS.log(`Arena drag started via message: ${data.imageUrl}`);
        } else if (data.type === 'arenaImageDragEnd') {
            // Use timeout to allow potential drop event to clear the state first
            setTimeout(() => {
                 if (this.view.dragDropManager.arenaImageBeingDragged) { // Check if not already cleared
                      this.view.dragDropManager.arenaImageBeingDragged = null;
                      // Only hide drop zone if it was shown for arena drag
                       this.view.hideDropZone();
                       // OPTIMISM_UTILS.log('Arena drag ended via message (timeout check)');
                 }
            }, 100);
        }
         // *** ADD LOGGING FOR IMAGE TRANSFER ***
         else if (data.type === 'arenaImageTransfer') { // Check this type matches iframe sender
            console.error(`%%%%% ArenaManager: Received '${data.type}' message %%%%%`, data); // Log specific type received
            const imageUrl = data.imageUrl; // Assuming the URL is sent directly now, not imageData
            if (!imageUrl) {
                 OPTIMISM_UTILS.logError('ArenaManager: No imageUrl received in arenaImageTransfer message.');
                 console.error("%%%%% ArenaManager: Image URL missing in message data. %%%%%");
                 return;
            }

            // Calculate center position (or use a fixed position for testing)
            const rect = this.view.workspace.getBoundingClientRect();
            const x = (rect.width / 2) + this.view.workspace.scrollLeft;
            const y = (rect.height / 2) + this.view.workspace.scrollTop;
            console.error(`%%%%% ArenaManager: Calling controller.addImageFromUrl for: ${imageUrl} at (${x}, ${y}) %%%%%`);

            this.view.showLoading('Adding image from Are.na...'); // Show loading indicator

            this.controller.addImageFromUrl(imageUrl, x, y)
                .then(newElementId => {
                    if (newElementId) {
                         OPTIMISM_UTILS.log(`ArenaManager: Successfully added Arena image via controller. New ID: ${newElementId}`);
                         console.error(`%%%%% ArenaManager: Success, new element ID: ${newElementId} %%%%%`);
                    } else {
                         OPTIMISM_UTILS.logError(`ArenaManager: controller.addImageFromUrl failed to add image for ${imageUrl}`);
                         console.error(`%%%%% ArenaManager: Failure from controller (no ID returned) %%%%%`);
                         alert('Failed to add image from Are.na. Controller action failed.');
                    }
                })
                .catch(error => {
                     OPTIMISM_UTILS.logError(`ArenaManager: Error during controller.addImageFromUrl for ${imageUrl}`, error);
                     console.error(`%%%%% ArenaManager: Catch block error: ${error.message} %%%%%`);
                     alert(`Failed to add image from Are.na: ${error.message}`);
                })
                .finally(() => {
                     this.view.hideLoading();
                });
        }
         // Handle other message types if needed (e.g., cookie test responses)
    }

} // End ArenaManager Class
