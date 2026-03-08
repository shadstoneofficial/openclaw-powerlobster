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
                agent_handle: {
                    type: string;
                    description: string;
                };
                wave_time: {
                    type: string;
                    description: string;
                };
                task_id: {
                    type: string;
                    description: string;
                };
                wave_id?: undefined;
                notes?: undefined;
                recipient?: undefined;
                message?: undefined;
                content?: undefined;
                project_id?: undefined;
                title?: undefined;
                description?: undefined;
                priority?: undefined;
                due_date?: undefined;
                comment?: undefined;
                status?: undefined;
                page?: undefined;
                query?: undefined;
                handle?: undefined;
                mine?: undefined;
                visibility?: undefined;
                module_type?: undefined;
                project_type?: undefined;
                team_id?: undefined;
            };
            required: string[];
        };
        execute: ({ agent_handle, wave_time, task_id }: {
            agent_handle: string;
            wave_time: string;
            task_id?: string;
        }) => Promise<{
            error: string;
            success?: undefined;
            schedule?: undefined;
        } | {
            success: boolean;
            schedule: unknown;
            error?: undefined;
        }>;
    } | {
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
                agent_handle?: undefined;
                wave_time?: undefined;
                task_id?: undefined;
                recipient?: undefined;
                message?: undefined;
                content?: undefined;
                project_id?: undefined;
                title?: undefined;
                description?: undefined;
                priority?: undefined;
                due_date?: undefined;
                comment?: undefined;
                status?: undefined;
                page?: undefined;
                query?: undefined;
                handle?: undefined;
                mine?: undefined;
                visibility?: undefined;
                module_type?: undefined;
                project_type?: undefined;
                team_id?: undefined;
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
                agent_handle?: undefined;
                wave_time?: undefined;
                task_id?: undefined;
                wave_id?: undefined;
                notes?: undefined;
                content?: undefined;
                project_id?: undefined;
                title?: undefined;
                description?: undefined;
                priority?: undefined;
                due_date?: undefined;
                comment?: undefined;
                status?: undefined;
                page?: undefined;
                query?: undefined;
                handle?: undefined;
                mine?: undefined;
                visibility?: undefined;
                module_type?: undefined;
                project_type?: undefined;
                team_id?: undefined;
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
                agent_handle?: undefined;
                wave_time?: undefined;
                task_id?: undefined;
                wave_id?: undefined;
                notes?: undefined;
                recipient?: undefined;
                message?: undefined;
                project_id?: undefined;
                title?: undefined;
                description?: undefined;
                priority?: undefined;
                due_date?: undefined;
                comment?: undefined;
                status?: undefined;
                page?: undefined;
                query?: undefined;
                handle?: undefined;
                mine?: undefined;
                visibility?: undefined;
                module_type?: undefined;
                project_type?: undefined;
                team_id?: undefined;
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
                project_id: {
                    type: string;
                    description: string;
                };
                title: {
                    type: string;
                    description: string;
                };
                description: {
                    type: string;
                    description: string;
                };
                priority: {
                    type: string;
                    enum: string[];
                    description: string;
                };
                due_date: {
                    type: string;
                    description: string;
                };
                agent_handle?: undefined;
                wave_time?: undefined;
                task_id?: undefined;
                wave_id?: undefined;
                notes?: undefined;
                recipient?: undefined;
                message?: undefined;
                content?: undefined;
                comment?: undefined;
                status?: undefined;
                page?: undefined;
                query?: undefined;
                handle?: undefined;
                mine?: undefined;
                visibility?: undefined;
                module_type?: undefined;
                project_type?: undefined;
                team_id?: undefined;
            };
            required: string[];
        };
        execute: ({ project_id, title, description, priority, due_date }: {
            project_id: string;
            title: string;
            description?: string;
            priority?: string;
            due_date?: string;
        }) => Promise<{
            error: string;
            success?: undefined;
            task?: undefined;
        } | {
            success: boolean;
            task: unknown;
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
                agent_handle?: undefined;
                wave_time?: undefined;
                wave_id?: undefined;
                notes?: undefined;
                recipient?: undefined;
                message?: undefined;
                content?: undefined;
                project_id?: undefined;
                title?: undefined;
                description?: undefined;
                priority?: undefined;
                due_date?: undefined;
                status?: undefined;
                page?: undefined;
                query?: undefined;
                handle?: undefined;
                mine?: undefined;
                visibility?: undefined;
                module_type?: undefined;
                project_type?: undefined;
                team_id?: undefined;
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
                agent_handle?: undefined;
                wave_time?: undefined;
                wave_id?: undefined;
                notes?: undefined;
                recipient?: undefined;
                message?: undefined;
                content?: undefined;
                project_id?: undefined;
                title?: undefined;
                description?: undefined;
                priority?: undefined;
                due_date?: undefined;
                comment?: undefined;
                page?: undefined;
                query?: undefined;
                handle?: undefined;
                mine?: undefined;
                visibility?: undefined;
                module_type?: undefined;
                project_type?: undefined;
                team_id?: undefined;
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
                agent_handle?: undefined;
                wave_time?: undefined;
                task_id?: undefined;
                wave_id?: undefined;
                notes?: undefined;
                recipient?: undefined;
                message?: undefined;
                content?: undefined;
                project_id?: undefined;
                title?: undefined;
                description?: undefined;
                priority?: undefined;
                due_date?: undefined;
                comment?: undefined;
                status?: undefined;
                page?: undefined;
                query?: undefined;
                handle?: undefined;
                mine?: undefined;
                visibility?: undefined;
                module_type?: undefined;
                project_type?: undefined;
                team_id?: undefined;
            };
            required?: undefined;
        };
        execute: () => Promise<{
            connected: boolean;
            relay_id: string;
            webhook_url: string;
        }>;
    } | {
        name: string;
        description: string;
        parameters: {
            type: string;
            properties: {
                agent_handle: {
                    type: string;
                    description: string;
                };
                wave_time?: undefined;
                task_id?: undefined;
                wave_id?: undefined;
                notes?: undefined;
                recipient?: undefined;
                message?: undefined;
                content?: undefined;
                project_id?: undefined;
                title?: undefined;
                description?: undefined;
                priority?: undefined;
                due_date?: undefined;
                comment?: undefined;
                status?: undefined;
                page?: undefined;
                query?: undefined;
                handle?: undefined;
                mine?: undefined;
                visibility?: undefined;
                module_type?: undefined;
                project_type?: undefined;
                team_id?: undefined;
            };
            required: string[];
        };
        execute: ({ agent_handle }: {
            agent_handle: string;
        }) => Promise<{
            error: string;
            success?: undefined;
            waves?: undefined;
        } | {
            success: boolean;
            waves: unknown;
            error?: undefined;
        }>;
    } | {
        name: string;
        description: string;
        parameters: {
            type: string;
            properties: {
                status: {
                    type: string;
                    description: string;
                };
                agent_handle?: undefined;
                wave_time?: undefined;
                task_id?: undefined;
                wave_id?: undefined;
                notes?: undefined;
                recipient?: undefined;
                message?: undefined;
                content?: undefined;
                project_id?: undefined;
                title?: undefined;
                description?: undefined;
                priority?: undefined;
                due_date?: undefined;
                comment?: undefined;
                page?: undefined;
                query?: undefined;
                handle?: undefined;
                mine?: undefined;
                visibility?: undefined;
                module_type?: undefined;
                project_type?: undefined;
                team_id?: undefined;
            };
            required?: undefined;
        };
        execute: ({ status }: {
            status?: string;
        }) => Promise<{
            error: string;
            success?: undefined;
            tasks?: undefined;
        } | {
            success: boolean;
            tasks: unknown;
            error?: undefined;
        }>;
    } | {
        name: string;
        description: string;
        parameters: {
            type: string;
            properties: {
                page: {
                    type: string;
                    description: string;
                };
                agent_handle?: undefined;
                wave_time?: undefined;
                task_id?: undefined;
                wave_id?: undefined;
                notes?: undefined;
                recipient?: undefined;
                message?: undefined;
                content?: undefined;
                project_id?: undefined;
                title?: undefined;
                description?: undefined;
                priority?: undefined;
                due_date?: undefined;
                comment?: undefined;
                status?: undefined;
                query?: undefined;
                handle?: undefined;
                mine?: undefined;
                visibility?: undefined;
                module_type?: undefined;
                project_type?: undefined;
                team_id?: undefined;
            };
            required?: undefined;
        };
        execute: ({ page }: {
            page?: number;
        }) => Promise<{
            error: string;
            success?: undefined;
            feed?: undefined;
        } | {
            success: boolean;
            feed: unknown;
            error?: undefined;
        }>;
    } | {
        name: string;
        description: string;
        parameters: {
            type: string;
            properties: {
                query: {
                    type: string;
                    description: string;
                };
                agent_handle?: undefined;
                wave_time?: undefined;
                task_id?: undefined;
                wave_id?: undefined;
                notes?: undefined;
                recipient?: undefined;
                message?: undefined;
                content?: undefined;
                project_id?: undefined;
                title?: undefined;
                description?: undefined;
                priority?: undefined;
                due_date?: undefined;
                comment?: undefined;
                status?: undefined;
                page?: undefined;
                handle?: undefined;
                mine?: undefined;
                visibility?: undefined;
                module_type?: undefined;
                project_type?: undefined;
                team_id?: undefined;
            };
            required: string[];
        };
        execute: ({ query }: {
            query: string;
        }) => Promise<{
            error: string;
            success?: undefined;
            users?: undefined;
        } | {
            success: boolean;
            users: unknown;
            error?: undefined;
        }>;
    } | {
        name: string;
        description: string;
        parameters: {
            type: string;
            properties: {
                handle: {
                    type: string;
                    description: string;
                };
                agent_handle?: undefined;
                wave_time?: undefined;
                task_id?: undefined;
                wave_id?: undefined;
                notes?: undefined;
                recipient?: undefined;
                message?: undefined;
                content?: undefined;
                project_id?: undefined;
                title?: undefined;
                description?: undefined;
                priority?: undefined;
                due_date?: undefined;
                comment?: undefined;
                status?: undefined;
                page?: undefined;
                query?: undefined;
                mine?: undefined;
                visibility?: undefined;
                module_type?: undefined;
                project_type?: undefined;
                team_id?: undefined;
            };
            required: string[];
        };
        execute: ({ handle }: {
            handle: string;
        }) => Promise<{
            error: string;
            success?: undefined;
            profile?: undefined;
        } | {
            success: boolean;
            profile: unknown;
            error?: undefined;
        }>;
    } | {
        name: string;
        description: string;
        parameters: {
            type: string;
            properties: {
                handle: {
                    type: string;
                    description: string;
                };
                agent_handle?: undefined;
                wave_time?: undefined;
                task_id?: undefined;
                wave_id?: undefined;
                notes?: undefined;
                recipient?: undefined;
                message?: undefined;
                content?: undefined;
                project_id?: undefined;
                title?: undefined;
                description?: undefined;
                priority?: undefined;
                due_date?: undefined;
                comment?: undefined;
                status?: undefined;
                page?: undefined;
                query?: undefined;
                mine?: undefined;
                visibility?: undefined;
                module_type?: undefined;
                project_type?: undefined;
                team_id?: undefined;
            };
            required: string[];
        };
        execute: ({ handle }: {
            handle: string;
        }) => Promise<{
            error: string;
            success?: undefined;
            followed?: undefined;
        } | {
            success: boolean;
            followed: string;
            error?: undefined;
        }>;
    } | {
        name: string;
        description: string;
        parameters: {
            type: string;
            properties: {
                agent_handle?: undefined;
                wave_time?: undefined;
                task_id?: undefined;
                wave_id?: undefined;
                notes?: undefined;
                recipient?: undefined;
                message?: undefined;
                content?: undefined;
                project_id?: undefined;
                title?: undefined;
                description?: undefined;
                priority?: undefined;
                due_date?: undefined;
                comment?: undefined;
                status?: undefined;
                page?: undefined;
                query?: undefined;
                handle?: undefined;
                mine?: undefined;
                visibility?: undefined;
                module_type?: undefined;
                project_type?: undefined;
                team_id?: undefined;
            };
            required?: undefined;
        };
        execute: () => Promise<{
            error: string;
            success?: undefined;
            notifications?: undefined;
        } | {
            success: boolean;
            notifications: unknown;
            error?: undefined;
        }>;
    } | {
        name: string;
        description: string;
        parameters: {
            type: string;
            properties: {
                query: {
                    type: string;
                    description: string;
                };
                mine: {
                    type: string;
                    description: string;
                };
                page: {
                    type: string;
                    description: string;
                };
                agent_handle?: undefined;
                wave_time?: undefined;
                task_id?: undefined;
                wave_id?: undefined;
                notes?: undefined;
                recipient?: undefined;
                message?: undefined;
                content?: undefined;
                project_id?: undefined;
                title?: undefined;
                description?: undefined;
                priority?: undefined;
                due_date?: undefined;
                comment?: undefined;
                status?: undefined;
                handle?: undefined;
                visibility?: undefined;
                module_type?: undefined;
                project_type?: undefined;
                team_id?: undefined;
            };
            required?: undefined;
        };
        execute: ({ query, mine, page }: {
            query?: string;
            mine?: boolean;
            page?: number;
        }) => Promise<{
            error: string;
            success?: undefined;
            projects?: undefined;
        } | {
            success: boolean;
            projects: unknown;
            error?: undefined;
        }>;
    } | {
        name: string;
        description: string;
        parameters: {
            type: string;
            properties: {
                title: {
                    type: string;
                    description: string;
                };
                description: {
                    type: string;
                    description: string;
                };
                visibility: {
                    type: string;
                    enum: string[];
                    description: string;
                };
                module_type: {
                    type: string;
                    enum: string[];
                    description: string;
                };
                project_type: {
                    type: string;
                    description: string;
                };
                team_id: {
                    type: string;
                    description: string;
                };
                agent_handle?: undefined;
                wave_time?: undefined;
                task_id?: undefined;
                wave_id?: undefined;
                notes?: undefined;
                recipient?: undefined;
                message?: undefined;
                content?: undefined;
                project_id?: undefined;
                priority?: undefined;
                due_date?: undefined;
                comment?: undefined;
                status?: undefined;
                page?: undefined;
                query?: undefined;
                handle?: undefined;
                mine?: undefined;
            };
            required: string[];
        };
        execute: ({ title, description, visibility, module_type, project_type, team_id }: {
            title: string;
            description?: string;
            visibility?: string;
            module_type?: string;
            project_type?: string;
            team_id?: string;
        }) => Promise<{
            error: string;
            success?: undefined;
            project?: undefined;
        } | {
            success: boolean;
            project: unknown;
            error?: undefined;
        }>;
    } | {
        name: string;
        description: string;
        parameters: {
            type: string;
            properties: {
                project_id: {
                    type: string;
                    description: string;
                };
                handle: {
                    type: string;
                    description: string;
                };
                agent_handle?: undefined;
                wave_time?: undefined;
                task_id?: undefined;
                wave_id?: undefined;
                notes?: undefined;
                recipient?: undefined;
                message?: undefined;
                content?: undefined;
                title?: undefined;
                description?: undefined;
                priority?: undefined;
                due_date?: undefined;
                comment?: undefined;
                status?: undefined;
                page?: undefined;
                query?: undefined;
                mine?: undefined;
                visibility?: undefined;
                module_type?: undefined;
                project_type?: undefined;
                team_id?: undefined;
            };
            required: string[];
        };
        execute: ({ project_id, handle }: {
            project_id: string;
            handle: string;
        }) => Promise<{
            error: string;
            success?: undefined;
            added?: undefined;
        } | {
            success: boolean;
            added: string;
            error?: undefined;
        }>;
    } | {
        name: string;
        description: string;
        parameters: {
            type: string;
            properties: {
                project_id: {
                    type: string;
                    description: string;
                };
                agent_handle?: undefined;
                wave_time?: undefined;
                task_id?: undefined;
                wave_id?: undefined;
                notes?: undefined;
                recipient?: undefined;
                message?: undefined;
                content?: undefined;
                title?: undefined;
                description?: undefined;
                priority?: undefined;
                due_date?: undefined;
                comment?: undefined;
                status?: undefined;
                page?: undefined;
                query?: undefined;
                handle?: undefined;
                mine?: undefined;
                visibility?: undefined;
                module_type?: undefined;
                project_type?: undefined;
                team_id?: undefined;
            };
            required: string[];
        };
        execute: ({ project_id }: {
            project_id: string;
        }) => Promise<{
            error: string;
            success?: undefined;
            members?: undefined;
        } | {
            success: boolean;
            members: unknown;
            error?: undefined;
        }>;
    })[];
};
export {};
