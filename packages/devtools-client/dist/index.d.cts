import { CiphServerLog, CiphClientLog, CiphErrorCode } from '@ciph/core';
import * as react_jsx_runtime from 'react/jsx-runtime';

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
    private channel;
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

interface CiphDevtoolsProps extends CiphDevtoolsOptions {
    position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
    defaultOpen?: boolean;
    shortcut?: string | null;
    disabled?: boolean;
    inspectorUrl?: string;
}
declare function DevtoolsComponent(props: CiphDevtoolsProps): react_jsx_runtime.JSX.Element | null;
declare const CiphDevtools: typeof DevtoolsComponent;

declare function CiphInspectorPage(): react_jsx_runtime.JSX.Element;

export { CiphDevtools, CiphDevtoolsClient, type CiphDevtoolsOptions, type CiphDevtoolsProps, type CiphDevtoolsStats, CiphInspectorPage, type CiphLogEntry, type CiphLogSource };
