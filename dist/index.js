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
 *   - POWERLOBSTER_HOOK_TOKEN (required for events): Token to trigger agent via /hooks
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = plugin;
const fs_1 = require("fs");
const path_1 = require("path");
const POWERLOBSTER_API = "https://powerlobster.com/api";
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
    const response = await fetch(`${POWERLOBSTER_API}/agent/relay`, {
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
// Trigger agent via OpenClaw hooks
async function triggerAgent(event) {
    const hookToken = process.env.POWERLOBSTER_HOOK_TOKEN || pluginCtx?.config?.hooks?.token;
    if (!hookToken) {
        console.error("🦞 [relay] No hook token configured, cannot trigger agent");
        return;
    }
    const gatewayPort = pluginCtx?.config?.gateway?.port || 18789;
    const gatewayHost = pluginCtx?.config?.gateway?.bind === "loopback" ? "127.0.0.1" : "localhost";
    // Read POWERLOBSTER.md config
    const config = readPowerLobsterConfig();
    // Build event message with config
    let eventMessage = `[PowerLobster Event: ${event.type}]\n`;
    eventMessage += JSON.stringify(event.data, null, 2);
    if (config) {
        eventMessage += `\n\n---\n[Your PowerLobster Config]\n${config}`;
    }
    try {
        const hookUrl = `http://${gatewayHost}:${gatewayPort}/hooks/agent`;
        console.log(`🦞 [relay] Triggering agent via ${hookUrl}`);
        const response = await fetch(hookUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${hookToken}`,
            },
            body: JSON.stringify({
                event: "powerlobster",
                type: event.type,
                message: eventMessage,
                data: event.data,
            }),
        });
        if (!response.ok) {
            console.error(`🦞 [relay] Hook trigger failed: ${response.status}`);
        }
        else {
            console.log(`🦞 [relay] Agent triggered successfully`);
        }
    }
    catch (error) {
        console.error(`🦞 [relay] Failed to trigger agent: ${error}`);
    }
}
// Connect to PowerLobster relay WebSocket
function connectRelay(credentials) {
    console.log("🦞 [relay] Connecting to relay.powerlobster.com...");
    const ws = new WebSocket(RELAY_WS_URL);
    wsConnection = ws;
    ws.onopen = () => {
        console.log("🦞 [relay] WebSocket open, sending auth...");
        ws.send(JSON.stringify({
            type: "auth",
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
            // Handle PowerLobster events
            console.log(`🦞 [relay] Event received: ${msg.type}`);
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
// Initialize relay connection
async function initRelay() {
    const apiKey = process.env.POWERLOBSTER_API_KEY;
    if (!apiKey) {
        console.log("🦞 [relay] No API key configured, relay disabled");
        return;
    }
    try {
        console.log("🦞 [relay] Provisioning relay credentials...");
        relayCredentials = await provisionRelay(apiKey);
        console.log(`🦞 [relay] Provisioned: relay_id=${relayCredentials.relay_id}`);
        console.log(`🦞 [relay] Webhook URL: ${relayCredentials.webhook_url}`);
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
            const response = await fetch(`${POWERLOBSTER_API}/agent/waves/${wave_id}/complete`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ notes }),
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
            const response = await fetch(`${POWERLOBSTER_API}/agent/messages`, {
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
            const response = await fetch(`${POWERLOBSTER_API}/agent/posts`, {
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
            const response = await fetch(`${POWERLOBSTER_API}/agent/tasks/${task_id}/comments`, {
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
            const response = await fetch(`${POWERLOBSTER_API}/agent/tasks/${task_id}`, {
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
                connected: wsConnection?.readyState === WebSocket.OPEN,
                relay_id: relayCredentials?.relay_id || null,
                webhook_url: relayCredentials?.webhook_url || null,
            };
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