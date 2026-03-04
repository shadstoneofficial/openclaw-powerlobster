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
 *   - POWERLOBSTER_HOOK_TOKEN (required for events): Token to trigger agent via /hooks
 */
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
            auth?: {
                token?: string;
            };
        };
        hooks?: {
            enabled?: boolean;
            token?: string;
        };
    };
}
export default function plugin(ctx: PluginContext): {
    tools: ({
        name: string;
        description: string;
        parameters: {
            type: string;
            properties: {
                wave_id: {
                    type: string;
                    description: string;
                };
                notes: {
                    type: string;
                    description: string;
                };
                recipient?: undefined;
                message?: undefined;
                content?: undefined;
                task_id?: undefined;
                comment?: undefined;
                status?: undefined;
            };
            required: string[];
        };
        execute: ({ wave_id, notes }: {
            wave_id: string;
            notes?: string;
        }) => Promise<{
            error: string;
            success?: undefined;
            wave_id?: undefined;
        } | {
            success: boolean;
            wave_id: string;
            error?: undefined;
        }>;
    } | {
        name: string;
        description: string;
        parameters: {
            type: string;
            properties: {
                recipient: {
                    type: string;
                    description: string;
                };
                message: {
                    type: string;
                    description: string;
                };
                wave_id?: undefined;
                notes?: undefined;
                content?: undefined;
                task_id?: undefined;
                comment?: undefined;
                status?: undefined;
            };
            required: string[];
        };
        execute: ({ recipient, message }: {
            recipient: string;
            message: string;
        }) => Promise<{
            error: string;
            success?: undefined;
            recipient?: undefined;
        } | {
            success: boolean;
            recipient: string;
            error?: undefined;
        }>;
    } | {
        name: string;
        description: string;
        parameters: {
            type: string;
            properties: {
                content: {
                    type: string;
                    description: string;
                };
                wave_id?: undefined;
                notes?: undefined;
                recipient?: undefined;
                message?: undefined;
                task_id?: undefined;
                comment?: undefined;
                status?: undefined;
            };
            required: string[];
        };
        execute: ({ content }: {
            content: string;
        }) => Promise<{
            error: string;
            success?: undefined;
        } | {
            success: boolean;
            error?: undefined;
        }>;
    } | {
        name: string;
        description: string;
        parameters: {
            type: string;
            properties: {
                task_id: {
                    type: string;
                    description: string;
                };
                comment: {
                    type: string;
                    description: string;
                };
                wave_id?: undefined;
                notes?: undefined;
                recipient?: undefined;
                message?: undefined;
                content?: undefined;
                status?: undefined;
            };
            required: string[];
        };
        execute: ({ task_id, comment }: {
            task_id: string;
            comment: string;
        }) => Promise<{
            error: string;
            success?: undefined;
            task_id?: undefined;
        } | {
            success: boolean;
            task_id: string;
            error?: undefined;
        }>;
    } | {
        name: string;
        description: string;
        parameters: {
            type: string;
            properties: {
                task_id: {
                    type: string;
                    description: string;
                };
                status: {
                    type: string;
                    description: string;
                };
                wave_id?: undefined;
                notes?: undefined;
                recipient?: undefined;
                message?: undefined;
                content?: undefined;
                comment?: undefined;
            };
            required: string[];
        };
        execute: ({ task_id, status }: {
            task_id: string;
            status: string;
        }) => Promise<{
            error: string;
            success?: undefined;
            task_id?: undefined;
            status?: undefined;
        } | {
            success: boolean;
            task_id: string;
            status: string;
            error?: undefined;
        }>;
    } | {
        name: string;
        description: string;
        parameters: {
            type: string;
            properties: {
                wave_id?: undefined;
                notes?: undefined;
                recipient?: undefined;
                message?: undefined;
                content?: undefined;
                task_id?: undefined;
                comment?: undefined;
                status?: undefined;
            };
            required?: undefined;
        };
        execute: () => Promise<{
            connected: boolean;
            relay_id: string;
            webhook_url: string;
        }>;
    })[];
};
export {};
