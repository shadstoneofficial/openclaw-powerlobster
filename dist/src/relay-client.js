"use strict";
/**
 * PowerLobster Relay Client
 * Connects to wss://relay.powerlobster.com for real-time events
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PowerLobsterRelay = void 0;
exports.provisionRelayCredentials = provisionRelayCredentials;
const ws_1 = __importDefault(require("ws"));
/**
 * Self-provision relay credentials from PowerLobster API.
 * This creates/retrieves the relay entry for this agent.
 */
async function provisionRelayCredentials(agentApiKey) {
    console.log("🦞 [relay] Provisioning relay credentials...");
    const response = await fetch("https://powerlobster.com/api/agent/relay", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${agentApiKey}`,
            "Content-Type": "application/json",
        },
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to provision relay: ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    if (data.status !== "success") {
        throw new Error(`Relay provisioning failed: ${data.message || "unknown error"}`);
    }
    console.log(`🦞 [relay] Provisioned: relay_id=${data.relay_id}`);
    return {
        relayId: data.relay_id,
        relayApiKey: data.relay_api_key,
        webhookUrl: data.webhook_url,
    };
}
class PowerLobsterRelay {
    ws = null;
    config;
    reconnectInterval = 5000;
    maxReconnectInterval = 60000;
    currentReconnectInterval;
    eventHandler;
    isConnected = false;
    shouldReconnect = true;
    heartbeatInterval = null;
    processedEventIds = new Set();
    maxProcessedIds = 1000; // Prevent memory bloat
    constructor(config, eventHandler) {
        this.config = {
            relayUrl: "wss://relay.powerlobster.com/api/v1/connect",
            ...config,
        };
        this.eventHandler = eventHandler;
        this.currentReconnectInterval = this.reconnectInterval;
    }
    connect() {
        if (this.ws) {
            this.ws.close();
        }
        if (!this.config.relayId || !this.config.relayApiKey) {
            console.error("🦞 [relay] Missing relay credentials - cannot connect");
            return;
        }
        console.log("🦞 [relay] Connecting to relay.powerlobster.com...");
        this.ws = new ws_1.default(this.config.relayUrl);
        this.ws.on("open", () => {
            console.log("🦞 [relay] WebSocket open, sending auth...");
            this.currentReconnectInterval = this.reconnectInterval;
            // Send auth message per PowerLobster protocol
            // Use relay_api_key for auth (NOT the main agent API key)
            this.ws?.send(JSON.stringify({
                type: "auth",
                relay_id: this.config.relayId,
                api_key: this.config.relayApiKey,
            }));
        });
        this.ws.on("message", (data) => {
            try {
                const message = JSON.parse(data.toString());
                if (message.type === "auth_success") {
                    console.log("🦞 [relay] Authenticated successfully!");
                    this.isConnected = true;
                    this.startHeartbeat();
                    // Request any queued messages we missed while offline
                    console.log("🦞 [relay] Requesting queued messages...");
                    this.ws?.send(JSON.stringify({ type: "get_queued" }));
                    return;
                }
                if (message.type === "auth_error" || message.type === "error") {
                    console.error("🦞 [relay] Error:", message.message || message.error);
                    return;
                }
                // Server sends ping, we respond with pong
                if (message.type === "ping") {
                    this.ws?.send(JSON.stringify({ type: "pong" }));
                    return;
                }
                if (message.type === "pong") {
                    // Response to our heartbeat, ignore
                    return;
                }
                // Handle webhook events from relay
                // Format: { type: "webhook", id: "...", payload: { event: "dm.received", data: {...} } }
                if (message.type === "webhook" && message.payload) {
                    const eventId = message.id || message.payload.id;
                    const eventType = message.payload.event || "unknown";
                    const eventData = message.payload.data || message.payload;
                    // Deduplicate: Skip if we've already processed this event
                    if (eventId && this.processedEventIds.has(eventId)) {
                        console.log(`🦞 [relay] Skipping duplicate event: ${eventId}`);
                        // Still ack to prevent re-delivery
                        if (message.id) {
                            this.ws?.send(JSON.stringify({ type: "ack", id: message.id }));
                        }
                        return;
                    }
                    // Track processed event
                    if (eventId) {
                        this.processedEventIds.add(eventId);
                        // Prevent memory bloat - remove oldest if too many
                        if (this.processedEventIds.size > this.maxProcessedIds) {
                            const oldest = this.processedEventIds.values().next().value;
                            this.processedEventIds.delete(oldest);
                        }
                    }
                    // Calculate event age for logging
                    const eventTime = message.payload.timestamp ? new Date(message.payload.timestamp).getTime() : Date.now();
                    const ageMs = Date.now() - eventTime;
                    const ageMin = Math.round(ageMs / 60000);
                    if (ageMin > 5) {
                        console.log(`🦞 [relay] Event received: ${eventType} (${ageMin} min old, from queue)`);
                    }
                    else {
                        console.log(`🦞 [relay] Event received: ${eventType}`);
                    }
                    const event = {
                        type: eventType,
                        payload: {
                            ...eventData,
                            _eventId: eventId,
                            _ageMinutes: ageMin,
                            _isQueued: ageMin > 5,
                        },
                        timestamp: message.payload.timestamp || message.timestamp || new Date().toISOString(),
                    };
                    // Send ack to relay
                    if (message.id) {
                        this.ws?.send(JSON.stringify({ type: "ack", id: message.id }));
                    }
                    this.eventHandler(event);
                    return;
                }
                // Fallback for other message types
                console.log("🦞 [relay] Unknown message type:", message.type);
            }
            catch (err) {
                console.error("🦞 [relay] Failed to parse message:", err);
            }
        });
        this.ws.on("close", (code, reason) => {
            console.log(`🦞 [relay] Disconnected (code: ${code}, reason: ${reason})`);
            this.isConnected = false;
            this.stopHeartbeat();
            if (this.shouldReconnect) {
                console.log(`🦞 [relay] Reconnecting in ${this.currentReconnectInterval / 1000}s...`);
                setTimeout(() => this.connect(), this.currentReconnectInterval);
                // Exponential backoff
                this.currentReconnectInterval = Math.min(this.currentReconnectInterval * 2, this.maxReconnectInterval);
            }
        });
        this.ws.on("error", (err) => {
            console.error("🦞 [relay] WebSocket error:", err.message);
        });
    }
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            if (this.ws?.readyState === ws_1.default.OPEN) {
                this.ws.send(JSON.stringify({ type: "ping" }));
            }
        }, 30000); // 30s heartbeat as per PowerLobster spec
    }
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    disconnect() {
        this.shouldReconnect = false;
        this.stopHeartbeat();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
        console.log("🦞 [relay] Disconnected from PowerLobster relay");
    }
    isActive() {
        return this.isConnected;
    }
    getRelayId() {
        return this.config.relayId;
    }
}
exports.PowerLobsterRelay = PowerLobsterRelay;
//# sourceMappingURL=relay-client.js.map