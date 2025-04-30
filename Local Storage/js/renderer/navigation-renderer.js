import { OPTIMISM_UTILS } from '../utils.js';

export class NavigationRenderer {
    constructor(model, controller, titleBarElement) {
        this.model = model;
        this.controller = controller;
        this.titleBar = titleBarElement; // The <div id="title-bar"> element
        this.breadcrumbContainer = null;
        this.quickLinksContainer = null;
        this._setupContainers(); // Ensure containers exist
         this._shiftKeyState = { pressed: false }; // Track shift key locally for hover effects
         this._addShiftKeyListeners(); // Add listeners for hover effects
    }

    _setupContainers() {
        // Find or create Breadcrumb container
        this.breadcrumbContainer = this.titleBar.querySelector('#breadcrumb-container');
        if (!this.breadcrumbContainer) {
            const navControls = this.titleBar.querySelector('#nav-controls');
            if (navControls) {
                 this.breadcrumbContainer = document.createElement('div');
                 this.breadcrumbContainer.id = 'breadcrumb-container';
                 navControls.insertBefore(this.breadcrumbContainer, navControls.firstChild); // Add at the start of nav-controls
                 OPTIMISM_UTILS.log("Created breadcrumb container.");
            } else {
                 OPTIMISM_UTILS.logError("Could not find #nav-controls to add breadcrumb container.");
            }
        }

        // Find or create Quick Links container
        this.quickLinksContainer = this.titleBar.querySelector('#quick-links-container');
         if (!this.quickLinksContainer) {
            this.quickLinksContainer = document.createElement('div');
            this.quickLinksContainer.id = 'quick-links-container';
             // Styles applied via CSS or inline if needed (position absolute, centering)
            this.titleBar.appendChild(this.quickLinksContainer); // Add directly to title bar for centering
            OPTIMISM_UTILS.log("Created quick links container.");
        }
    }

    _addShiftKeyListeners() {
         document.addEventListener('keydown', (e) => {
             if (e.key === 'Shift' && !this._shiftKeyState.pressed) {
                 this._shiftKeyState.pressed = true;
                 this._updateQuickLinkHovers();
             }
         });
         document.addEventListener('keyup', (e) => {
             if (e.key === 'Shift') {
                 this._shiftKeyState.pressed = false;
                 this._updateQuickLinkHovers(true); // Force remove hover class
             }
         });
         window.addEventListener('blur', () => { // Clear state on window blur
              if (this._shiftKeyState.pressed) {
                  this._shiftKeyState.pressed = false;
                  this._updateQuickLinkHovers(true);
              }
         });
    }

    _updateQuickLinkHovers(forceRemove = false) {
         if (!this.quickLinksContainer) return;
         this.quickLinksContainer.querySelectorAll('.quick-link').forEach(link => {
             const isHovering = link.matches(':hover'); // Check if mouse is currently over
             if (forceRemove) {
                 link.classList.remove('shift-hover');
             } else {
                 link.classList.toggle('shift-hover', this._shiftKeyState.pressed && isHovering);
             }
         });
    }

    renderBreadcrumbs() {
        if (!this.breadcrumbContainer) {
             OPTIMISM_UTILS.logError("Cannot render breadcrumbs: container not found.");
             return;
        }
        // OPTIMISM_UTILS.log('Rendering breadcrumbs');
        this.breadcrumbContainer.innerHTML = ''; // Clear existing

        const stack = this.model.navigationStack;

        stack.forEach((navItem, i) => {
            const isLastItem = i === stack.length - 1;
            const isRoot = i === 0;

            // Create breadcrumb item span
            const breadcrumb = document.createElement('span');
            breadcrumb.className = 'breadcrumb-item';
            breadcrumb.dataset.nodeId = navItem.nodeId;

            // Title processing
            let title = isRoot ? 'Home' : (navItem.nodeTitle || 'Untitled');
            breadcrumb.title = title; // Full title on hover
            if (title.length > 15) { // Adjust truncation length as needed
                title = title.substring(0, 12) + '...';
            }
            breadcrumb.textContent = title;

            // Add click handler and styles for non-last items
            if (!isLastItem) {
                breadcrumb.style.textDecoration = 'underline';
                breadcrumb.style.cursor = 'pointer';
                breadcrumb.dataset.index = i; // Index for drag drop target and navigation
                breadcrumb.addEventListener('click', () => {
                    this.controller.navigateToIndex(i);
                });
            } else {
                breadcrumb.style.textDecoration = 'none';
                breadcrumb.style.cursor = 'default';
            }

            this.breadcrumbContainer.appendChild(breadcrumb);

            // Add separator if not the last item
            if (!isLastItem) {
                const separator = document.createElement('span');
                separator.className = 'breadcrumb-separator';
                separator.textContent = '➔'; // Or use ›, /, etc.
                this.breadcrumbContainer.appendChild(separator);
            }
        });
         // OPTIMISM_UTILS.log('Breadcrumbs rendered successfully');
    }

    renderQuickLinks() {
         if (!this.quickLinksContainer) {
              OPTIMISM_UTILS.logError("Cannot render quick links: container not found.");
              return;
         }
        // OPTIMISM_UTILS.log('Rendering quick links');
        this.quickLinksContainer.innerHTML = ''; // Clear existing

        if (this.model.quickLinks.length === 0) {
            const placeholder = document.createElement('span');
            placeholder.className = 'quick-link-placeholder';
            placeholder.textContent = 'Drag cards here to bookmark';
            this.quickLinksContainer.appendChild(placeholder);
            return;
        }

        this.model.quickLinks.forEach(link => {
            const quickLink = document.createElement('a'); // Use anchor tag for semantics
            quickLink.href = '#'; // Prevent page jump
            quickLink.className = 'quick-link';
            quickLink.dataset.nodeId = link.nodeId;

            let displayTitle = link.nodeTitle || 'Untitled';
            if (displayTitle.length > 15) displayTitle = displayTitle.substring(0, 12) + '...';
            quickLink.textContent = displayTitle;

            const editsUntilExpiry = Math.max(0, link.expiresAt - this.model.editCounter);
            quickLink.title = `${link.nodeTitle || 'Untitled'} (expires in ${editsUntilExpiry} edits) - Shift+click to remove`;

            // Apply expiry styling
            const expiryThreshold = 10;
            if (editsUntilExpiry <= expiryThreshold) {
                quickLink.style.color = 'var(--red-text-color)';
                quickLink.style.opacity = '1';
            } else {
                const remainingLifePercentage = editsUntilExpiry / this.model.quickLinkExpiryCount;
                quickLink.style.opacity = Math.max(0.3, remainingLifePercentage).toFixed(2);
                 quickLink.style.color = 'var(--element-text-color)'; // Reset color if not expiring soon
            }

            // Add hover listeners for shift state
            quickLink.addEventListener('mouseenter', () => {
                if (this._shiftKeyState.pressed) quickLink.classList.add('shift-hover');
            });
            quickLink.addEventListener('mouseleave', () => {
                quickLink.classList.remove('shift-hover');
            });

            // Click handler
            quickLink.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.shiftKey) {
                    this.controller.removeQuickLink(link.nodeId);
                } else {
                    this.controller.refreshQuickLinkExpiry(link.nodeId);
                    this.controller.navigateToNode(link.nodeId); // Navigate on normal click
                }
            });

            this.quickLinksContainer.appendChild(quickLink);
        });
         // OPTIMISM_UTILS.log(`Rendered ${this.model.quickLinks.length} quick links`);
    }

    // --- Drag Highlighting (called by DragDropManager) ---
    highlightBreadcrumbTarget(index, highlight = true) {
         if (!this.breadcrumbContainer) return;
         const target = this.breadcrumbContainer.querySelector(`.breadcrumb-item[data-index="${index}"]`);
         if (target) {
             target.classList.toggle('drag-highlight', highlight);
         }
    }

    highlightQuickLinkTarget(highlight = true) {
          if (!this.quickLinksContainer) return;
          const placeholder = this.quickLinksContainer.querySelector('.quick-link-placeholder');
          if(placeholder) {
               placeholder.classList.toggle('drag-highlight', highlight);
          } else {
               // Highlight all existing links if no placeholder
               this.quickLinksContainer.querySelectorAll('.quick-link').forEach(link => {
                   link.classList.toggle('drag-highlight', highlight);
               });
          }
    }

    clearAllHighlights() {
         if (this.breadcrumbContainer) {
              this.breadcrumbContainer.querySelectorAll('.drag-highlight').forEach(el => el.classList.remove('drag-highlight'));
         }
         if (this.quickLinksContainer) {
              this.quickLinksContainer.querySelectorAll('.drag-highlight').forEach(el => el.classList.remove('drag-highlight'));
         }
    }

} // End NavigationRenderer Class