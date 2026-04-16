import { CiphServerLog } from '@ciph/core';

interface CiphDevtoolsServerOptions {
    port?: number;
    maxLogs?: number;
    cors?: string[];
}
interface CiphDevtoolsStats {
    totalLogs: number;
    maxLogs: number;
    activeConnections: number;
    uptimeMs: number;
}

interface CiphServerEmitterLike {
    on(event: 'log', listener: (payload: CiphServerLog) => void): void;
    off(event: 'log', listener: (payload: CiphServerLog) => void): void;
}
declare global {
    var ciphServerEmitter: CiphServerEmitterLike | undefined;
}

declare class CiphDevtoolsServer {
    private readonly port;
    private readonly maxLogs;
    private readonly cors;
    private readonly logs;
    private readonly wsClients;
    private server;
    private wsServer;
    private startedAt;
    private logListener;
    constructor(options?: CiphDevtoolsServerOptions);
    start(): Promise<void>;
    stop(): Promise<void>;
    getLogs(): CiphServerLog[];
    clearLogs(): void;
    getStats(): CiphDevtoolsStats;
    private pushLog;
    private broadcast;
    private handleHttp;
    private writeJson;
    private isOriginAllowed;
}

export { CiphDevtoolsServer, type CiphDevtoolsServerOptions, type CiphDevtoolsStats };
