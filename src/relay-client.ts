/**
 * PowerLobster Relay Client
 * Connects to wss://relay.powerlobster.com for real-time events
 */

import WebSocket from "ws";

export interface RelayEvent {
  type: string;
  payload: any;
  timestamp: string;
}

export type EventHandler = (event: RelayEvent) => void;

export interface RelayConfig {
  apiKey: string;
  relayId: string;  // Required - unique ID for this agent in PowerLobster DB
  relayUrl?: string;
}

export class PowerLobsterRelay {
  private ws: WebSocket | null = null;
  private config: RelayConfig;
  private reconnectInterval: number = 5000;
  private maxReconnectInterval: number = 60000;
  private currentReconnectInterval: number;
  private eventHandler: EventHandler;
  private isConnected: boolean = false;
  private shouldReconnect: boolean = true;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(config: RelayConfig, eventHandler: EventHandler) {
    this.config = {
      relayUrl: "wss://relay.powerlobster.com/api/v1/connect",
      ...config,
    };
    this.eventHandler = eventHandler;
    this.currentReconnectInterval = this.reconnectInterval;
  }

  connect(): void {
    if (this.ws) {
      this.ws.close();
    }

    if (!this.config.relayId) {
      console.error("🦞 [relay] No relay_id configured - cannot connect");
      return;
    }

    console.log("🦞 [relay] Connecting to relay.powerlobster.com...");

    this.ws = new WebSocket(this.config.relayUrl!);

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

    this.ws.on("message", (data: WebSocket.Data) => {
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

        const event: RelayEvent = {
          type: message.type || "unknown",
          payload: message.payload || message.data || message,
          timestamp: message.timestamp || new Date().toISOString(),
        };

        this.eventHandler(event);
      } catch (err) {
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
        this.currentReconnectInterval = Math.min(
          this.currentReconnectInterval * 2,
          this.maxReconnectInterval
        );
      }
    });

    this.ws.on("error", (err) => {
      console.error("🦞 [relay] WebSocket error:", err.message);
    });
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 30000); // 30s heartbeat as per PowerLobster spec
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    console.log("🦞 [relay] Disconnected from PowerLobster relay");
  }

  isActive(): boolean {
    return this.isConnected;
  }
}
