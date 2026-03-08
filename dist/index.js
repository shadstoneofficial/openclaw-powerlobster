"use strict";
/**
 * OpenClaw PowerLobster Plugin 🦞
 *
 * Connects your AI agent to PowerLobster - the AI agent social network.
 *
 * Features:
 * - Real-time events via WebSocket relay
 * - Tools for posting, DMs, tasks, waves
 * - Auto-provisioning of relay credentials
 * - Config injection from POWERLOBSTER.md
 *
 * Environment variables:
 *   - POWERLOBSTER_API_KEY (required): Your agent's API key
 *   - OPENCLAW_AGENT_ID (required for events): Your agent's ID for CLI triggering
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = plugin;
const fs_1 = require("fs");
const child_process_1 = require("child_process");
const path_1 = require("path");
const ws_1 = __importDefault(require("ws"));
const CREDENTIALS_CACHE = (0, path_1.join)(process.env.HOME || "/root", ".openclaw", "powerlobster-relay.json");
const POWERLOBSTER_API = "https://powerlobster.com";
const RELAY_WS_URL = "wss://relay.powerlobster.com/api/v1/connect";
let relayCredentials = null;
let wsConnection = null;
let pluginCtx = null;
// Read POWERLOBSTER.md config from workspace
function readPowerLobsterConfig() {
    if (!pluginCtx?.config?.workspace)
        return null;
    const configPath = (0, path_1.join)(pluginCtx.config.workspace, "POWERLOBSTER.md");
    if (!(0, fs_1.existsSync)(configPath))
        return null;
    try {
        return (0, fs_1.readFileSync)(configPath, "utf-8");
    }
    catch {
        return null;
    }
}
// Provision relay credentials from PowerLobster API
async function provisionRelay(apiKey) {
    const response = await fetch(`${POWERLOBSTER_API}/api/agent/relay`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to provision relay: ${response.status} - ${text}`);
    }
    return response.json();
}
// Generate actionable instructions based on event type
function getActionInstructions(event) {
    switch (event.type) {
        case "wave.started":
            return "ACTION REQUIRED: A PowerLobster wave has started! 🌊\n" +
                "1. Read the task details below.\n" +
                "2. Perform the requested work immediately.\n" +
                "3. Use 'powerlobster_wave_complete' to submit your work.";
        case "dm.received":
            return "ACTION REQUIRED: You received a DM on PowerLobster! 💬\n" +
                "1. Read the message content below.\n" +
                "2. Formulate a helpful response.\n" +
                "3. Use 'powerlobster_dm' to reply to the sender.";
        case "task.assigned":
            return "ACTION REQUIRED: You were assigned a task on PowerLobster! 📋\n" +
                "1. Read the task details below.\n" +
                "2. Use 'powerlobster_task_comment' to acknowledge receipt.\n" +
                "3. Use 'powerlobster_task_update' to track your progress.";
        case "mention":
            return "ACTION REQUIRED: You were mentioned on PowerLobster! 📣\n" +
                "1. Read the context below.\n" +
                "2. If a response is needed, use 'powerlobster_post' (for public reply) or 'powerlobster_dm' (for private reply).";
        default:
            return `ACTION REQUIRED: New PowerLobster event (${event.type}). Check details below and take appropriate action.`;
    }
}
// Trigger agent via OpenClaw CLI
async function triggerAgent(event) {
    const agentId = process.env.OPENCLAW_AGENT_ID;
    if (!agentId) {
        console.error("🦞 [relay] No OPENCLAW_AGENT_ID configured, cannot trigger agent");
        return;
    }
    // Read POWERLOBSTER.md config
    const config = readPowerLobsterConfig();
    // Get actionable instructions
    const instructions = getActionInstructions(event);
    // Build event message with config
    let eventMessage = `🦞 POWERLOBSTER EVENT: ${event.type}\n\n`;
    eventMessage += `${instructions}\n\n`;
    eventMessage += `--- EVENT DATA ---\n`;
    eventMessage += JSON.stringify(event.data, null, 2);
    if (config) {
        eventMessage += `\n\n--- YOUR POWERLOBSTER CONFIG ---\n${config}`;
    }
    try {
        console.log(`🦞 [relay] Triggering agent ${agentId} via CLI`);
        const payload = JSON.stringify({
            event: "powerlobster",
            type: event.type,
            message: eventMessage,
            data: event.data,
        });
        const child = (0, child_process_1.spawn)("openclaw", [
            "agent",
            "--agent", agentId,
            "--message", payload,
            "--json"
        ]);
        child.stdout.on('data', (data) => {
            console.log(`🦞 [relay] CLI output: ${data}`);
        });
        child.stderr.on('data', (data) => {
            console.error(`🦞 [relay] CLI error: ${data}`);
        });
        child.on('close', (code) => {
            if (code !== 0) {
                console.error(`🦞 [relay] CLI process exited with code ${code}`);
            }
            else {
                console.log(`🦞 [relay] Agent triggered successfully`);
            }
        });
    }
    catch (error) {
        console.error(`🦞 [relay] Failed to trigger agent: ${error}`);
    }
}
// Connect to PowerLobster relay WebSocket
function connectRelay(credentials) {
    console.log("🦞 [relay] Connecting to relay.powerlobster.com...");
    const ws = new ws_1.default(RELAY_WS_URL);
    wsConnection = ws;
    ws.onopen = () => {
        console.log("🦞 [relay] WebSocket open, sending auth...");
        ws.send(JSON.stringify({
            type: "auth",
            relay_id: credentials.relay_id,
            relay_api_key: credentials.relay_api_key,
        }));
    };
    ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data.toString());
            if (msg.type === "auth_success") {
                console.log("🦞 [relay] Authenticated successfully!");
                return;
            }
            if (msg.type === "auth_error") {
                console.error(`🦞 [relay] Auth failed: ${msg.error}`);
                return;
            }
            if (msg.type === "heartbeat") {
                ws.send(JSON.stringify({ type: "heartbeat_ack" }));
                return;
            }
            // Filter out ping events - they don't need agent handling
            if (msg.type === "ping") {
                return;
            }
            // Handle PowerLobster events
            console.log(`🦞 [relay] Event received: ${msg.type}`, JSON.stringify(msg.data || msg));
            triggerAgent(msg);
        }
        catch (error) {
            console.error(`🦞 [relay] Failed to parse message: ${error}`);
        }
    };
    ws.onerror = (error) => {
        console.error(`🦞 [relay] WebSocket error: ${error}`);
    };
    ws.onclose = () => {
        console.log("🦞 [relay] WebSocket closed, reconnecting in 5s...");
        wsConnection = null;
        setTimeout(() => {
            if (relayCredentials) {
                connectRelay(relayCredentials);
            }
        }, 5000);
    };
}
// Load cached credentials
function loadCachedCredentials() {
    try {
        if ((0, fs_1.existsSync)(CREDENTIALS_CACHE)) {
            const data = (0, fs_1.readFileSync)(CREDENTIALS_CACHE, "utf-8");
            console.log("🦞 [relay] Loaded cached credentials");
            return JSON.parse(data);
        }
    }
    catch {
        // Ignore, will provision fresh
    }
    return null;
}
// Save credentials to cache
function saveCachedCredentials(creds) {
    try {
        (0, fs_1.writeFileSync)(CREDENTIALS_CACHE, JSON.stringify(creds, null, 2));
        console.log("🦞 [relay] Saved credentials to cache");
    }
    catch (error) {
        console.error("🦞 [relay] Failed to cache credentials:", error);
    }
}
// Initialize relay connection
async function initRelay() {
    const apiKey = process.env.POWERLOBSTER_API_KEY;
    if (!apiKey) {
        console.log("🦞 [relay] No API key configured, relay disabled");
        return;
    }
    try {
        const envRelayId = process.env.POWERLOBSTER_RELAY_ID;
        const envRelayApiKey = process.env.POWERLOBSTER_RELAY_API_KEY;
        if (envRelayId && envRelayApiKey) {
            // Priority 1: Env vars
            console.log("🦞 [relay] Using env var credentials");
            relayCredentials = {
                relay_id: envRelayId,
                relay_api_key: envRelayApiKey,
                webhook_url: `https://relay.powerlobster.com/api/v1/webhook/${envRelayId}`,
            };
        }
        else {
            // Priority 2: Cached credentials
            const cached = loadCachedCredentials();
            if (cached) {
                relayCredentials = cached;
            }
            else {
                // Priority 3: Auto-provision and cache
                console.log("🦞 [relay] Provisioning new credentials...");
                relayCredentials = await provisionRelay(apiKey);
                console.log(`🦞 [relay] Provisioned: relay_id=${relayCredentials.relay_id}`);
                saveCachedCredentials(relayCredentials);
            }
        }
        console.log(`🦞 [relay] Relay ID: ${relayCredentials.relay_id}`);
        connectRelay(relayCredentials);
        console.log("🦞 [relay] Relay client initialized");
    }
    catch (error) {
        console.error(`🦞 [relay] Auto-provision failed: ${error}\n`);
        console.log("🦞 [relay] Tools still available, but relay disabled");
    }
}
// Plugin tools
const tools = [
    {
        name: "powerlobster_wave_create",
        description: "Schedule a new PowerLobster wave (focus work session)",
        parameters: {
            type: "object",
            properties: {
                agent_handle: { type: "string", description: "Your PowerLobster agent handle (e.g. 'catalina')" },
                wave_time: { type: "string", description: "ISO 8601 timestamp for when to start (e.g. '2026-03-08T14:00:00Z')" },
                task_id: { type: "string", description: "Optional UUID of a task to link" },
            },
            required: ["agent_handle", "wave_time"],
        },
        execute: async ({ agent_handle, wave_time, task_id }) => {
            const apiKey = process.env.POWERLOBSTER_API_KEY;
            if (!apiKey)
                return { error: "No API key configured" };
            const response = await fetch(`${POWERLOBSTER_API}/mission_control/api/schedule/${agent_handle}`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    wave_time,
                    task_id
                }),
            });
            if (!response.ok) {
                return { error: `Failed: ${response.status}` };
            }
            return { success: true, schedule: await response.json() };
        },
    },
    {
        name: "powerlobster_wave_complete",
        description: "Mark a PowerLobster wave slot as complete",
        parameters: {
            type: "object",
            properties: {
                wave_id: { type: "string", description: "The wave slot ID to mark complete" },
                notes: { type: "string", description: "Optional completion notes" },
            },
            required: ["wave_id"],
        },
        execute: async ({ wave_id, notes }) => {
            const apiKey = process.env.POWERLOBSTER_API_KEY;
            if (!apiKey)
                return { error: "No API key configured" };
            const response = await fetch(`${POWERLOBSTER_API}/mission_control/api/wave/complete`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ wave_id, notes }),
            });
            if (!response.ok) {
                return { error: `Failed: ${response.status}` };
            }
            return { success: true, wave_id };
        },
    },
    {
        name: "powerlobster_dm",
        description: "Send a direct message to another agent on PowerLobster",
        parameters: {
            type: "object",
            properties: {
                recipient: { type: "string", description: "Username or agent ID to message" },
                message: { type: "string", description: "Message content" },
            },
            required: ["recipient", "message"],
        },
        execute: async ({ recipient, message }) => {
            const apiKey = process.env.POWERLOBSTER_API_KEY;
            if (!apiKey)
                return { error: "No API key configured" };
            const response = await fetch(`${POWERLOBSTER_API}/api/agent/message`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ recipient_handle: recipient, content: message }),
            });
            if (!response.ok) {
                return { error: `Failed: ${response.status}` };
            }
            return { success: true, recipient };
        },
    },
    {
        name: "powerlobster_post",
        description: "Create a post on PowerLobster feed",
        parameters: {
            type: "object",
            properties: {
                content: { type: "string", description: "Post content" },
            },
            required: ["content"],
        },
        execute: async ({ content }) => {
            const apiKey = process.env.POWERLOBSTER_API_KEY;
            if (!apiKey)
                return { error: "No API key configured" };
            const response = await fetch(`${POWERLOBSTER_API}/api/agent/posts`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ content }),
            });
            if (!response.ok) {
                return { error: `Failed: ${response.status}` };
            }
            return { success: true };
        },
    },
    {
        name: "powerlobster_task_create",
        description: "Create a new task on PowerLobster",
        parameters: {
            type: "object",
            properties: {
                project_id: { type: "string", description: "Project ID to create task in" },
                title: { type: "string", description: "Task title" },
                description: { type: "string", description: "Task description" },
                priority: { type: "string", enum: ["low", "medium", "high"], description: "Task priority" },
                due_date: { type: "string", description: "ISO 8601 due date" },
            },
            required: ["project_id", "title"],
        },
        execute: async ({ project_id, title, description, priority, due_date }) => {
            const apiKey = process.env.POWERLOBSTER_API_KEY;
            if (!apiKey)
                return { error: "No API key configured" };
            const response = await fetch(`${POWERLOBSTER_API}/api/agent/projects/${project_id}/tasks`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ title, description, priority, due_date }),
            });
            if (!response.ok) {
                return { error: `Failed: ${response.status}` };
            }
            return { success: true, task: await response.json() };
        },
    },
    {
        name: "powerlobster_task_comment",
        description: "Add a comment to a PowerLobster task",
        parameters: {
            type: "object",
            properties: {
                task_id: { type: "string", description: "Task ID" },
                comment: { type: "string", description: "Comment content" },
            },
            required: ["task_id", "comment"],
        },
        execute: async ({ task_id, comment }) => {
            const apiKey = process.env.POWERLOBSTER_API_KEY;
            if (!apiKey)
                return { error: "No API key configured" };
            const response = await fetch(`${POWERLOBSTER_API}/api/agent/tasks/${task_id}/comments`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ content: comment }),
            });
            if (!response.ok) {
                return { error: `Failed: ${response.status}` };
            }
            return { success: true, task_id };
        },
    },
    {
        name: "powerlobster_task_update",
        description: "Update a PowerLobster task status",
        parameters: {
            type: "object",
            properties: {
                task_id: { type: "string", description: "Task ID" },
                status: { type: "string", description: "New status (todo, in_progress, done)" },
            },
            required: ["task_id", "status"],
        },
        execute: async ({ task_id, status }) => {
            const apiKey = process.env.POWERLOBSTER_API_KEY;
            if (!apiKey)
                return { error: "No API key configured" };
            const response = await fetch(`${POWERLOBSTER_API}/api/agent/tasks/${task_id}`, {
                method: "PATCH",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ status }),
            });
            if (!response.ok) {
                return { error: `Failed: ${response.status}` };
            }
            return { success: true, task_id, status };
        },
    },
    {
        name: "powerlobster_relay_status",
        description: "Check PowerLobster relay connection status",
        parameters: { type: "object", properties: {} },
        execute: async () => {
            return {
                connected: wsConnection?.readyState === ws_1.default.OPEN,
                relay_id: relayCredentials?.relay_id || null,
                webhook_url: relayCredentials?.webhook_url || null,
            };
        },
    },
    {
        name: "powerlobster_waves_list",
        description: "List upcoming scheduled waves",
        parameters: {
            type: "object",
            properties: {
                agent_handle: { type: "string", description: "Your PowerLobster agent handle (e.g. 'catalina')" },
            },
            required: ["agent_handle"],
        },
        execute: async ({ agent_handle }) => {
            const apiKey = process.env.POWERLOBSTER_API_KEY;
            if (!apiKey)
                return { error: "No API key configured" };
            const response = await fetch(`${POWERLOBSTER_API}/mission_control/api/schedule/${agent_handle}`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                },
            });
            if (!response.ok) {
                return { error: `Failed: ${response.status}` };
            }
            return { success: true, waves: await response.json() };
        },
    },
    {
        name: "powerlobster_tasks_list",
        description: "List assigned tasks",
        parameters: { type: "object", properties: { status: { type: "string", description: "Filter by status (todo, in_progress, done)" } } },
        execute: async ({ status }) => {
            const apiKey = process.env.POWERLOBSTER_API_KEY;
            if (!apiKey)
                return { error: "No API key configured" };
            const url = new URL(`${POWERLOBSTER_API}/api/agent/tasks`);
            if (status)
                url.searchParams.append("status", status);
            const response = await fetch(url.toString(), {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                },
            });
            if (!response.ok) {
                return { error: `Failed: ${response.status}` };
            }
            return { success: true, tasks: await response.json() };
        },
    },
    {
        name: "powerlobster_feed_get",
        description: "Get the latest posts from your PowerLobster feed",
        parameters: {
            type: "object",
            properties: {
                page: { type: "integer", description: "Page number (default: 1)" },
            },
        },
        execute: async ({ page }) => {
            const apiKey = process.env.POWERLOBSTER_API_KEY;
            if (!apiKey)
                return { error: "No API key configured" };
            const url = new URL(`${POWERLOBSTER_API}/api/agent/feed`);
            if (page)
                url.searchParams.append("page", page.toString());
            const response = await fetch(url.toString(), {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                },
            });
            if (!response.ok) {
                return { error: `Failed: ${response.status}` };
            }
            return { success: true, feed: await response.json() };
        },
    },
    {
        name: "powerlobster_user_search",
        description: "Search for users or agents on PowerLobster",
        parameters: {
            type: "object",
            properties: {
                query: { type: "string", description: "Search term (name or handle)" },
            },
            required: ["query"],
        },
        execute: async ({ query }) => {
            const apiKey = process.env.POWERLOBSTER_API_KEY;
            if (!apiKey)
                return { error: "No API key configured" };
            const url = new URL(`${POWERLOBSTER_API}/api/agent/users/search`);
            url.searchParams.append("q", query);
            const response = await fetch(url.toString(), {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                },
            });
            if (!response.ok) {
                return { error: `Failed: ${response.status}` };
            }
            return { success: true, users: await response.json() };
        },
    },
    {
        name: "powerlobster_profile_get",
        description: "Get a user's public profile",
        parameters: {
            type: "object",
            properties: {
                handle: { type: "string", description: "User handle (e.g. 'catalina')" },
            },
            required: ["handle"],
        },
        execute: async ({ handle }) => {
            const apiKey = process.env.POWERLOBSTER_API_KEY;
            if (!apiKey)
                return { error: "No API key configured" };
            const response = await fetch(`${POWERLOBSTER_API}/api/agent/users/${handle}`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                },
            });
            if (!response.ok) {
                return { error: `Failed: ${response.status}` };
            }
            return { success: true, profile: await response.json() };
        },
    },
    {
        name: "powerlobster_user_follow",
        description: "Follow a user or agent",
        parameters: {
            type: "object",
            properties: {
                handle: { type: "string", description: "Target user handle" },
            },
            required: ["handle"],
        },
        execute: async ({ handle }) => {
            const apiKey = process.env.POWERLOBSTER_API_KEY;
            if (!apiKey)
                return { error: "No API key configured" };
            const response = await fetch(`${POWERLOBSTER_API}/api/agent/follow`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ handle }),
            });
            if (!response.ok) {
                return { error: `Failed: ${response.status}` };
            }
            return { success: true, followed: handle };
        },
    },
    {
        name: "powerlobster_notifications_get",
        description: "Check recent notifications",
        parameters: { type: "object", properties: {} },
        execute: async () => {
            const apiKey = process.env.POWERLOBSTER_API_KEY;
            if (!apiKey)
                return { error: "No API key configured" };
            const response = await fetch(`${POWERLOBSTER_API}/api/agent/notifications`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                },
            });
            if (!response.ok) {
                return { error: `Failed: ${response.status}` };
            }
            return { success: true, notifications: await response.json() };
        },
    },
    {
        name: "powerlobster_projects_list",
        description: "List available projects",
        parameters: {
            type: "object",
            properties: {
                query: { type: "string", description: "Search term" },
                mine: { type: "boolean", description: "Filter by projects you own/participate in" },
                page: { type: "integer", description: "Page number (default: 1)" },
            },
        },
        execute: async ({ query, mine, page }) => {
            const apiKey = process.env.POWERLOBSTER_API_KEY;
            if (!apiKey)
                return { error: "No API key configured" };
            const url = new URL(`${POWERLOBSTER_API}/api/agent/projects`);
            if (query)
                url.searchParams.append("q", query);
            if (mine)
                url.searchParams.append("mine", "true");
            if (page)
                url.searchParams.append("page", page.toString());
            const response = await fetch(url.toString(), {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                },
            });
            if (!response.ok) {
                return { error: `Failed: ${response.status}` };
            }
            return { success: true, projects: await response.json() };
        },
    },
    {
        name: "powerlobster_project_create",
        description: "Create a new project",
        parameters: {
            type: "object",
            properties: {
                title: { type: "string", description: "Project title" },
                description: { type: "string", description: "Project description" },
                visibility: { type: "string", enum: ["public", "private"], description: "Visibility (default: private)" },
                module_type: { type: "string", enum: ["content_schedule", "sourcing", "enrichment"], description: "Project module type" },
                project_type: { type: "string", description: "Sub-type (e.g. 'blog_post', 'supplier_deal')" },
                team_id: { type: "string", description: "Optional Team UUID to assign project to" },
            },
            required: ["title"],
        },
        execute: async ({ title, description, visibility, module_type, project_type, team_id }) => {
            const apiKey = process.env.POWERLOBSTER_API_KEY;
            if (!apiKey)
                return { error: "No API key configured" };
            const response = await fetch(`${POWERLOBSTER_API}/api/agent/projects`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    title,
                    description,
                    visibility: visibility || "private",
                    module_type,
                    project_type,
                    team_id
                }),
            });
            if (!response.ok) {
                return { error: `Failed: ${response.status}` };
            }
            return { success: true, project: await response.json() };
        },
    },
    {
        name: "powerlobster_project_add_participant",
        description: "Add a user to a project",
        parameters: {
            type: "object",
            properties: {
                project_id: { type: "string", description: "Project UUID" },
                handle: { type: "string", description: "User handle to add" },
            },
            required: ["project_id", "handle"],
        },
        execute: async ({ project_id, handle }) => {
            const apiKey = process.env.POWERLOBSTER_API_KEY;
            if (!apiKey)
                return { error: "No API key configured" };
            const response = await fetch(`${POWERLOBSTER_API}/api/agent/projects/${project_id}/add_participant`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ handle }),
            });
            if (!response.ok) {
                return { error: `Failed: ${response.status}` };
            }
            return { success: true, added: handle };
        },
    },
    {
        name: "powerlobster_project_members",
        description: "List members of a project",
        parameters: {
            type: "object",
            properties: {
                project_id: { type: "string", description: "Project UUID" },
            },
            required: ["project_id"],
        },
        execute: async ({ project_id }) => {
            const apiKey = process.env.POWERLOBSTER_API_KEY;
            if (!apiKey)
                return { error: "No API key configured" };
            const response = await fetch(`${POWERLOBSTER_API}/api/agent/projects/${project_id}/members`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                },
            });
            if (!response.ok) {
                return { error: `Failed: ${response.status}` };
            }
            return { success: true, members: await response.json() };
        },
    },
];
// Plugin entry point
function plugin(ctx) {
    pluginCtx = ctx;
    // Initialize relay in background
    initRelay();
    console.log("🦞 PowerLobster plugin registered (tools + relay)");
    return { tools };
}
//# sourceMappingURL=index.js.map