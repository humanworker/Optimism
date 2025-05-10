// --- START OF FILE js/managers/todoist-manager.js ---

import { OPTIMISM_UTILS } from '../utils.js';

const TODOIST_API_BASE = 'https://api.todoist.com/rest/v2';
const REFRESH_INTERVAL = 1 * 60 * 1000; // 5 minutes in milliseconds

export class TodoistManager {
    constructor(model, controller, view) {
        this.model = model;
        this.controller = controller;
        this.view = view;
        this.panelElement = null;
        this.toggleButton = null;
        this.refreshIntervalId = null; // To store the interval ID
        this.isFetching = false; // To prevent concurrent fetches
    }

    setup() {
        OPTIMISM_UTILS.log("TodoistManager: Setting up...");
        this.panelElement = document.getElementById('todoist-panel');
        this.toggleButton = document.getElementById('todoist-toggle');

        if (this.toggleButton) {
            this.toggleButton.style.display = 'inline-block'; // Make button visible
            this.toggleButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.controller.toggleTodoistPanel(); // Controller handles fetching on open now
            });
        } else {
             OPTIMISM_UTILS.logError("TodoistManager: Toggle button (#todoist-toggle) not found.");
        }
        this.updateToggleButtonState(); // Set initial enabled/disabled state

        // Start interval refresh if already connected
        if (this.model.todoistConnected) {
            this.startAutoRefresh();
        }
        OPTIMISM_UTILS.log("TodoistManager: Setup complete.");
    }

    // --- Token Management ---
    getToken() {
        return this.model.todoistApiToken;
    }

    async storeToken(token) {
        await this.model.setTodoistToken(token);
        this.updateToggleButtonState();
        if (this.model.todoistConnected) {
            this.startAutoRefresh();
            // Fetch tasks immediately after connecting if panel is open or for first load
             if (this.model.panels.todoist || !this.view.renderer.panel.isTodoistPanelPopulated()) {
                 this.triggerRefresh(); // Let controller handle this if panel is open
             }
        } else {
            this.stopAutoRefresh();
        }
    }

    async clearToken() {
        await this.model.clearTodoistToken();
        this.updateToggleButtonState();
        this.stopAutoRefresh();
        // Clear tasks from panel
        if (this.view.renderer.panel) this.view.renderer.panel.renderTodoistPanel([]);
        this.view.panelManager.hidePanel('todoist'); // Hide panel on disconnect
    }

    // Update button disabled state based on connection
    updateToggleButtonState() {
        if (this.toggleButton) {
            this.toggleButton.disabled = !this.model.todoistConnected;
            this.toggleButton.title = this.model.todoistConnected ? 'Toggle Todoist Panel' : 'Connect Todoist in Settings';
        }
    }

    // --- Auto Refresh ---
    startAutoRefresh() {
        this.stopAutoRefresh(); // Clear any existing interval
        if (this.model.todoistConnected) {
            OPTIMISM_UTILS.log("TodoistManager: Starting auto-refresh interval.");
            this.refreshIntervalId = setInterval(() => {
                // Only refresh if the panel is currently visible
                if (this.model.panels.todoist) {
                    OPTIMISM_UTILS.log("TodoistManager: Auto-refresh triggered for visible panel.");
                    this.triggerRefresh(true); // Pass a flag to indicate it's an auto-refresh
                } else {
                    // OPTIMISM_UTILS.log("TodoistManager: Auto-refresh skipped, panel not visible.");
                }
            }, REFRESH_INTERVAL);
        }
    }

    stopAutoRefresh() {
        if (this.refreshIntervalId) {
            OPTIMISM_UTILS.log("TodoistManager: Stopping auto-refresh interval.");
            clearInterval(this.refreshIntervalId);
            this.refreshIntervalId = null;
        }
    }

    // Public method to trigger a refresh, typically called by controller
    // isAutoRefresh flag can be used to skip showing loading indicators for background refreshes
    async triggerRefresh(isAutoRefresh = false) {
        if (!this.model.todoistConnected || this.isFetching) {
            if(this.isFetching) OPTIMISM_UTILS.log("TodoistManager: Refresh already in progress.");
            return;
        }

        this.isFetching = true;
        if (!isAutoRefresh && this.view.renderer.panel) {
            // Optionally show a subtle loading state in the panel if not auto-refresh
            // this.view.renderer.panel.showTodoistLoadingState();
        }

        OPTIMISM_UTILS.log("TodoistManager: Triggering tasks refresh...");
        const tasks = await this.fetchTasks(); // fetchTasks itself handles rendering on success/error
        if (tasks && this.view.renderer.panel) {
            this.view.renderer.panel.renderTodoistPanel(tasks);
        }
        this.isFetching = false;
    }


    // --- API Calls ---

    async _callApi(endpoint, options = {}) {
        const token = this.getToken();
        if (!token) {
            OPTIMISM_UTILS.logError("Todoist API call failed: Not connected.");
            // Render error only if panel is currently visible
            if (this.model.panels.todoist) {
                this.view.renderer.panel?.renderTodoistPanelError("Not connected. Set API token in Settings.");
            }
            return null; // Indicate connection error
        }

        const url = `${TODOIST_API_BASE}${endpoint}`;
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers,
        };

        try {
            // OPTIMISM_UTILS.log(`Todoist API Request: ${options.method || 'GET'} ${url}`); // Make less verbose
            const response = await fetch(url, { ...options, headers });

            if (response.status === 204) { // No Content (successful delete/update often returns this)
                return { ok: true, data: null };
            }

            // Check for non-JSON responses before trying to parse
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const errorText = await response.text();
                OPTIMISM_UTILS.logError(`Todoist API Error: Non-JSON response from ${url} (Status: ${response.status})`, errorText);
                if (this.model.panels.todoist) {
                     this.view.renderer.panel?.renderTodoistPanelError(`API Error ${response.status}: Unexpected response format.`);
                }
                return null;
            }

            const data = await response.json();

            if (!response.ok) {
                let errorMsg = `API Error ${response.status}: ${data.error || response.statusText}`;
                OPTIMISM_UTILS.logError(`Todoist API Error: ${response.status} on ${url}`, data);
                 if (response.status === 401 || response.status === 403) {
                    errorMsg = "Authentication failed. Check API token or reconnect.";
                    await this.clearToken(); // Automatically clear token on auth failure
                 }
                 if (this.model.panels.todoist) { // Only render error if panel is visible
                    this.view.renderer.panel?.renderTodoistPanelError(errorMsg);
                 }
                return null;
            }

            return { ok: true, data };
        } catch (error) {
            OPTIMISM_UTILS.logError(`Todoist API Network/Fetch Error for ${url}:`, error);
            if (this.model.panels.todoist) { // Only render error if panel is visible
                this.view.renderer.panel?.renderTodoistPanelError("Network error fetching tasks.");
            }
            return null; // Indicate fetch error
        }
    }

    async fetchTasks() {
        OPTIMISM_UTILS.log("TodoistManager: Fetching today tasks...");
        const result = await this._callApi('/tasks?filter=today');
        return result?.data || []; // Return tasks array or empty on error/no connection
    }

    async createTask(content) {
        OPTIMISM_UTILS.log(`TodoistManager: Creating task: "${content}"`);
        const body = JSON.stringify({
            content: content,
            due_string: "today"
        });
        const result = await this._callApi('/tasks', { method: 'POST', body: body });
        if (result?.ok) {
            // If task creation was successful and panel is visible, trigger a refresh
            if (this.model.panels.todoist) {
                this.triggerRefresh(true); // true for isAutoRefresh to be less intrusive
            }
            return true;
        }
        return false;
    }

}
// --- END OF FILE js/managers/todoist-manager.js ---