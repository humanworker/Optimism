import { OPTIMISM_UTILS } from '../utils.js';

export class PanelManager {
    constructor(model, controller, view) {
        this.model = model;
        this.controller = controller;
        this.view = view; // May need view reference for some actions

        // Panel element references (will be populated in setup)
        this.panels = {
            style: null,
            settings: null,
            inbox: null,
            grid: null,
            priorities: null,
             arena: null // Track arena viewport as well
        };
         // Toggle button references
         this.toggles = {
              settings: null,
              inbox: null,
              grid: null, // Toggle might be inside settings now
              priorities: null,
              arena: null,
              // Style panel has no dedicated toggle button
         };
    }

    // Called once during view initialization
    setupPanels() {
        OPTIMISM_UTILS.log("PanelManager: Setting up panels...");

        // Find panel elements
        this.panels.style = document.getElementById('style-panel');
        this.panels.settings = document.getElementById('settings-panel');
        this.panels.inbox = document.getElementById('inbox-panel');
        this.panels.grid = document.getElementById('grid-panel');
        this.panels.priorities = document.getElementById('priorities-panel');
         this.panels.arena = document.getElementById('arena-viewport'); // Find arena if it exists

        // Find toggle buttons
        this.toggles.settings = document.getElementById('settings-toggle');
        this.toggles.inbox = document.getElementById('inbox-toggle');
        this.toggles.priorities = document.getElementById('priorities-toggle');
         this.toggles.arena = document.getElementById('arena-toggle');
         // Grid toggle is inside settings panel now, handled there
         this.toggles.grid = document.getElementById('settings-grid-button'); // Reference the button inside settings


        // --- Attach Toggle Listeners ---
        if (this.toggles.settings) {
            this.toggles.settings.addEventListener('click', (e) => {
                e.stopPropagation();
                this.controller.toggleSettingsVisibility();
            });
        }
        if (this.toggles.inbox) {
             this.toggles.inbox.addEventListener('click', (e) => {
                  e.stopPropagation();
                  this.controller.toggleInboxVisibility();
             });
        }
        if (this.toggles.priorities) {
             this.toggles.priorities.addEventListener('click', (e) => {
                  e.stopPropagation();
                  this.controller.togglePrioritiesVisibility();
             });
        }
        if (this.toggles.arena) {
             this.toggles.arena.addEventListener('click', (e) => {
                  e.stopPropagation();
                  this.controller.toggleArenaView();
             });
        }
        if (this.toggles.grid) {
             this.toggles.grid.addEventListener('click', (e) => {
                  e.preventDefault(); // It's a link inside settings
                  e.stopPropagation();
                  this.controller.toggleGridVisibility(); // Toggle grid panel itself
                  // Hide settings panel when opening grid from it
                  this.hidePanel('settings');
             });
        }


        // --- Global Click Listener for Closing Panels ---
        document.addEventListener('click', (e) => this.handleGlobalClick(e));

         // Pass panel elements to PanelRenderer
         if (this.view.renderer.panel) {
              this.view.renderer.panel.assignPanelElements({
                  style: this.panels.style,
                  settings: this.panels.settings,
                  inbox: this.panels.inbox,
                  grid: this.panels.grid,
                  priorities: this.panels.priorities
              });
         }

        OPTIMISM_UTILS.log("PanelManager: Panel setup complete.");
    }

     // Handles clicks outside of open panels to close them
     handleGlobalClick(event) {
          for (const panelName in this.panels) {
               // Skip style panel (closed by selection logic) and Arena viewport
               if (panelName === 'style' || panelName === 'arena' || !this.panels[panelName]) continue;

               const panelElement = this.panels[panelName];
               const toggleElement = this.toggles[panelName];

               // Check if the panel is currently visible (using style.display)
               if (panelElement.style.display === 'block') {
                   // Check if the click was outside the panel AND outside its toggle button
                   const clickedOutsidePanel = !panelElement.contains(event.target);
                   const clickedOutsideToggle = toggleElement ? !toggleElement.contains(event.target) : true; // Assume outside if no toggle

                   // Exception: Don't close Settings when clicking Grid toggle inside it
                   const clickedGridToggleInSettings = panelName === 'settings' && event.target === this.toggles.grid;

                   if (clickedOutsidePanel && clickedOutsideToggle && !clickedGridToggleInSettings) {
                        OPTIMISM_UTILS.log(`Global click detected outside of open panel: ${panelName}. Closing.`);
                        // Use controller to toggle off, ensuring model state updates
                        switch(panelName) {
                             case 'settings': this.controller.toggleSettingsVisibility(); break;
                             case 'inbox': this.controller.toggleInboxVisibility(); break;
                             case 'grid': this.controller.toggleGridVisibility(); break;
                             case 'priorities': this.controller.togglePrioritiesVisibility(); break;
                             // Add cases for other panels if needed
                        }
                   }
               }
          }
     }


    // --- Visibility Control ---

    // Updates the display style of a specific panel based on model state
    updatePanelVisibility(panelName, isVisible) {
         if (!this.panels[panelName]) return; // Don't try to update non-existent panels

         // Special handling for Arena viewport
         if (panelName === 'arena') {
              this.view.arenaManager.updateLayout(isVisible); // Delegate to ArenaManager
              return;
         }

         const panelElement = this.panels[panelName];
         const shouldDisplay = isVisible ? 'block' : 'none';

         if (panelElement.style.display !== shouldDisplay) {
              panelElement.style.display = shouldDisplay;
               OPTIMISM_UTILS.log(`PanelManager: Set ${panelName} display to ${shouldDisplay}`);
         }

         // If showing a panel, ensure its content is up-to-date
         if (isVisible) {
              this.updatePanelContent(panelName);
         }
    }

    // Calls the appropriate renderer to update content when a panel becomes visible
    updatePanelContent(panelName) {
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
                    if(selectedElement) this.view.renderer.panel.updateStylePanelOptions(selectedElement);
                   break;
               case 'grid':
                    this.view.renderer.panel.updateGridPanelOptions();
                    break;
              case 'settings':
                    // Settings panel content is mostly static, but update button states
                    this.view.settingsManager.updateAllButtonStates();
                    break;
         }
    }

     // Checks if a specific panel is currently visible
     isPanelVisible(panelName) {
          return this.panels[panelName]?.style.display === 'block';
     }

     // Explicitly hides a panel (called by other managers/logic)
     hidePanel(panelName) {
          if (this.isPanelVisible(panelName)) {
               // Use controller toggle method to ensure model state is updated
                switch(panelName) {
                    case 'settings': this.controller.toggleSettingsVisibility(); break;
                    case 'inbox': this.controller.toggleInboxVisibility(); break;
                    case 'grid': this.controller.toggleGridVisibility(); break;
                    case 'priorities': this.controller.togglePrioritiesVisibility(); break;
                    case 'style':
                         if(this.panels.style) this.panels.style.style.display = 'none';
                         // No model state for style panel, just hide DOM
                         break;
                    // Add cases for other panels if needed
                }
          }
     }


    // Syncs all panel visibilities based on the current model state
    syncAllPanelVisibilities() {
        OPTIMISM_UTILS.log("PanelManager: Syncing all panel visibilities...");
        let anyPanelVisible = false;
        for (const panelName in this.model.panels) {
             const shouldBeVisible = this.model.panels[panelName];
             this.updatePanelVisibility(panelName, shouldBeVisible);
             if (shouldBeVisible) anyPanelVisible = true;
        }
         // Ensure workspace width adjusts based on visible panels (if not in Arena mode)
         if (!this.model.panels.arena) {
              this.adjustWorkspaceLayout();
         }
         OPTIMISM_UTILS.log(`PanelManager: Sync complete. Any panel visible: ${anyPanelVisible}`);
    }

     // Adjusts workspace width/position based on which panels are open
     adjustWorkspaceLayout() {
          const isLeftPanelOpen = this.model.panels.inbox || this.model.panels.priorities;
          const isRightPanelOpen = this.model.panels.settings || this.model.panels.style || this.model.panels.grid;
          const panelWidthVar = 'var(--panel-width)'; // Get CSS variable value dynamically if needed

          let left = '0';
          let width = '100%';

          if (isLeftPanelOpen && isRightPanelOpen) {
               left = panelWidthVar;
               width = `calc(100% - 2 * ${panelWidthVar})`;
          } else if (isLeftPanelOpen) {
               left = panelWidthVar;
               width = `calc(100% - ${panelWidthVar})`;
          } else if (isRightPanelOpen) {
               left = '0';
               width = `calc(100% - ${panelWidthVar})`;
          }

          // Apply styles to workspace
           if (this.view.workspace) {
                this.view.workspace.style.left = left;
                this.view.workspace.style.width = width;
           }
     }


} // End PanelManager Class