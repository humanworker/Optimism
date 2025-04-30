import { OPTIMISM_UTILS } from '../utils.js';

export class GridRenderer {
    constructor(model, workspaceElement) {
        this.model = model;
        this.workspace = workspaceElement;
        this.gridContainer = null; // Reference to the grid container div
    }

    // Ensures the grid container exists
    _ensureGridContainer() {
        if (!this.gridContainer) {
            this.gridContainer = document.getElementById('grid-container');
            if (!this.gridContainer) {
                // Create if missing (should exist from index.html)
                this.gridContainer = document.createElement('div');
                this.gridContainer.id = 'grid-container';
                // Apply necessary styles (absolute position, size, pointer-events, z-index)
                 Object.assign(this.gridContainer.style, {
                    position: 'absolute', top: '0', left: '0', width: '100%', height: '100%',
                    pointerEvents: 'none', zIndex: '0' // Behind elements
                 });
                this.workspace.appendChild(this.gridContainer);
                 OPTIMISM_UTILS.log("Created missing grid container.");
            }
        }
    }

    renderGrid() {
        this._ensureGridContainer();
        this.clearGrid(); // Clear previous lines

        if (!this.model.panels.grid) { // Check model state for visibility
             // OPTIMISM_UTILS.log("Grid rendering skipped: Model state is off.");
             return;
        }

        OPTIMISM_UTILS.log(`Rendering grid with layout: ${this.model.gridLayout}`);

        // Use scrollWidth/Height to draw lines across the entire scrollable area
        const workspaceWidth = this.workspace.scrollWidth;
        const workspaceHeight = this.workspace.scrollHeight;

         // Important: Update container size to match scroll dimensions
         this.gridContainer.style.width = `${workspaceWidth}px`;
         this.gridContainer.style.height = `${workspaceHeight}px`;


        const [rows, columns] = this.model.gridLayout.split('x').map(Number);

        // Create vertical lines
        if (columns > 1) {
            const colWidth = workspaceWidth / columns;
            for (let i = 1; i < columns; i++) {
                const line = document.createElement('div');
                line.className = 'grid-line grid-line-vertical';
                line.style.left = `${Math.round(colWidth * i)}px`; // Use Math.round for cleaner lines
                 line.style.height = `${workspaceHeight}px`; // Span full scroll height
                this.gridContainer.appendChild(line);
            }
        }

        // Create horizontal lines
        if (rows > 1) {
            const rowHeight = workspaceHeight / rows;
            for (let i = 1; i < rows; i++) {
                const line = document.createElement('div');
                line.className = 'grid-line grid-line-horizontal';
                line.style.top = `${Math.round(rowHeight * i)}px`;
                 line.style.width = `${workspaceWidth}px`; // Span full scroll width
                this.gridContainer.appendChild(line);
            }
        }
         // OPTIMISM_UTILS.log('Grid rendered successfully');
    }

    clearGrid() {
        if (this.gridContainer) {
            this.gridContainer.innerHTML = '';
             // OPTIMISM_UTILS.log('Grid cleared');
        }
    }

} // End GridRenderer Class