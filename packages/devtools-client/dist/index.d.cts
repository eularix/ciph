import { CiphServerLog, CiphClientLog, CiphErrorCode } from '@ciph/core';

interface CiphDevtoolsOptions {
    maxLogs?: number;
    autoConnect?: boolean;
    filter?: (entry: CiphLogEntry) => boolean;
}
type CiphLogSource = "server" | "client";
interface CiphLogEntry {
    id: string;
    source: CiphLogSource;
    timestamp: string;
    log: CiphServerLog | CiphClientLog;
}
interface CiphDevtoolsStats {
    totalRequests: number;
    totalErrors: number;
    avgDuration: number;
    encryptedCount: number;
    excludedCount: number;
    errorBreakdown: Partial<Record<CiphErrorCode, number>>;
}

declare class CiphDevtoolsClient {
    private maxLogs;
    private filter;
    private logs;
    private logCallbacks;
    private clientUnsubscribe;
    private serverUnsubscribe;
    private connected;
    private autoConnect;
    constructor(options?: CiphDevtoolsOptions);
    connect(): void;
    disconnect(): void;
    private addLog;
    getLogs(): CiphLogEntry[];
    clearLogs(): void;
    onLog(callback: (entry: CiphLogEntry) => void): () => void;
    getStats(): CiphDevtoolsStats;
    isConnected(): boolean;
}

export { CiphDevtoolsClient, type CiphDevtoolsOptions, type CiphDevtoolsStats, type CiphLogEntry, type CiphLogSource };
