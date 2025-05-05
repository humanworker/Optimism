import { OPTIMISM_UTILS } from '../utils.js';

// This function is called from main.js after components are initialized
export function setupKeyboardShortcuts(controller, model, view) {
    OPTIMISM_UTILS.log("KeyboardManager: Setting up shortcuts...");

    document.addEventListener('keydown', (event) => {
        const activeElement = document.activeElement;
        const isEditingText = activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT');
        const selectedElementId = model.selectedElement;
        const selectedElementData = selectedElementId ? model.findElementGlobally(selectedElementId) : null;

        // --- Shortcuts that should work EVEN WHEN editing text ---
        // Undo/Redo are high priority
        if ((event.key === 'z' || event.key === 'Z') && OPTIMISM_UTILS.isModifierKeyPressed(event)) {
            if (event.shiftKey) { // Redo (Cmd/Ctrl+Shift+Z)
                event.preventDefault();
                controller.redo();
            } else { // Undo (Cmd/Ctrl+Z)
                event.preventDefault();
                controller.undo();
            }
            return; // Handled
        }
        // Redo alternative (Cmd/Ctrl+Y)
        if ((event.key === 'y' || event.key === 'Y') && OPTIMISM_UTILS.isModifierKeyPressed(event)) {
             event.preventDefault();
             controller.redo();
             return; // Handled
        }

        // --- Shortcuts that should NOT work when editing text ---
        if (isEditingText) {
             // OPTIMISM_UTILS.log("KeyboardManager: Input focused, skipping non-edit shortcuts.");
            return;
        }

        // --- General Navigation & Panel Toggles ---
        switch (event.key.toLowerCase()) {
            case 'arrowup':
                if (model.navigationStack.length > 1) {
                    event.preventDefault();
                    controller.navigateBack();
                }
                break;
            case 'arrowdown': // Navigate into selected element if possible
                if (selectedElementId && model.hasChildren(selectedElementId)) {
                     event.preventDefault();
                     controller.navigateToElement(selectedElementId);
                }
                break;
            case 'g': // Toggle Grid Panel
                 event.preventDefault();
                 controller.toggleGridVisibility();
                 break;
            case 'i': // Toggle Inbox Panel
                 event.preventDefault();
                 controller.toggleInboxVisibility();
                 break;
            case 'a': // Add Blank Card to Inbox
                 OPTIMISM_UTILS.log("KeyboardManager: 'A' key pressed - Add blank card."); // Log key press
                 event.preventDefault();
                 controller.addBlankCardToInbox();
                 break;
            case 'b': // Toggle Bookmarks panel OR toggle Priority on selected card
                 if (!selectedElementId) { // <-- Check if NO element is selected
                      OPTIMISM_UTILS.log("KeyboardManager: 'B' key pressed (no selection) - Toggle Bookmarks panel.");
                      event.preventDefault();
                      controller.togglePrioritiesVisibility(); // Toggle the panel
                 }
                 // If an element IS selected, the existing logic below handles toggling priority
                 break;
            // Add other panel toggles if desired (e.g., 's' for settings?)
            // case 's': event.preventDefault(); controller.toggleSettingsVisibility(); break;

            case 'escape': // Deselect element / Close panels
                 event.preventDefault();
                 if (selectedElementId) {
                      view.renderer.element.deselectAllElements();
                      view.panelManager.hidePanel('style');
                 } else {
                      // Close any open panel if no element is selected
                      view.panelManager.syncAllPanelVisibilities(); // This might need refinement - maybe close only the *last opened*?
                      // For simplicity now, this might close all panels, which could be annoying.
                      // A better approach would track the 'active' panel.
                       OPTIMISM_UTILS.log("Escape pressed - closing potentially active panels (logic needs refinement)");
                       // Example: Hide all side panels directly
                       ['settings', 'inbox', 'grid', 'priorities', 'style'].forEach(p => view.panelManager.hidePanel(p));
                 }
                 break;
        }

        // --- Element Deletion ---
        if (selectedElementId && (event.key === 'Delete' || event.key === 'Backspace')) {
            event.preventDefault(); // Prevent browser back navigation on Backspace
            controller.deleteElement(selectedElementId);
        }

        // --- Style & Action Shortcuts (require selected element) ---
        if (selectedElementId && selectedElementData) {
             let styleTargetId = selectedElementId; // The ID to apply style changes to
             let styleUpdated = false;
             let actionTaken = false;

             // Handle Text Element Styles (1-6, 0)
             if (selectedElementData.type === 'text') {
                  const currentStyle = selectedElementData.style || {};
                  let newStyleProps = {};

                  switch (event.key) {
                       case '1': // Cycle Text Size
                            const sizes = ['small', 'large', 'huge'];
                            const currentSizeIndex = sizes.indexOf(currentStyle.textSize || 'small');
                            newStyleProps.textSize = sizes[(currentSizeIndex + 1) % sizes.length];
                            styleUpdated = true;
                            break;
                       case '2': // Cycle Text Color
                            const colors = ['default', 'red', 'green'];
                            const currentColorIndex = colors.indexOf(currentStyle.textColor || 'default');
                            newStyleProps.textColor = colors[(currentColorIndex + 1) % colors.length];
                            styleUpdated = true;
                            break;
                       case '3': // Cycle Text Align
                           const aligns = ['left', 'centre', 'right'];
                           const currentAlignIndex = aligns.indexOf(currentStyle.textAlign || 'left');
                           newStyleProps.textAlign = aligns[(currentAlignIndex + 1) % aligns.length];
                           styleUpdated = true;
                           break;
                       case '5': // Toggle Header
                            newStyleProps.hasHeader = !currentStyle.hasHeader;
                            styleUpdated = true;
                            break;
                       case '6': // Toggle Highlight
                            newStyleProps.isHighlighted = !currentStyle.isHighlighted;
                            styleUpdated = true;
                            break;
                        case '0': // Reset Text Styles
                             newStyleProps = {
                                 textSize: 'small', textColor: 'default', textAlign: 'left',
                                 hasHeader: false, isHighlighted: false
                             };
                             // Also reset container styles triggered by 0 if desired
                             // newStyleProps.cardBgColor = 'none';
                             // newStyleProps.hasBorder = false;
                             styleUpdated = true; // Mark as updated even if resetting
                             break;
                  }
                   if (styleUpdated) {
                        event.preventDefault();
                        controller.updateElementStyle(styleTargetId, newStyleProps);
                   }
             } // End Text specific styles


             // Handle Container Styles / Actions (4, 7, 8, 9, B) - Applicable to selected Text or Image
             switch (event.key) {
                  case '4': // Cycle Background Color
                       const bgColors = ['none', 'yellow', 'red'];
                       const currentBgIndex = bgColors.indexOf(selectedElementData.style?.cardBgColor || 'none');
                       const nextBgColor = bgColors[(currentBgIndex + 1) % bgColors.length];
                       event.preventDefault();
                       controller.updateElementStyle(styleTargetId, { cardBgColor: nextBgColor });
                       styleUpdated = true; // Mark as updated even if handled by controller
                       break;
                  case '7': // Toggle Border
                        event.preventDefault();
                        const hasBorder = selectedElementData.style?.hasBorder || false;
                        controller.updateElementStyle(styleTargetId, { hasBorder: !hasBorder });
                        styleUpdated = true;
                        break;
                  case '8': // Toggle Lock
                       event.preventDefault();
                       controller.toggleCardLock(styleTargetId); // Uses specific controller method
                       actionTaken = true; // Mark as action, not just style
                       break;
                  case '9': // Move to Inbox
                       event.preventDefault();
                       controller.moveToInbox(styleTargetId);
                       actionTaken = true;
                       break;
                  case 'b': // Toggle Priority/Bookmark
                       // Priority toggle for selected element (handled here)
                       event.preventDefault(); // Prevent default for this action too
                       controller.toggleCardPriority(styleTargetId);
                       actionTaken = true;
                       break;
             }

             // If a style was updated via shortcut, update the style panel display
             if (styleUpdated && !actionTaken && view.panelManager.isPanelVisible('style')) {
                   const updatedElement = model.findElementGlobally(styleTargetId);
                   if (updatedElement) view.renderer.panel.updateStylePanelOptions(updatedElement);
             }
        } // End selected element check

    }); // End keydown listener

    OPTIMISM_UTILS.log("KeyboardManager: Shortcuts set up.");
}
