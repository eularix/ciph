package middleware

import (
	"encoding/json"
	"net/http"
	"sync"

	"github.com/Eularix/ciph/modules/ciph-go/core"
)

// DevToolsBuffer holds circular buffer of logs for inspector.
type DevToolsBuffer struct {
	logs    []core.CiphServerLog
	maxSize int
	mutex   sync.RWMutex
}

// NewDevToolsBuffer creates new circular log buffer.
func NewDevToolsBuffer(maxSize int) *DevToolsBuffer {
	if maxSize <= 0 {
		maxSize = 500
	}
	return &DevToolsBuffer{
		logs:    make([]core.CiphServerLog, 0, maxSize),
		maxSize: maxSize,
	}
}

// Append adds log to circular buffer (newest first).
func (db *DevToolsBuffer) Append(log core.CiphServerLog) {
	db.mutex.Lock()
	defer db.mutex.Unlock()

	if len(db.logs) < db.maxSize {
		db.logs = append([]core.CiphServerLog{log}, db.logs...)
	} else {
		// Rotate: remove last, prepend new
		db.logs = append([]core.CiphServerLog{log}, db.logs[:db.maxSize-1]...)
	}
}

// GetAll returns all logs (newest first).
func (db *DevToolsBuffer) GetAll() []core.CiphServerLog {
	db.mutex.RLock()
	defer db.mutex.RUnlock()

	result := make([]core.CiphServerLog, len(db.logs))
	copy(result, db.logs)
	return result
}

// Clear empties buffer.
func (db *DevToolsBuffer) Clear() {
	db.mutex.Lock()
	defer db.mutex.Unlock()
	db.logs = make([]core.CiphServerLog, 0, db.maxSize)
}

// Size returns current log count.
func (db *DevToolsBuffer) Size() int {
	db.mutex.RLock()
	defer db.mutex.RUnlock()
	return len(db.logs)
}

// RegisterDevToolsRoutes registers /ciph endpoints (dev-only).
func (m *Middleware) RegisterDevToolsRoutes(devtools *DevToolsBuffer) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/ciph" && r.Method == "GET" {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Write([]byte(buildInspectorHTML()))
			return
		}

		if r.URL.Path == "/ciph/logs" && r.Method == "GET" {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(devtools.GetAll())
			return
		}

		if r.URL.Path == "/ciph/logs" && r.Method == "DELETE" {
			devtools.Clear()
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{"status": "cleared"})
			return
		}

		w.WriteHeader(http.StatusNotFound)
	})
}

// buildInspectorHTML returns vanilla HTML inspector UI (no unsafe innerHTML).
func buildInspectorHTML() string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ciph Inspector - Go</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0f1117; --bg2: #161b22; --bg3: #1c2230;
      --border: #30363d; --text: #e6edf3; --text2: #8b949e;
      --green: #3fb950; --red: #f85149; --blue: #58a6ff;
    }
    body { background: var(--bg); color: var(--text); font-family: monospace; font-size: 13px; height: 100vh; display: flex; flex-direction: column; }
    header { background: var(--bg2); border-bottom: 1px solid var(--border); padding: 12px 20px; display: flex; align-items: center; gap: 16px; }
    h1 { font-size: 15px; font-weight: 600; }
    .main { display: flex; flex: 1; overflow: hidden; }
    .log-list { width: 420px; border-right: 1px solid var(--border); overflow-y: auto; }
    .log-row { padding: 9px 12px; border-bottom: 1px solid var(--border); cursor: pointer; }
    .log-row:hover { background: var(--bg2); }
    .log-row.selected { background: var(--bg3); }
    .detail { flex: 1; overflow-y: auto; padding: 20px; }
    code { background: var(--bg2); padding: 8px; border-radius: 4px; display: block; margin: 8px 0; font-size: 11px; color: var(--text2); word-break: break-all; }
    .btn { padding: 5px 12px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg3); color: var(--text2); cursor: pointer; font-size: 12px; font-family: monospace; margin-left: auto; }
    .btn:hover { color: var(--text); }
  </style>
</head>
<body>
  <header>
    <h1>🔒 Ciph Inspector (Go)</h1>
    <button class="btn" onclick="loadLogs()">Refresh</button>
    <button class="btn" onclick="clearLogs()">Clear</button>
  </header>
  <div class="main">
    <div class="log-list" id="log-list"></div>
    <div class="detail" id="detail">
      <p style="color: var(--text2);">Select a request</p>
    </div>
  </div>
  <script>
    let logs = [];
    function loadLogs() {
      fetch('/ciph/logs')
        .then(r => r.json())
        .then(data => {
          logs = data || [];
          renderLogs();
        })
        .catch(e => console.error('Failed to load logs:', e));
    }
    function renderLogs() {
      const list = document.getElementById('log-list');
      list.textContent = '';
      (logs || []).forEach((log, i) => {
        const div = document.createElement('div');
        div.className = 'log-row';
        div.textContent = log.method + ' ' + log.url.substring(0, 30);
        div.onclick = () => showDetail(i);
        list.appendChild(div);
      });
    }
    function showDetail(idx) {
      const log = logs[idx];
      const detail = document.getElementById('detail');
      detail.textContent = '';
      
      const h3 = document.createElement('h3');
      h3.textContent = log.method + ' ' + log.url;
      detail.appendChild(h3);
      
      const p = document.createElement('p');
      p.textContent = 'Status: ' + log.status;
      detail.appendChild(p);
      
      const h4a = document.createElement('h4');
      h4a.textContent = 'Request (encrypted)';
      detail.appendChild(h4a);
      
      const codeA = document.createElement('code');
      codeA.textContent = (log.request_body || '(empty)').substring(0, 200);
      detail.appendChild(codeA);
      
      const h4b = document.createElement('h4');
      h4b.textContent = 'Response (encrypted)';
      detail.appendChild(h4b);
      
      const codeB = document.createElement('code');
      codeB.textContent = (log.response_body || '(empty)').substring(0, 200);
      detail.appendChild(codeB);
    }
    function clearLogs() {
      fetch('/ciph/logs', { method: 'DELETE' }).then(() => loadLogs());
    }
    loadLogs();
    setInterval(loadLogs, 1000);
  </script>
</body>
</html>`
}
