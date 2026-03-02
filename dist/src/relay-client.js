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
const ws_1 = __importDefault(require("ws"));
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
        if (!this.config.relayId) {
            console.error("🦞 [relay] No relay_id configured - cannot connect");
            return;
        }
        console.log("🦞 [relay] Connecting to relay.powerlobster.com...");
        this.ws = new ws_1.default(this.config.relayUrl);
        this.ws.on("open", () => {
            console.log("🦞 [relay] WebSocket open, sending auth...");
            this.currentReconnectInterval = this.reconnectInterval;
            // Send auth message per PowerLobster protocol
            this.ws?.send(JSON.stringify({
                type: "auth",
                relay_id: this.config.relayId,
                api_key: this.config.apiKey,
            }));
        });
        this.ws.on("message", (data) => {
            try {
                const message = JSON.parse(data.toString());
                console.log("🦞 [relay] Message received:", message.type);
                if (message.type === "auth_success") {
                    console.log("🦞 [relay] Authenticated successfully!");
                    this.isConnected = true;
                    this.startHeartbeat();
                    return;
                }
                if (message.type === "error") {
                    console.error("🦞 [relay] Error:", message.message || message.error);
                    return;
                }
                if (message.type === "pong") {
                    // Heartbeat response, ignore
                    return;
                }
                const event = {
                    type: message.type || "unknown",
                    payload: message.payload || message.data || message,
                    timestamp: message.timestamp || new Date().toISOString(),
                };
                this.eventHandler(event);
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
}
exports.PowerLobsterRelay = PowerLobsterRelay;
//# sourceMappingURL=relay-client.js.map