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
            arena: null // Track arena viewport as well (though managed by ArenaManager)
        };
         // Toggle button references
         this.toggles = {
              settings: null,
              inbox: null,
              grid: null, // Toggle is inside settings panel now
              priorities: null,
              arena: null,
              // Style panel has no dedicated toggle button
         };
    }

    // Called once during view initialization
    setupPanels() {
        OPTIMISM_UTILS.log("PanelManager: Setting up panels...");

        // Find panel elements from the DOM
        this.panels.style = document.getElementById('style-panel');
        this.panels.settings = document.getElementById('settings-panel');
        this.panels.inbox = document.getElementById('inbox-panel');
        this.panels.grid = document.getElementById('grid-panel');
        this.panels.priorities = document.getElementById('priorities-panel');
        this.panels.arena = document.getElementById('arena-viewport'); // Find arena if it exists at setup time

        // Find toggle buttons
        this.toggles.settings = document.getElementById('settings-toggle');
        this.toggles.inbox = document.getElementById('inbox-toggle');
        this.toggles.priorities = document.getElementById('priorities-toggle');
         this.toggles.arena = document.getElementById('arena-toggle');
         // REMOVE: Grid toggle button lookup - SettingsManager handles this now
         // this.toggles.grid = document.getElementById('settings-grid-button');


        // --- Attach Toggle Listeners ---
        if (this.toggles.settings) {
            this.toggles.settings.addEventListener('click', (e) => {
                e.stopPropagation();
                this.controller.toggleSettingsVisibility();
            });
        } else { OPTIMISM_UTILS.logError("PanelManager: Settings toggle button not found."); }

        if (this.toggles.inbox) {
             this.toggles.inbox.addEventListener('click', (e) => {
                  e.stopPropagation();
                  this.controller.toggleInboxVisibility();
             });
        } else { OPTIMISM_UTILS.logError("PanelManager: Inbox toggle button not found."); }

        if (this.toggles.priorities) {
             this.toggles.priorities.addEventListener('click', (e) => {
                  e.stopPropagation();
                  this.controller.togglePrioritiesVisibility();
             });
        } else { OPTIMISM_UTILS.logError("PanelManager: Priorities toggle button not found."); }

        if (this.toggles.arena) {
             this.toggles.arena.addEventListener('click', (e) => {
                  e.stopPropagation();
                  this.controller.toggleArenaView();
             });
        } else { OPTIMISM_UTILS.logError("PanelManager: Arena toggle button not found."); }

        // REMOVE: Grid toggle listener attachment - SettingsManager handles this now
        // else {
        //      OPTIMISM_UTILS.logError("PanelManager: Grid toggle button (inside settings) not found.");
        // }


        // --- Global Click Listener for Closing Panels ---
        // This listener helps close panels when clicking outside them
        document.addEventListener('click', (e) => this.handleGlobalClick(e));

         // Pass panel elements to PanelRenderer so it knows where to render content
         if (this.view.renderer.panel) {
              this.view.renderer.panel.assignPanelElements({
                  style: this.panels.style,
                  settings: this.panels.settings,
                  inbox: this.panels.inbox,
                  grid: this.panels.grid,
                  priorities: this.panels.priorities
              });
         } else {
             OPTIMISM_UTILS.logError("PanelManager: PanelRenderer not available on view.");
         }

        OPTIMISM_UTILS.log("PanelManager: Panel setup complete.");
    }

     // Handles clicks outside of open panels to close them
     handleGlobalClick(event) {
          // Check which panel might be open and needs closing
          for (const panelName in this.panels) {
               // Skip style panel (closed by selection logic) and Arena viewport
               if (panelName === 'style' || panelName === 'arena' || !this.panels[panelName]) {
                   continue;
               }

               const panelElement = this.panels[panelName];
               const toggleElement = this.toggles[panelName];

               // Check if the panel is currently visible (using style.display)
               // Important: Only check panels managed directly (not style/arena)
               if (panelElement.style.display === 'block') {
                   // Check if the click was outside the panel AND outside its toggle button
                   const clickedOutsidePanel = !panelElement.contains(event.target);
                   // Check toggle existence before accessing contains
                   const clickedOutsideToggle = toggleElement ? !toggleElement.contains(event.target) : true;

                   // Exception: Don't close Settings when clicking the Grid toggle inside it
                   // const clickedGridToggleInSettings = panelName === 'settings' && event.target === this.toggles.grid; // Grid toggle handled by SettingsManager now
                   const clickedGridToggleInSettings = false; // Simplified: Assume SettingsManager handles its internal clicks

                   if (clickedOutsidePanel && clickedOutsideToggle && !clickedGridToggleInSettings) {
                        OPTIMISM_UTILS.log(`Global click detected outside of open panel: ${panelName}. Closing.`);
                        // Use controller to toggle off, ensuring model state updates
                        // This assumes controller methods exist for each panel type
                        const toggleMethodName = `toggle${panelName.charAt(0).toUpperCase() + panelName.slice(1)}Visibility`;
                        if (typeof this.controller[toggleMethodName] === 'function') {
                             this.controllertoggleMethodName;
                        } else {
                             OPTIMISM_UTILS.logError(`PanelManager: No controller method found for toggling panel ${panelName}`);
                        }
                   }
               }
          }
     }


    // --- Visibility Control ---

    // Updates the display style of a specific panel based on model state
    updatePanelVisibility(panelName, isVisible) {
         // Find the panel element reference
         const panelElement = this.panels[panelName];

         // Handle Arena separately via its manager
         if (panelName === 'arena') {
              this.view.arenaManager.updateLayout(isVisible);
              return;
         }

         // If panel element doesn't exist (e.g., style panel not in DOM initially)
         if (!panelElement) {
              // Log if it's an unexpected missing panel
              if(panelName !== 'style' && panelName !== 'arena') {
                  OPTIMISM_UTILS.logError(`PanelManager: Panel element "${panelName}" not found during visibility update.`);
              }
              return;
         }

         const shouldDisplay = isVisible ? 'block' : 'none';

         if (panelElement.style.display !== shouldDisplay) {
              panelElement.style.display = shouldDisplay;
               OPTIMISM_UTILS.log(`PanelManager: Set ${panelName} display to ${shouldDisplay}`);
         }

         // If showing a panel, ensure its content is up-to-date and adjust layout
         if (isVisible) {
              this.updatePanelContent(panelName); // Render content if needed
              // NO NEED to call adjustWorkspaceLayout anymore
         }
         // No adjustment needed when hiding either
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
                        this.view.settingsManager.updateAllButtonStates();
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
          if (this.isPanelVisible(panelName)) {
                OPTIMISM_UTILS.log(`PanelManager: Hiding panel ${panelName} explicitly.`);
                // Use controller toggle method to ensure model state is updated IF it exists
                const toggleMethodName = `toggle${panelName.charAt(0).toUpperCase() + panelName.slice(1)}Visibility`;
                if (panelName !== 'style' && typeof this.controller[toggleMethodName] === 'function') {
                    // Call controller toggle ONLY if the model state thinks it's currently visible
                    if (this.model.panels[panelName]) {
                         this.controllertoggleMethodName;
                    } else {
                         // Model state is already false, just hide the DOM element
                         this.updatePanelVisibility(panelName, false);
                    }
                } else if (panelName === 'style') {
                     // Style panel has no model state, just hide DOM
                     if(this.panels.style) this.panels.style.style.display = 'none';
                } else {
                      // Fallback for panels without dedicated toggle methods (shouldn't happen with current structure)
                      this.updatePanelVisibility(panelName, false);
                }
          }
     }


    // Syncs all panel visibilities based on the current model state
    // This ensures the UI matches the model, e.g., after load or import
    syncAllPanelVisibilities() {
        OPTIMISM_UTILS.log("PanelManager: Syncing all panel visibilities...");
        let anySidePanelVisible = false;
        for (const panelName in this.model.panels) {
             // Ensure we have a panel element managed for this state key
             const shouldBeVisible = this.model.panels[panelName];
             this.updatePanelVisibility(panelName, shouldBeVisible); // Update display based on model
             if (shouldBeVisible && panelName !== 'arena' && panelName !== 'style') {
                 anySidePanelVisible = true; // Track if any *side* panel is open
             }
        }
         // REMOVED adjustWorkspaceLayout call - CSS handles layout now
         OPTIMISM_UTILS.log(`PanelManager: Sync complete.`);
    }

} // End PanelManager Class
