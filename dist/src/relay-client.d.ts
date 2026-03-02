/**
 * PowerLobster Relay Client
 * Connects to wss://relay.powerlobster.com for real-time events
 */
export interface RelayEvent {
    type: string;
    payload: any;
    timestamp: string;
}
export type EventHandler = (event: RelayEvent) => void;
export interface RelayConfig {
    apiKey: string;
    relayId: string;
    relayUrl?: string;
}
export declare class PowerLobsterRelay {
    private ws;
    private config;
    private reconnectInterval;
    private maxReconnectInterval;
    private currentReconnectInterval;
    private eventHandler;
    private isConnected;
    private shouldReconnect;
    private heartbeatInterval;
    constructor(config: RelayConfig, eventHandler: EventHandler);
    connect(): void;
    private startHeartbeat;
    private stopHeartbeat;
    disconnect(): void;
    isActive(): boolean;
}
