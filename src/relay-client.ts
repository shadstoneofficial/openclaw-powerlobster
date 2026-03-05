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
  relayId: string;      // Agent relay ID (agt_xxx)
  relayApiKey: string;  // Relay-specific API key (sk_xxx)
  relayUrl?: string;
}

export interface RelayCredentials {
  relayId: string;
  relayApiKey: string;
  webhookUrl: string;
}

interface RelayProvisionResponse {
  status: string;
  relay_id: string;
  relay_api_key: string;
  webhook_url: string;
  message?: string;
}

/**
 * Self-provision relay credentials from PowerLobster API.
 * This creates/retrieves the relay entry for this agent.
 */
export async function provisionRelayCredentials(agentApiKey: string): Promise<RelayCredentials> {
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

  const data = await response.json() as RelayProvisionResponse;
  
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
  private processedEventIds: Set<string> = new Set();
  private maxProcessedIds: number = 1000; // Prevent memory bloat
  
  // Event queue for sequential processing
  private eventQueue: RelayEvent[] = [];
  private isProcessingQueue: boolean = false;
  private eventProcessingDelay: number = 500; // 500ms between events

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

    if (!this.config.relayId || !this.config.relayApiKey) {
      console.error("🦞 [relay] Missing relay credentials - cannot connect");
      return;
    }

    console.log("🦞 [relay] Connecting to relay.powerlobster.com...");

    this.ws = new WebSocket(this.config.relayUrl!);

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

    this.ws.on("message", (data: WebSocket.Data) => {
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
          } else {
            console.log(`🦞 [relay] Event received: ${eventType}`);
          }
          
          const event: RelayEvent = {
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

          // Queue event for sequential processing
          this.queueEvent(event);
          return;
        }

        // Fallback for other message types
        console.log("🦞 [relay] Unknown message type:", message.type);
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

  getRelayId(): string {
    return this.config.relayId;
  }

  /**
   * Queue an event for sequential processing.
   * Prevents overwhelming the agent with concurrent hook calls.
   */
  private queueEvent(event: RelayEvent): void {
    this.eventQueue.push(event);
    console.log(`🦞 [relay] Event queued: ${event.type} (queue size: ${this.eventQueue.length})`);
    
    // Start processing if not already running
    if (!this.isProcessingQueue) {
      this.processQueue();
    }
  }

  /**
   * Process events from queue one at a time with delay.
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.eventQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift()!;
      
      try {
        console.log(`🦞 [relay] Processing event: ${event.type} (${this.eventQueue.length} remaining)`);
        this.eventHandler(event);
      } catch (err: any) {
        console.error(`🦞 [relay] Error processing event: ${err.message}`);
      }

      // Wait before processing next event
      if (this.eventQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, this.eventProcessingDelay));
      }
    }

    this.isProcessingQueue = false;
    console.log("🦞 [relay] Queue empty, processing complete");
  }
}
