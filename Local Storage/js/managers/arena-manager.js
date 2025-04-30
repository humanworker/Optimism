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
            this.toggleButton.style.display = 'inline-block'; // Make button visible
            this.toggleButton.addEventListener('click', () => {
                this.controller.toggleArenaView();
            });
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
             document.body.classList.remove('arena-view-active');
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

        // Optionally add shadow (can also be done with CSS ::before/::after)
        this._addShadow();

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

         if (showArena) {
              // Arena takes right 30%, workspace takes left 70%
              Object.assign(workspace.style, {
                   left: '0',
                   width: '70%', // Defined in CSS by body.arena-view-active
                   // overflow: 'auto', // Allow independent scrolling
                   // overflowY: 'auto',
                   // overflowX: 'hidden'
              });
               // Workspace scroll needs to be re-enabled after potential disabling
               // Use timeout to ensure layout updates apply first
              // setTimeout(() => {
              //     workspace.style.overflow = 'auto';
              //     workspace.style.overflowY = 'auto';
              // }, 50);
         } else {
            OPTIMISM_UTILS.log("ArenaManager: Restoring default workspace layout (handled by CSS).");
              // Restore workspace layout (handled by PanelManager based on other panels)
               // Ensure overflow is restored
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

     _addShadow() {
         if (!this.arenaViewport) return;
         let shadow = this.arenaViewport.querySelector('.arena-viewport-shadow');
         if (!shadow) {
              shadow = document.createElement('div');
              shadow.className = 'arena-viewport-shadow'; // Use class for styling
               Object.assign(shadow.style, { // Inline fallback/defaults
                  position: 'absolute', top: '0', left: '0', bottom: '0', width: '15px',
                  pointerEvents: 'none', zIndex: '5',
                  boxShadow: 'inset 10px 0 8px -8px rgba(0,0,0,0.2)',
                  background: 'linear-gradient(to right, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0) 100%)'
               });
              this.arenaViewport.appendChild(shadow);
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
            this.view.showDropZone('Drop Are.na image here');
            // OPTIMISM_UTILS.log(`Arena drag started via message: ${data.imageUrl}`);
        } else if (data.type === 'arenaImageDragEnd') {
            // Use timeout to allow potential drop event to clear the state first
            setTimeout(() => {
                 if (this.view.dragDropManager.arenaImageBeingDragged) { // Check if not already cleared
                      this.view.dragDropManager.arenaImageBeingDragged = null;
                      this.view.hideDropZone();
                       // OPTIMISM_UTILS.log('Arena drag ended via message (timeout check)');
                 }
            }, 100);
        }
         // Handle other message types if needed (e.g., cookie test responses)
    }

} // End ArenaManager Class
