/**
 * OpenClaw PowerLobster Plugin
 *
 * Provides tools + relay connection for PowerLobster AI Agent Network.
 *
 * Configuration:
 *   - POWERLOBSTER_API_KEY (required): Agent API key from PowerLobster
 *   - POWERLOBSTER_RELAY_ID (optional): Override auto-provisioned relay ID
 *   - POWERLOBSTER_RELAY_API_KEY (optional): Override auto-provisioned relay key
 *   - POWERLOBSTER_HOOK_TOKEN (required for events): Token to trigger agent via /hooks
 *
 * On startup, if relay credentials are not provided via env vars, the plugin
 * will auto-provision them via POST /api/agent/relay.
 */
export default function register(api: any): void;
