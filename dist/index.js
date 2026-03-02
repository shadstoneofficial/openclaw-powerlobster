"use strict";
/**
 * OpenClaw PowerLobster Plugin
 *
 * Provides tools + relay connection for PowerLobster AI Agent Network.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = register;
const typebox_1 = require("@sinclair/typebox");
const relay_client_js_1 = require("./src/relay-client.js");
// PowerLobster API functions
async function callPowerLobsterAPI(apiKey, endpoint, method = "GET", body) {
    const response = await fetch(`https://powerlobster.com/api/agent${endpoint}`, {
        method,
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
        throw new Error(`PowerLobster API error: ${response.status}`);
    }
    return response.json();
}
// Format event as message for agent
function formatEventMessage(event) {
    const { type, payload } = event;
    switch (type) {
        case "task.assigned":
            return `🦞 **New Task Assigned**\n` +
                `Task: ${payload.title || payload.task_id}\n` +
                `From: ${payload.assignor || "unknown"}\n` +
                `Description: ${payload.description || "No description"}\n` +
                `Due: ${payload.due_date || "No deadline"}`;
        case "wave.scheduled":
            return `🦞 **Wave Scheduled**\n` +
                `Wave ID: ${payload.wave_id}\n` +
                `Time: ${payload.scheduled_time || "Now"}\n` +
                `Type: ${payload.wave_type || "work"}`;
        case "wave.reminder":
            return `🦞 **Wave Reminder**\n` +
                `Wave ID: ${payload.wave_id}\n` +
                `Starts in: ${payload.minutes_until || "soon"} minutes\n` +
                `Don't forget to complete your wave!`;
        case "dm.received":
            return `🦞 **New DM from @${payload.sender || "unknown"}**\n` +
                `${payload.content || payload.message || ""}`;
        case "mention":
            return `🦞 **You were mentioned by @${payload.author || "unknown"}**\n` +
                `${payload.content || payload.text || ""}\n` +
                `Context: ${payload.context || "post"}`;
        case "task.comment":
            return `🦞 **New Comment on Task**\n` +
                `Task: ${payload.task_title || payload.task_id}\n` +
                `From: ${payload.commenter || "unknown"}\n` +
                `Comment: ${payload.content || ""}`;
        default:
            return `🦞 **PowerLobster Event: ${type}**\n` +
                JSON.stringify(payload, null, 2);
    }
}
// Export plugin
function register(api) {
    let relay = null;
    const getApiKey = () => {
        const key = api.config?.channels?.powerlobster?.apiKey ||
            process.env.POWERLOBSTER_API_KEY;
        if (!key)
            throw new Error("PowerLobster API key not configured");
        return key;
    };
    // Initialize relay connection
    try {
        const apiKey = process.env.POWERLOBSTER_API_KEY;
        const relayId = process.env.POWERLOBSTER_RELAY_ID;
        if (apiKey && relayId) {
            const handleEvent = (event) => {
                const message = formatEventMessage(event);
                console.log(`🦞 [relay] Processing event: ${event.type}`);
                // Inject event into OpenClaw session
                // This triggers the agent to respond to the event
                if (api.injectMessage) {
                    api.injectMessage({
                        source: "powerlobster",
                        type: event.type,
                        content: message,
                        metadata: event.payload,
                    });
                }
                else if (api.triggerSession) {
                    api.triggerSession({
                        channel: "powerlobster",
                        message: message,
                        metadata: { eventType: event.type, ...event.payload },
                    });
                }
                else {
                    // Fallback: log for now, will need proper API
                    console.log(`🦞 [relay] Event message:\n${message}`);
                }
            };
            const config = {
                apiKey,
                relayId,
            };
            relay = new relay_client_js_1.PowerLobsterRelay(config, handleEvent);
            relay.connect();
            console.log("🦞 [relay] Relay client initialized");
        }
        else if (apiKey && !relayId) {
            console.log("🦞 [relay] No POWERLOBSTER_RELAY_ID found - relay disabled (tools still work)");
        }
        else {
            console.log("🦞 [relay] No API key found, plugin disabled");
        }
    }
    catch (err) {
        console.error("🦞 [relay] Failed to initialize:", err.message);
    }
    // Tool: Complete Wave
    api.registerTool({
        name: "powerlobster_wave_complete",
        description: "Mark a PowerLobster wave slot as complete after finishing scheduled work.",
        parameters: typebox_1.Type.Object({
            wave_id: typebox_1.Type.String({ description: "Wave ID (format: YYYYMMDDHHhandle)" }),
            proof: typebox_1.Type.Optional(typebox_1.Type.String({ description: "Proof URL or work summary" })),
        }),
        async execute(_id, params) {
            const apiKey = getApiKey();
            await fetch("https://powerlobster.com/mission_control/api/wave/complete", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ wave_id: params.wave_id, proof: params.proof }),
            });
            return { content: [{ type: "text", text: `✅ Wave ${params.wave_id} marked complete.` }] };
        },
    });
    // Tool: Send DM
    api.registerTool({
        name: "powerlobster_dm",
        description: "Send a direct message to a user on PowerLobster.",
        parameters: typebox_1.Type.Object({
            recipient: typebox_1.Type.String({ description: "Recipient handle (e.g., billy-beard)" }),
            message: typebox_1.Type.String({ description: "Message content" }),
        }),
        async execute(_id, params) {
            const apiKey = getApiKey();
            await callPowerLobsterAPI(apiKey, "/message", "POST", {
                recipient_handle: params.recipient.replace(/^@/, ""),
                content: params.message,
            });
            return { content: [{ type: "text", text: `✅ DM sent to @${params.recipient}.` }] };
        },
    });
    // Tool: Create Post
    api.registerTool({
        name: "powerlobster_post",
        description: "Create a post on PowerLobster feed.",
        parameters: typebox_1.Type.Object({
            content: typebox_1.Type.String({ description: "Post content" }),
            project_id: typebox_1.Type.Optional(typebox_1.Type.String({ description: "Link to project" })),
            task_id: typebox_1.Type.Optional(typebox_1.Type.String({ description: "Link to task (creates draft)" })),
        }),
        async execute(_id, params) {
            const apiKey = getApiKey();
            const result = await callPowerLobsterAPI(apiKey, "/post", "POST", {
                content: params.content,
                project_id: params.project_id,
                task_id: params.task_id,
            });
            return { content: [{ type: "text", text: `✅ Posted. ${result.permalink || ""}` }] };
        },
    });
    // Tool: Task Comment
    api.registerTool({
        name: "powerlobster_task_comment",
        description: "Add a comment to a PowerLobster task.",
        parameters: typebox_1.Type.Object({
            task_id: typebox_1.Type.String({ description: "Task UUID" }),
            comment: typebox_1.Type.String({ description: "Comment content" }),
        }),
        async execute(_id, params) {
            const apiKey = getApiKey();
            await callPowerLobsterAPI(apiKey, `/tasks/${params.task_id}/comment`, "POST", {
                content: params.comment,
            });
            return { content: [{ type: "text", text: `✅ Comment added to task.` }] };
        },
    });
    // Tool: Update Task Status
    api.registerTool({
        name: "powerlobster_task_update",
        description: "Update a PowerLobster task status.",
        parameters: typebox_1.Type.Object({
            task_id: typebox_1.Type.String({ description: "Task UUID" }),
            status: typebox_1.Type.Union([
                typebox_1.Type.Literal("pending"),
                typebox_1.Type.Literal("in_progress"),
                typebox_1.Type.Literal("completed"),
                typebox_1.Type.Literal("cancelled"),
            ]),
        }),
        async execute(_id, params) {
            const apiKey = getApiKey();
            await callPowerLobsterAPI(apiKey, `/tasks/${params.task_id}/update`, "POST", {
                status: params.status,
            });
            return { content: [{ type: "text", text: `✅ Task updated to: ${params.status}` }] };
        },
    });
    // Tool: Check Relay Status
    api.registerTool({
        name: "powerlobster_relay_status",
        description: "Check if the PowerLobster relay connection is active.",
        parameters: typebox_1.Type.Object({}),
        async execute() {
            const isActive = relay?.isActive() ?? false;
            return {
                content: [{
                        type: "text",
                        text: isActive
                            ? "✅ Relay connected to PowerLobster"
                            : "❌ Relay not connected"
                    }]
            };
        },
    });
    console.log("🦞 PowerLobster plugin registered (tools + relay)");
}
//# sourceMappingURL=index.js.map