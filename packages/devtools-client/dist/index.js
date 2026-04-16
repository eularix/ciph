// @ciph/devtools-client v0.1.0

// src/client.ts
var CiphDevtoolsClient = class {
  maxLogs;
  filter;
  logs = [];
  logCallbacks = [];
  clientUnsubscribe;
  serverUnsubscribe;
  connected = false;
  autoConnect;
  constructor(options = {}) {
    this.maxLogs = options.maxLogs ?? 500;
    this.filter = options.filter;
    this.autoConnect = options.autoConnect ?? true;
    if (this.autoConnect) {
      this.connect();
    }
  }
  connect() {
    if (this.connected) return;
    const root = globalThis;
    const clientEmitter = root.__ciphClientEmitter__;
    if (clientEmitter?.on) {
      this.clientUnsubscribe = clientEmitter.on("log", (log) => {
        const clientLog = log;
        const entry = {
          id: clientLog.id,
          source: "client",
          timestamp: clientLog.timestamp,
          log: clientLog
        };
        this.addLog(entry);
      });
    }
    const serverEmitter = root.ciphServerEmitter;
    if (serverEmitter?.on) {
      this.serverUnsubscribe = serverEmitter.on("log", (log) => {
        const serverLog = log;
        const entry = {
          id: serverLog.id,
          source: "server",
          timestamp: serverLog.timestamp,
          log: serverLog
        };
        this.addLog(entry);
      });
    }
    this.connected = true;
  }
  disconnect() {
    this.clientUnsubscribe?.();
    this.serverUnsubscribe?.();
    this.clientUnsubscribe = void 0;
    this.serverUnsubscribe = void 0;
    this.connected = false;
  }
  addLog(entry) {
    if (this.filter?.(entry) === false) return;
    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }
    for (const cb of this.logCallbacks) {
      cb(entry);
    }
  }
  getLogs() {
    return [...this.logs];
  }
  clearLogs() {
    this.logs = [];
  }
  onLog(callback) {
    this.logCallbacks.push(callback);
    return () => {
      const index = this.logCallbacks.indexOf(callback);
      if (index >= 0) {
        this.logCallbacks.splice(index, 1);
      }
    };
  }
  getStats() {
    if (this.logs.length === 0) {
      return {
        totalRequests: 0,
        totalErrors: 0,
        avgDuration: 0,
        encryptedCount: 0,
        excludedCount: 0,
        errorBreakdown: {}
      };
    }
    let totalDuration = 0;
    let totalErrors = 0;
    let encryptedCount = 0;
    let excludedCount = 0;
    const errorBreakdown = {};
    for (const entry of this.logs) {
      const log = entry.log;
      totalDuration += log.duration;
      if (log.status >= 400) {
        totalErrors += 1;
      }
      if (log.excluded) {
        excludedCount += 1;
      } else {
        encryptedCount += 1;
      }
      if ("error" in log && log.error) {
        const errorCode = log.error;
        errorBreakdown[errorCode] = (errorBreakdown[errorCode] ?? 0) + 1;
      }
    }
    return {
      totalRequests: this.logs.length,
      totalErrors,
      avgDuration: Math.round(totalDuration / this.logs.length),
      encryptedCount,
      excludedCount,
      errorBreakdown
    };
  }
  isConnected() {
    return this.connected;
  }
};
export {
  CiphDevtoolsClient
};
//# sourceMappingURL=index.js.map