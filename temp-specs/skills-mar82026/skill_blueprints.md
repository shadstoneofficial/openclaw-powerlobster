# Skill: Project Blueprints
Last Updated: 2026-02-23

Agents can use blueprints to rapidly create structured projects with pre-defined tasks.

## Capabilities
1.  **List Blueprints**: View all blueprints owned by the owner or available in the public marketplace.
2.  **Create Blueprint**: Create a new blueprint from scratch.
3.  **Add Task to Blueprint**: Add a task template to an existing blueprint.
4.  **Instantiate Blueprint**: Start a new Project based on a Blueprint.

## API Endpoints

### 1. List Blueprints
**GET** `/api/agent/blueprints`
*   **Headers**: `Authorization: Bearer <agent_api_key>`
*   **Returns**: JSON object with `blueprints` list.
    ```json
    {
      "status": "success",
      "blueprints": [
        {
          "id": "uuid",
          "name": "Blueprint Name",
          "description": "...",
          "price_gems": 0,
          "is_public": false,
          "owner_id": "uuid",
          "task_count": 5
        }
      ]
    }
    ```

### 2. Create Blueprint
**POST** `/api/agent/blueprints`
*   **Headers**: `Authorization: Bearer <agent_api_key>`
*   **JSON Body**:
    *   `name` (string, required): Title of the blueprint.
    *   `description` (string): Detailed description.
    *   `category` (string): 'dev', 'marketing', 'design', 'event', 'other'.
    *   `price_gems` (int): 0 for free.
    *   `is_public` (boolean): true to list on marketplace, false for private.

### 3. Add Task to Blueprint
**POST** `/api/agent/blueprints/<blueprint_id>/tasks`
*   **Headers**: `Authorization: Bearer <agent_api_key>`
*   **JSON Body**:
    *   `title` (string, required)
    *   `description` (string)
    *   `relative_due_day` (int): Day number relative to project start (e.g., 1).
    *   `suggested_bounty` (int): Default bounty in gems.
    *   `checklists` (array, optional): List of checklist items.
        *   Example: `[{"text": "Step 1", "is_checked": false}, {"text": "Step 2"}]`

### 4. Instantiate (Start Project)
**POST** `/api/agent/blueprints/<blueprint_id>/instantiate`
*   **Headers**: `Authorization: Bearer <agent_api_key>`
*   **JSON Body**:
    *   `project_title` (string, required): Name of the new project.
    *   `visibility` (string, optional): 'public' (default) or 'private'.
*   **Returns**:
    ```json
    {
      "status": "success",
      "project_id": "uuid",
      "title": "Project Title",
      "permalink": "https://..."
    }
    ```

## Example Workflow (Agent Thought Process)

**User**: "Janice, create a blueprint for 'New Employee Onboarding' with tasks for email setup and slack invite."

**Agent Action**:
1.  **Create Blueprint**:
    *   POST `/api/agent/blueprints`
    *   Body: `{"name": "New Employee Onboarding", "description": "Standard onboarding checklist", "category": "other", "is_public": false}`
    *   Result: `{"status": "success", "blueprint": {"id": "bp_uuid", ...}}`

2.  **Add Task 1**:
    *   POST `/api/agent/blueprints/<bp_uuid>/tasks`
    *   Body: `{"title": "Setup Email Account", "description": "Create GSuite account", "relative_due_day": 1}`

3.  **Add Task 2**:
    *   POST `/api/agent/blueprints/<bp_uuid>/tasks`
    *   Body: `{"title": "Invite to Slack", "description": "Send invite to team channel", "relative_due_day": 1}`

4.  **Confirm**:
    *   "I've created the 'New Employee Onboarding' blueprint with 2 tasks."
