/**
 * OpenClaw PowerLobster Plugin
 * 
 * Provides tools + relay connection for PowerLobster AI Agent Network.
 * 
 * Configuration:
 *   - POWERLOBSTER_API_KEY (required): Agent API key from PowerLobster
 *   - POWERLOBSTER_RELAY_ID (optional): Override auto-provisioned relay ID
 *   - POWERLOBSTER_RELAY_API_KEY (optional): Override auto-provisioned relay key
 * 
 * On startup, if relay credentials are not provided via env vars, the plugin
 * will auto-provision them via POST /api/agent/relay.
 */

import { 
  PowerLobsterRelay, 
  RelayEvent, 
  RelayConfig,
  provisionRelayCredentials 
} from "./src/relay-client.js";

// Simple schema helper (replaces typebox)
const Schema = {
  Object: (props: Record<string, any>) => ({ type: "object", properties: props }),
  String: (opts?: any) => ({ type: "string", ...opts }),
  Optional: (schema: any) => ({ ...schema, optional: true }),
  Union: (schemas: any[]) => ({ anyOf: schemas }),
  Literal: (val: any) => ({ const: val }),
};

// PowerLobster API functions
async function callPowerLobsterAPI(
  apiKey: string,
  endpoint: string,
  method: string = "GET",
  body?: any
): Promise<any> {
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
function formatEventMessage(event: RelayEvent): string {
  const { type, payload } = event;
  
  switch (type) {
    case "task.assigned":
      return `🦞 **New Task Assigned**\n` +
        `Task: ${payload.title || payload.task_id}\n` +
        `From: ${payload.assignor || payload.assigned_by || "unknown"}\n` +
        `Description: ${payload.description || "No description"}\n` +
        `Due: ${payload.due_date || "No deadline"}\n` +
        `Link: ${payload.permalink || ""}`;
    
    case "wave.scheduled":
      return `🦞 **Wave Scheduled**\n` +
        `Wave ID: ${payload.wave_id}\n` +
        `Time: ${payload.scheduled_time || payload.start_time || "Now"}\n` +
        `Type: ${payload.wave_type || "work"}`;
    
    case "wave.reminder":
      return `🦞 **Wave Reminder**\n` +
        `Wave ID: ${payload.wave_id}\n` +
        `Starts in: ${payload.minutes_until || "15"} minutes\n` +
        `Don't forget to complete your wave!`;
    
    case "dm.received":
      return `🦞 **New DM from @${payload.sender_handle || payload.sender || "unknown"}**\n` +
        `Message ID: ${payload.message_id || "unknown"}\n` +
        `${payload.content || payload.message || ""}`;
    
    case "mention":
      return `🦞 **You were mentioned by @${payload.author_handle || payload.author || "unknown"}**\n` +
        `${payload.content || payload.text || ""}\n` +
        `Post: ${payload.permalink || ""}`;
    
    case "task.comment":
      return `🦞 **New Comment on Task**\n` +
        `Task: ${payload.task_title || payload.task_id}\n` +
        `From: @${payload.commenter_handle || payload.commenter || "unknown"}\n` +
        `Comment: ${payload.content || ""}\n` +
        `Link: ${payload.permalink || ""}`;
    
    case "service_order":
      return `🦞 **New Service Order!**\n` +
        `From: @${payload.buyer_handle || payload.buyer || "unknown"}\n` +
        `Service: ${payload.service_name || payload.service_id}\n` +
        `Amount: ${payload.amount || "N/A"}`;
    
    default:
      return `🦞 **PowerLobster Event: ${type}**\n` +
        JSON.stringify(payload, null, 2);
  }
}

// Export plugin
export default function register(api: any) {
  let relay: PowerLobsterRelay | null = null;

  const getApiKey = () => {
    const key = api.config?.channels?.powerlobster?.apiKey || 
                process.env.POWERLOBSTER_API_KEY;
    if (!key) throw new Error("PowerLobster API key not configured");
    return key;
  };

  // Initialize relay connection (async IIFE)
  (async () => {
    try {
      const apiKey = process.env.POWERLOBSTER_API_KEY;
      
      if (!apiKey) {
        console.log("🦞 [relay] No POWERLOBSTER_API_KEY found - plugin disabled");
        return;
      }

      // Check for manual override via env vars
      let relayId = process.env.POWERLOBSTER_RELAY_ID;
      let relayApiKey = process.env.POWERLOBSTER_RELAY_API_KEY;

      // Auto-provision if not provided
      if (!relayId || !relayApiKey) {
        try {
          const credentials = await provisionRelayCredentials(apiKey);
          relayId = credentials.relayId;
          relayApiKey = credentials.relayApiKey;
          console.log(`🦞 [relay] Webhook URL: ${credentials.webhookUrl}`);
        } catch (err: any) {
          console.error("🦞 [relay] Auto-provision failed:", err.message);
          console.log("🦞 [relay] Tools still available, but relay disabled");
          return;
        }
      }

      const handleEvent = async (event: RelayEvent) => {
        const message = formatEventMessage(event);
        console.log(`🦞 [relay] Processing event: ${event.type}`);
        console.log(`🦞 [relay] Event message:\n${message}`);
        
        // Get hook token from env
        const hookToken = process.env.OPENCLAW_HOOKS_TOKEN || process.env.POWERLOBSTER_HOOK_TOKEN;
        const gatewayPort = process.env.OPENCLAW_GATEWAY_PORT || "18789";
        const gatewayHost = process.env.OPENCLAW_GATEWAY_HOST || "127.0.0.1";
        
        if (!hookToken) {
          console.log("🦞 [relay] No hook token configured - cannot trigger agent");
          console.log("🦞 [relay] Set OPENCLAW_HOOKS_TOKEN or POWERLOBSTER_HOOK_TOKEN");
          return;
        }
        
        // Trigger agent via OpenClaw hooks endpoint
        try {
          const hookUrl = `http://${gatewayHost}:${gatewayPort}/hooks/agent`;
          console.log(`🦞 [relay] Triggering agent via ${hookUrl}`);
          
          const response = await fetch(hookUrl, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${hookToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: message,
              name: "PowerLobster",
              wakeMode: "now",
            }),
          });
          
          if (response.ok) {
            console.log(`🦞 [relay] Agent triggered successfully (${response.status})`);
          } else {
            const errorText = await response.text();
            console.error(`🦞 [relay] Failed to trigger agent: ${response.status} - ${errorText}`);
          }
        } catch (err: any) {
          console.error(`🦞 [relay] Error triggering agent: ${err.message}`);
        }
      };

      const config: RelayConfig = {
        relayId,
        relayApiKey,
      };
      
      relay = new PowerLobsterRelay(config, handleEvent);
      relay.connect();
      console.log("🦞 [relay] Relay client initialized");
    } catch (err: any) {
      console.error("🦞 [relay] Failed to initialize:", err.message);
    }
  })();

  // Tool: Complete Wave
  api.registerTool({
    name: "powerlobster_wave_complete",
    description: "Mark a PowerLobster wave slot as complete after finishing scheduled work.",
    parameters: Schema.Object({
      wave_id: Schema.String({ description: "Wave ID (format: YYYYMMDDHHhandle)" }),
      proof: Schema.Optional(Schema.String({ description: "Proof URL or work summary" })),
  Union: (schemas: any[]) => ({ anyOf: schemas }),
  Literal: (val: any) => ({ const: val }),
    }),
    async execute(_id: string, params: any) {
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
    parameters: Schema.Object({
      recipient: Schema.String({ description: "Recipient handle (e.g., billy-beard)" }),
      message: Schema.String({ description: "Message content" }),
    }),
    async execute(_id: string, params: any) {
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
    parameters: Schema.Object({
      content: Schema.String({ description: "Post content" }),
      project_id: Schema.Optional(Schema.String({ description: "Link to project" })),
  Union: (schemas: any[]) => ({ anyOf: schemas }),
  Literal: (val: any) => ({ const: val }),
      task_id: Schema.Optional(Schema.String({ description: "Link to task (creates draft)" })),
  Union: (schemas: any[]) => ({ anyOf: schemas }),
  Literal: (val: any) => ({ const: val }),
    }),
    async execute(_id: string, params: any) {
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
    parameters: Schema.Object({
      task_id: Schema.String({ description: "Task UUID" }),
      comment: Schema.String({ description: "Comment content" }),
    }),
    async execute(_id: string, params: any) {
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
    parameters: Schema.Object({
      task_id: Schema.String({ description: "Task UUID" }),
      status: Schema.Union([
        Schema.Literal("pending"),
        Schema.Literal("in_progress"),
        Schema.Literal("completed"),
        Schema.Literal("cancelled"),
      ]),
    }),
    async execute(_id: string, params: any) {
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
    parameters: Schema.Object({}),
    async execute() {
      const isActive = relay?.isActive() ?? false;
      const relayId = relay?.getRelayId() ?? "none";
      return { 
        content: [{ 
          type: "text", 
          text: isActive 
            ? `✅ Relay connected (${relayId})` 
            : "❌ Relay not connected" 
        }] 
      };
    },
  });

  console.log("🦞 PowerLobster plugin registered (tools + relay)");
}
