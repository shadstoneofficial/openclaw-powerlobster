# Research Plan: Upgrading OpenClaw PowerLobster from Plugin to Channel

**Objective:** Transition the PowerLobster integration from a "single-tenant global plugin" to a "multi-tenant channel architecture" to solve stability, connectivity, and agent isolation issues.

## 1. Problem Analysis (The "Why")

### A. The "Zombie" Process
*   **Symptom:** The WebSocket relay connects, works for a bit, then disconnects or enters a loop where it is technically running but not processing events.
*   **Root Cause:** The current `initRelay()` function in `index.ts` starts a WebSocket connection as a side effect of the plugin loading. There is no robust supervision, state machine, or health check exposed to the OpenClaw gateway. If the connection hangs (not closed, but not receiving), the plugin doesn't know to restart it.

### B. "Amnesia" & Agent Confusion
*   **Symptom:** Agents (like Catalina) forget they have PowerLobster capabilities or hallucinate polling mechanisms.
*   **Root Cause:**
    *   **Capabilities:** Tools are injected globally. The agent doesn't "own" the connection.
    *   **Context:** The agent is woken up by a generic CLI command (`openclaw agent ...`). It doesn't inherently know *which* channel the message came from or how to reply persistently. It treats every event as a fresh, isolated CLI execution.

### C. Single-Tenancy Limit
*   **Symptom:** Configuration relies on global process environment variables (`POWERLOBSTER_API_KEY`, `OPENCLAW_AGENT_ID`).
*   **Root Cause:** You can only support **one** PowerLobster agent per OpenClaw instance. If you want 5 agents, you need 5 OpenClaw containers.

## 2. Terminology: Plugin vs. Channel

Based on OpenClaw architecture patterns:

*   **Plugin (`plugins`):**
    *   Designed for: Extending agent capabilities (Tools), global hooks, or middleware.
    *   Lifecycle: Loaded once at startup. Shared across all agents.
    *   State: Generally stateless or global singleton.
    *   *Current Implementation:* A "Tool provider" that happens to also run a background WebSocket.

*   **Channel (`channels` - Proposed):**
    *   Designed for: Managing persistent connections (Transport Layer) to external platforms (Telegram, Discord, Slack, PowerLobster).
    *   Lifecycle: Managed per-connection. Can have multiple instances (e.g., "Catalina's PowerLobster", "Mike's PowerLobster").
    *   State: Maintains connection socket, handles auth refresh, routes ingress (incoming events) to specific agents, and handles egress (replies).
    *   *Goal:* A robust "driver" for the PowerLobster highway.

## 3. Research & Implementation Plan

### Phase 1: Verify Channel Interface (Day 1)
*   **Action:** Inspect `openclaw` core types to find the `Channel` interface definition.
    *   Does it have `connect()`, `disconnect()`, `send()`?
    *   How does it map an incoming event to an `agent_id`?
*   **Deliverable:** `ChannelInterfaceSpec.md` - describing exactly what methods we need to implement.

### Phase 2: Architect Multi-Tenant Config (Day 2)
*   **Action:** Design a configuration structure that moves away from `.env`.
    *   *From:* `process.env.POWERLOBSTER_API_KEY`
    *   *To:* `openclaw.json` or `channels.json`:
        ```json
        "channels": {
          "powerlobster": {
            "instances": [
              { "id": "catalina-bot", "agent_id": "main", "api_key": "sk_..." },
              { "id": "support-bot", "agent_id": "support", "api_key": "sk_..." }
            ]
          }
        }
        ```
*   **Deliverable:** New `config.schema.json` for the channel.

### Phase 3: Build the Channel Class (Day 3-4)
*   **Action:** Rewrite `index.ts` to export a `Channel` class instead of just tools.
    *   **Connection Manager:** A class that holds the WebSocket.
    *   **Heartbeat Monitor:** A built-in "pulse" that kills/restarts the connection if no ping is received for 60s.
    *   **Router:** Logic that looks at the incoming PowerLobster event (e.g., `recipient_handle`) and routes it to the correct local `agent_id`.

### Phase 4: Migration (Day 5)
*   **Action:** Update the user's setup.
    *   Remove `OPENCLAW_AGENT_ID` from `.env`.
    *   Update `openclaw.json` to register `powerlobster` as a channel.
    *   Restart and verify multi-agent support.

## 4. Immediate Mitigation (While Researching)
Since a full rewrite takes time, we can patch the current "Zombie" issue:
1.  **Add Health Check:** Expose a local HTTP endpoint (e.g., `localhost:PORT/health`) inside the plugin.
2.  **Watchdog:** Use a simple external script (or Docker healthcheck) to curl that endpoint. If it fails (or returns "disconnected"), restart the container.

This plan moves us from a "hacky script" to a "enterprise-grade integration".
