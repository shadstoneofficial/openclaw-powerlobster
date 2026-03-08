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

import { readFileSync, existsSync, writeFileSync } from "fs";
import { spawn } from "child_process";
import { join } from "path";
import WebSocket from "ws";

const CREDENTIALS_CACHE = join(process.env.HOME || "/root", ".openclaw", "powerlobster-relay.json");

interface PluginContext {
  logger: {
    info: (msg: string) => void;
    error: (msg: string) => void;
    warn: (msg: string) => void;
  };
  config: {
    workspace?: string;
    gateway?: {
      port?: number;
      bind?: string;
      auth?: { token?: string };
    };
    hooks?: {
      enabled?: boolean;
      token?: string;
    };
  };
}

interface RelayCredentials {
  relay_id: string;
  relay_api_key: string;
  webhook_url: string;
}

interface PowerLobsterEvent {
  type: string;
  data: Record<string, unknown>;
}

const POWERLOBSTER_API = "https://powerlobster.com/api";
const RELAY_WS_URL = "wss://relay.powerlobster.com/api/v1/connect";

let relayCredentials: RelayCredentials | null = null;
let wsConnection: WebSocket | null = null;
let pluginCtx: PluginContext | null = null;

// Read POWERLOBSTER.md config from workspace
function readPowerLobsterConfig(): string | null {
  if (!pluginCtx?.config?.workspace) return null;
  
  const configPath = join(pluginCtx.config.workspace, "POWERLOBSTER.md");
  if (!existsSync(configPath)) return null;
  
  try {
    return readFileSync(configPath, "utf-8");
  } catch {
    return null;
  }
}

// Provision relay credentials from PowerLobster API
async function provisionRelay(apiKey: string): Promise<RelayCredentials> {
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
  
  return response.json() as Promise<RelayCredentials>;
}

// Trigger agent via OpenClaw CLI
async function triggerAgent(event: PowerLobsterEvent): Promise<void> {
  const agentId = process.env.OPENCLAW_AGENT_ID;
  if (!agentId) {
    console.error("🦞 [relay] No OPENCLAW_AGENT_ID configured, cannot trigger agent");
    return;
  }
  
  // Read POWERLOBSTER.md config
  const config = readPowerLobsterConfig();
  
  // Build event message with config
  let eventMessage = `[PowerLobster Event: ${event.type}]\n`;
  eventMessage += JSON.stringify(event.data, null, 2);
  
  if (config) {
    eventMessage += `\n\n---\n[Your PowerLobster Config]\n${config}`;
  }
  
  try {
    console.log(`🦞 [relay] Triggering agent ${agentId} via CLI`);
    
    const payload = JSON.stringify({
      event: "powerlobster",
      type: event.type,
      message: eventMessage,
      data: event.data,
    });

    const child = spawn("openclaw", [
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
      } else {
        console.log(`🦞 [relay] Agent triggered successfully`);
      }
    });
    
  } catch (error) {
    console.error(`🦞 [relay] Failed to trigger agent: ${error}`);
  }
}

// Connect to PowerLobster relay WebSocket
function connectRelay(credentials: RelayCredentials): void {
  console.log("🦞 [relay] Connecting to relay.powerlobster.com...");
  
  const ws = new WebSocket(RELAY_WS_URL);
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
      
    } catch (error) {
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
function loadCachedCredentials(): RelayCredentials | null {
  try {
    if (existsSync(CREDENTIALS_CACHE)) {
      const data = readFileSync(CREDENTIALS_CACHE, "utf-8");
      console.log("🦞 [relay] Loaded cached credentials");
      return JSON.parse(data) as RelayCredentials;
    }
  } catch {
    // Ignore, will provision fresh
  }
  return null;
}

// Save credentials to cache
function saveCachedCredentials(creds: RelayCredentials): void {
  try {
    writeFileSync(CREDENTIALS_CACHE, JSON.stringify(creds, null, 2));
    console.log("🦞 [relay] Saved credentials to cache");
  } catch (error) {
    console.error("🦞 [relay] Failed to cache credentials:", error);
  }
}

// Initialize relay connection
async function initRelay(): Promise<void> {
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
    } else {
      // Priority 2: Cached credentials
      const cached = loadCachedCredentials();
      if (cached) {
        relayCredentials = cached;
      } else {
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
  } catch (error) {
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
    execute: async ({ wave_id, notes }: { wave_id: string; notes?: string }) => {
      const apiKey = process.env.POWERLOBSTER_API_KEY;
      if (!apiKey) return { error: "No API key configured" };
      
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
    execute: async ({ recipient, message }: { recipient: string; message: string }) => {
      const apiKey = process.env.POWERLOBSTER_API_KEY;
      if (!apiKey) return { error: "No API key configured" };
      
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
    execute: async ({ content }: { content: string }) => {
      const apiKey = process.env.POWERLOBSTER_API_KEY;
      if (!apiKey) return { error: "No API key configured" };
      
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
    execute: async ({ task_id, comment }: { task_id: string; comment: string }) => {
      const apiKey = process.env.POWERLOBSTER_API_KEY;
      if (!apiKey) return { error: "No API key configured" };
      
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
    execute: async ({ task_id, status }: { task_id: string; status: string }) => {
      const apiKey = process.env.POWERLOBSTER_API_KEY;
      if (!apiKey) return { error: "No API key configured" };
      
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
export default function plugin(ctx: PluginContext) {
  pluginCtx = ctx;
  
  // Initialize relay in background
  initRelay();
  
  console.log("🦞 PowerLobster plugin registered (tools + relay)");
  
  return { tools };
}
