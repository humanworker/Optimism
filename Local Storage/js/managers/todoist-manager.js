// --- START OF FILE js/managers/todoist-manager.js ---

import { OPTIMISM_UTILS } from '../utils.js';

const TODOIST_API_BASE = 'https://api.todoist.com/rest/v2';

export class TodoistManager {
    constructor(model, controller, view) {
        this.model = model;
        this.controller = controller;
        this.view = view;
        this.panelElement = null;
        this.toggleButton = null;
    }

    setup() {
        OPTIMISM_UTILS.log("TodoistManager: Setting up...");
        this.panelElement = document.getElementById('todoist-panel');
        this.toggleButton = document.getElementById('todoist-toggle');

        if (this.toggleButton) {
            this.toggleButton.style.display = 'inline-block'; // Make button visible
            this.toggleButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.controller.toggleTodoistPanel();
            });
        } else {
             OPTIMISM_UTILS.logError("TodoistManager: Toggle button (#todoist-toggle) not found.");
        }
        this.updateToggleButtonState(); // Set initial enabled/disabled state
        OPTIMISM_UTILS.log("TodoistManager: Setup complete.");
    }

    // --- Token Management ---
    getToken() {
        return this.model.todoistApiToken;
    }

    async storeToken(token) {
        await this.model.setTodoistToken(token);
        this.updateToggleButtonState();
    }

    async clearToken() {
        await this.model.clearTodoistToken();
        this.updateToggleButtonState();
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

    // --- API Calls ---

    async _callApi(endpoint, options = {}) {
        const token = this.getToken();
        if (!token) {
            OPTIMISM_UTILS.logError("Todoist API call failed: Not connected.");
            this.view.renderer.panel?.renderTodoistPanelError("Not connected. Set API token in Settings.");
            return null; // Indicate connection error
        }

        const url = `${TODOIST_API_BASE}${endpoint}`;
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers,
        };

        try {
            OPTIMISM_UTILS.log(`Todoist API Request: ${options.method || 'GET'} ${url}`);
            const response = await fetch(url, { ...options, headers });

            if (response.status === 204) { // No Content (successful delete/update often returns this)
                return { ok: true, data: null };
            }

            const data = await response.json();

            if (!response.ok) {
                let errorMsg = `API Error ${response.status}: ${data.error || response.statusText}`;
                OPTIMISM_UTILS.logError(`Todoist API Error: ${response.status} on ${url}`, data);
                 if (response.status === 401 || response.status === 403) {
                    errorMsg = "Authentication failed. Check API token or reconnect.";
                    // Optionally clear the token automatically: await this.clearToken();
                 }
                this.view.renderer.panel?.renderTodoistPanelError(errorMsg);
                return null;
            }

            return { ok: true, data };
        } catch (error) {
            OPTIMISM_UTILS.logError(`Todoist API Network/Fetch Error for ${url}:`, error);
            this.view.renderer.panel?.renderTodoistPanelError("Network error fetching tasks.");
            return null; // Indicate fetch error
        }
    }

    async fetchTasks() {
        OPTIMISM_UTILS.log("TodoistManager: Fetching today/overdue tasks...");
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
        return result?.ok || false; // Return true on success (even 204), false otherwise
    }

}
// --- END OF FILE js/managers/todoist-manager.js ---