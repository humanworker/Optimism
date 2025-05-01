import { SimpleDB } from './database.js';
import { CanvasModel } from './model.js';
import { CanvasView } from './view.js';
import { CanvasController } from './controller.js';
import { OPTIMISM_UTILS } from './utils.js';
import { setupKeyboardShortcuts } from './managers/keyboard-manager.js';

// Global application container
const App = {
    model: null,
    view: null,
    controller: null,
    db: null,
    utils: OPTIMISM_UTILS, // Make utils globally accessible via App

    async init() {
        this.utils.log('Application starting...');

        // Setup global error handlers
        window.addEventListener('error', (event) => {
            this.utils.logError('Uncaught error:', event.error);
        });
        window.addEventListener('unhandledrejection', (event) => {
            this.utils.logError('Unhandled promise rejection:', event.reason);
        });

        // Store the initial hash for later navigation
        const initialHash = window.location.hash;
        this.utils.log(`Initial URL hash: ${initialHash}`);

        // Check for IndexedDB support and initialize database
        if (!window.indexedDB) {
            this.utils.logError('IndexedDB not supported', new Error('Browser does not support IndexedDB'));
            document.getElementById('loading-status').textContent = 'Your browser does not support IndexedDB. Using memory-only mode.';
            this.utils.showMemoryMode(); // Assumes db.open() fallback handles memory mode setup
        }

        this.db = new SimpleDB('optimismDB');
        await this.db.open(); // Wait for DB to open or fallback

        // Set timeout to force error if initialization takes too long
        const initTimeout = setTimeout(() => {
            this.utils.logError('Initialization timed out', new Error('Application did not initialize within 15 seconds'));
            document.getElementById('loading-status').textContent = 'Initialization timed out. Please reset database and reload.';
            document.getElementById('reset-db-button').style.display = 'block';
            document.getElementById('reset-db-button').addEventListener('click', this.utils.resetDatabase);
        }, 15000); // 15 seconds timeout

        try {
            this.model = new CanvasModel(this.db); // Pass DB instance
            this.controller = new CanvasController(this.model); // Pass Model
            this.view = new CanvasView(this.model, this.controller); // Pass Model & Controller

            // Assign controller reference to view AFTER controller is created
            this.controller.view = this.view;
            // Assign view reference to controller AFTER view is created
            this.controller.assignView(this.view); // Ensure controller has view reference
            console.error("%%%%% main.js: controller.assignView CALLED with view:", this.view ? 'VALID View instance' : 'INVALID/NULL View');

            // Initialize application components
            await this.controller.initialize(); // This now includes model.initialize()

            // *** ADD THIS LINE ***
            this.view.setupUI(); // Setup UI components and listeners AFTER controller/model are ready

            // Setup global event listeners managed by view/managers
            // this.view.setupCoreEventListeners(); // Basic listeners in view - MOVED TO setupUI
            setupKeyboardShortcuts(this.controller, this.model, this.view); // Setup keyboard shortcuts

            clearTimeout(initTimeout); // Clear the safety timeout

            // Handle browser back/forward buttons (popstate)
            window.addEventListener('popstate', (event) => {
                this.utils.log('Popstate event triggered', event.state);
                let nodeId = 'root'; // Default to root

                if (event.state && event.state.nodeId) {
                    nodeId = event.state.nodeId;
                    this.utils.log(`Navigating via popstate to node: ${nodeId}`);
                } else if (window.location.hash && window.location.hash !== '#') {
                    this.utils.log(`Popstate: Navigating via hash: ${window.location.hash}`);
                    this.model.navigateToNodeByHash(window.location.hash)
                        .then(success => {
                            if (success) this.view.renderWorkspace();
                            else this.model.navigateToNode('root').then(() => this.view.renderWorkspace());
                        }).catch(error => {
                            this.utils.logError('Error handling popstate hash navigation:', error);
                            this.model.navigateToNode('root').then(() => this.view.renderWorkspace());
                        });
                    return;
                } else {
                    this.utils.log(`Popstate: No state or hash, navigating to root.`);
                }

                this.model.navigateToNode(nodeId)
                    .then(success => {
                        if (success) this.view.renderWorkspace();
                        else this.model.navigateToNode('root').then(() => this.view.renderWorkspace());
                    })
                    .catch(error => {
                        this.utils.logError('Error handling popstate event:', error);
                        this.model.navigateToNode('root').then(() => this.view.renderWorkspace());
                    });
            });

            // --- Handle Initial Load/Hash ---
            let navigationPromise;
            if (initialHash && initialHash !== '#') {
                this.utils.log(`Attempting to navigate to initial hash: ${initialHash}`);
                navigationPromise = this.model.navigateToNodeByHash(initialHash);
            } else {
                this.utils.log('No initial hash, starting at root.');
                if (!window.history.state || window.history.state.nodeId !== 'root') {
                     window.history.replaceState({ nodeId: 'root' }, '', '#');
                     this.utils.log('Replaced history state for root.');
                }
                navigationPromise = Promise.resolve(true);
            }

            navigationPromise.catch(error => {
                this.utils.logError('Error navigating to initial state from hash:', error);
                return this.model.navigateToNode('root'); // Force root on error
            }).finally(() => {
                 this.utils.log('Performing initial workspace render.');
                 this.view.renderWorkspace(); // Render after state is set
                 this.utils.log('Initial workspace render complete.');
                 this.view.hideLoading(); // Hide loading overlay LAST
            });
            // --- End Initial Load/Hash Handling ---

        } catch (error) {
            clearTimeout(initTimeout);
            this.utils.logError('Fatal error during application initialization:', error);
            this.view.hideLoading(); // Ensure loading is hidden on error
            alert('Error initializing application. Please check the console, reset the database if necessary, and reload.');
            document.getElementById('reset-db-button').style.display = 'block';
            document.getElementById('reset-db-button').addEventListener('click', this.utils.resetDatabase);
        }
    } // End init
};

// Start the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => App.init());

// Expose App globally if needed for debugging, otherwise keep it scoped
// window.App = App;
