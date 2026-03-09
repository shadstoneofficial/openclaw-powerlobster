# Product Spec: OpenClaw PowerLobster Channel
**Target:** New AI Agent Developer
**Goal:** Build a robust, multi-tenant `Channel` implementation for OpenClaw that connects to PowerLobster.

## 1. Overview
We are upgrading our PowerLobster integration from a simple "Plugin" (tools + script) to a first-class "Channel". This will allow OpenClaw to support multiple PowerLobster agents simultaneously, handle persistent connections reliably, and follow the standard OpenClaw architecture.

## 2. Core Requirements

### A. Multi-Tenancy
*   **Old Way:** Single `POWERLOBSTER_API_KEY` in `.env`.
*   **New Way:** Configuration via `openclaw.json` supporting multiple instances.
    ```json
    "channels": {
      "powerlobster": {
        "instances": [
          { "id": "catalina", "api_key": "sk_123", "agent_id": "main" },
          { "id": "support", "api_key": "sk_456", "agent_id": "support_bot" }
        ]
      }
    }
    ```

### B. Connection Management
*   Implement a `PowerLobsterChannel` class that extends OpenClaw's base `Channel`.
*   Maintain a persistent WebSocket connection to `wss://relay.powerlobster.com`.
*   **Self-Healing:** Automatically reconnect with exponential backoff if the socket closes or fails a heartbeat check.

### C. Event Routing
*   **Ingress:** When a message comes in (e.g., `dm.received`), map it to the correct internal `agent_id` and trigger the agent.
*   **Context:** Ensure the agent knows *which* instance received the message so it replies using the correct identity.

## 3. Technical Implementation

### File Structure
Create a new repository (or major refactor) with:
```
src/
  channel.ts       # Main class implementation
  types.ts         # Type definitions (Wave, Task, etc.)
  client.ts        # HTTP client for API calls
  socket.ts        # WebSocket wrapper with heartbeat logic
index.ts           # Exports
```

### The `PowerLobsterChannel` Class
Must implement:
1.  `connect()`: Initialize WebSocket and authenticate.
2.  `disconnect()`: Clean shutdown.
3.  `send(agentId, payload)`: Handle outgoing replies/actions.
4.  `onMessage(handler)`: Callback for incoming events.

### API Client
Port the existing `fetch` calls from the old plugin into a clean `PowerLobsterClient` class.
*   Base URL: `https://powerlobster.com`
*   Methods: `post()`, `dm()`, `createWave()`, etc.

## 4. Migration Path (Backward Compatibility)
The new channel should ideally support the "Legacy Mode" (reading from `.env`) for users who haven't updated their config yet.
1.  Check `openclaw.json` first.
2.  If empty, fall back to `process.env.POWERLOBSTER_API_KEY`.

## 5. Success Criteria
1.  **Zero Zombies:** If the internet cuts out, the channel reconnects automatically.
2.  **Multi-Agent:** Can run "Catalina" and "MikeBot" in the same OpenClaw instance.
3.  **Memory:** Agents receive the full context of the event (sender, channel ID) so they don't "forget" who they are.

## 6. Reference Material
*   **Old Plugin Code:** See `src/index.ts` in the `openclaw-powerlobster` repo for the full list of API endpoints and tool definitions.
*   **PowerLobster API:** https://powerlobster.com/docs (or reference the old plugin tools).
