import { OPTIMISM_UTILS } from '../utils.js';

export class PanelManager {
    constructor(model, controller, view) {
        this.model = model;
        this.controller = controller;
        this.view = view; // Reference to main view for accessing other managers/renderers

        // Panel element references (will be populated in setup)
        this.panels = {
            style: null,
            settings: null,
            inbox: null,
            grid: null,
            priorities: null,
            todoist: null, // Added
            arena: null // Track arena viewport as well (though managed by ArenaManager)
        };
         // Toggle button references
         this.toggles = {
              settings: null,
              inbox: null,
              grid: null, // Toggle is inside settings panel now
              todoist: null, // Added
              priorities: null,
              arena: null,
              // Style panel has no dedicated toggle button
         };
    }

    // Called once during view initialization
    setupPanels() {
        // console.error("%%%%% PanelManager.setupPanels() IS BEING CALLED %%%%%"); // Remove debug log
        OPTIMISM_UTILS.log("PanelManager: Setting up panels...");

        // Find panel elements
        this.panels.style = document.getElementById('style-panel');
        // ... find other panel elements ...

        this.panels.settings = document.getElementById('settings-panel');
        this.panels.inbox = document.getElementById('inbox-panel');
        this.panels.grid = document.getElementById('grid-panel');
        this.panels.priorities = document.getElementById('priorities-panel');
        this.panels.todoist = document.getElementById('todoist-panel'); // Added
        this.panels.arena = document.getElementById('arena-viewport'); // Find arena if it exists at setup time

        // Find toggle buttons
        this.toggles.settings = document.getElementById('settings-toggle');
        // *** REMOVE Button Creation Logic - Assume buttons exist in HTML ***
        this.toggles.inbox = document.getElementById('inbox-toggle');
        this.toggles.priorities = document.getElementById('priorities-toggle');
        this.toggles.todoist = document.getElementById('todoist-toggle'); // Added
         this.toggles.arena = document.getElementById('arena-toggle');
         this.toggles.grid = document.getElementById('settings-grid-button'); // Still need reference for settings manager interaction? Maybe not needed here.
         // *** END REMOVAL ***


        // --- Attach Toggle Listeners ---
        if (this.toggles.settings) {
            this.toggles.settings.addEventListener('click', (e) => {
                e.stopPropagation();
                this.controller.toggleSettingsVisibility();
            });
        } // Removed error log as button presence is assumed from HTML

        if (this.toggles.inbox) {
             this.toggles.inbox.addEventListener('click', (e) => {
                  e.stopPropagation();
                  this.controller.toggleInboxVisibility();
             });
        } // Removed error log

        if (this.toggles.priorities) {
             this.toggles.priorities.addEventListener('click', (e) => {
                  e.stopPropagation();
                  this.controller.togglePrioritiesVisibility();
             });
        } // Removed error log

        if (this.toggles.todoist) {
            // Listener added by TodoistManager itself to control disabled state
            // this.toggles.todoist.addEventListener('click', (e) => { ... });
        } else {
            OPTIMISM_UTILS.logError("PanelManager: Todoist toggle button (#todoist-toggle) not found.");
        }


        // REMOVE Arena Toggle Listener Attachment from PanelManager
        // ArenaManager handles its own toggle button listener
        // if (this.toggles.arena) {
        //      this.toggles.arena.addEventListener('click', (e) => {
        //           e.stopPropagation();
        //           this.controller.toggleArenaView();
        //      });
        // } // Removed error log

        // REMOVE: Grid toggle listener attachment - SettingsManager handles this now
        // else {
        //      OPTIMISM_UTILS.logError("PanelManager: Grid toggle button (inside settings) not found.");
        // }


         // Pass panel elements to PanelRenderer so it knows where to render content
         if (this.view.renderer.panel) {
              this.view.renderer.panel.assignPanelElements({
                  style: this.panels.style,
                  settings: this.panels.settings,
                  inbox: this.panels.inbox,
                  grid: this.panels.grid,
                  priorities: this.panels.priorities,
                  todoist: this.panels.todoist, // Added
              });
         } else {
             OPTIMISM_UTILS.logError("PanelManager: PanelRenderer not available on view.");
         }

        OPTIMISM_UTILS.log("PanelManager: Panel setup complete.");
    }


    // --- Visibility Control ---

    // Updates the display style of a specific panel based on model state
    updatePanelVisibility(panelName, isVisible) {
         // Find the panel element reference
         const panelElement = this.panels[panelName];

         // Handle Arena separately via its manager
         if (panelName === 'arena') {
              this.view.managers.arena.updateLayout(isVisible);
              return;
         }

         // If panel element doesn't exist (e.g., style panel not in DOM initially)
         if (!panelElement) {
              // Log if it's an unexpected missing panel (ignore style/arena)
              if(panelName !== 'style' && panelName !== 'arena') {
                  OPTIMISM_UTILS.logError(`PanelManager: Panel element "${panelName}" not found during visibility update.`);
              }
              return;
         }

         // Grid Panel specifically needs grid lines rendered/cleared too,
         // *in addition* to renderWorkspace handling the general state.
         // This ensures lines appear/disappear *with the panel*.
         // We check model state directly here, not the 'isVisible' param for the specific panel changing
         if (panelName === 'grid') {
             if (this.model.panels.grid) this.view.renderer.grid.renderGrid();
             else this.view.renderer.grid.clearGrid();
         }

         const shouldDisplay = isVisible ? 'block' : 'none';

         if (panelElement.style.display !== shouldDisplay) {
              panelElement.style.display = shouldDisplay;
               OPTIMISM_UTILS.log(`PanelManager: Set ${panelName} display to ${shouldDisplay}`);
         }

         // If showing a panel, ensure its content is up-to-date and adjust layout
         if (isVisible) {
             this.updatePanelContent(panelName); // Render content if needed
             // Layout adjustment is now handled by CSS only
         }
    }

    // Calls the appropriate renderer to update content when a panel becomes visible
    updatePanelContent(panelName) {
         try {
             switch(panelName) {
                  case 'inbox':
                       this.view.renderer.panel.renderInboxPanel();
                       break;
                  case 'priorities':
                       this.view.renderer.panel.renderPrioritiesPanel();
                       break;
                 case 'todoist':
                       // Content updated by controller fetching tasks if connected
                       // Maybe trigger a fetch here if not already loading?
                       break;
                  case 'style':
                       // Style panel content updated on element selection
                        const selectedElement = this.model.selectedElement ? this.model.findElementGlobally(this.model.selectedElement) : null;
                        if(selectedElement && selectedElement.type === 'text') { // Only for text elements
                             this.view.renderer.panel.updateStylePanelOptions(selectedElement);
                        } else {
                             // Hide style panel if selected element is not text or no element selected
                             this.hidePanel('style');
                        }
                       break;
                   case 'grid':
                        this.view.renderer.panel.updateGridPanelOptions();
                        break;
                  case 'settings':
                        // Settings panel content is mostly static, but update button states
                        this.view.managers.settings.updateAllButtonStates();
                        break;
             }
         } catch (error) {
              OPTIMISM_UTILS.logError(`Error updating content for panel ${panelName}:`, error);
         }
    }

     // Checks if a specific panel is currently visible based on its display style
     isPanelVisible(panelName) {
          const panelElement = this.panels[panelName];
          return panelElement?.style.display === 'block';
     }

     // Explicitly hides a panel (can be called by other managers/logic)
     hidePanel(panelName) {
          // Only hide if currently visible according to DOM
          // Check model state instead of DOM state to avoid race conditions
           if (this.model.panels[panelName]) {
                OPTIMISM_UTILS.log(`PanelManager: Hiding panel ${panelName} explicitly.`);
                // Use controller toggle method to ensure model state is updated IF it exists
                 // The generic toggle will set it to false if it's currently true
                 this.controller.togglePanel(panelName);
                } else {
                      // OPTIMISM_UTILS.log(`PanelManager: Panel ${panelName} is already hidden in model state.`);
                }
          }


     // REMOVED adjustWorkspaceLayout - CSS handles layout now

    // Syncs the display style of ALL panels based ONLY on the model state
    // This is the single function to call after model state changes
    syncPanelsWithModelState() {
         OPTIMISM_UTILS.log("PanelManager: Syncing panel display with model state...");
         for (const panelName in this.model.panels) {
              this.updatePanelVisibility(panelName, this.model.panels[panelName]);
         }
         OPTIMISM_UTILS.log("PanelManager: Panel display sync complete.");
     }

     // *** ADDED FROM PREVIOUS VERSION - NEEDED FOR CONTROLLER FALLBACK ***
     // Syncs visibility of all panels based on model state (alternative name)
     syncAllPanelVisibilities() {
          OPTIMISM_UTILS.logWarn("PanelManager: Using syncAllPanelVisibilities (consider syncPanelsWithModelState).");
          this.syncPanelsWithModelState();
     }


} // End PanelManager Class
