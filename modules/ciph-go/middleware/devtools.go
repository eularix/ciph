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
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(200)
			return
		}

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

// buildInspectorHTML returns standalone HTML inspector UI matching the Hono devtools format.
func buildInspectorHTML() string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ciph Inspector — Go</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0f1117; --bg2: #161b22; --bg3: #1c2230;
      --border: #30363d; --text: #e6edf3; --text2: #8b949e;
      --green: #3fb950; --red: #f85149; --blue: #58a6ff; --yellow: #d29922;
    }
    body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace; font-size: 13px; height: 100vh; display: flex; flex-direction: column; }
    header { background: var(--bg2); border-bottom: 1px solid var(--border); padding: 12px 20px; display: flex; align-items: center; gap: 16px; }
    h1 { font-size: 15px; font-weight: 600; }
    .badge { background: var(--bg3); border: 1px solid var(--border); border-radius: 12px; padding: 2px 10px; font-size: 11px; color: var(--text2); }
    .main { display: flex; flex: 1; overflow: hidden; }
    .log-list { width: 420px; border-right: 1px solid var(--border); overflow-y: auto; }
    .log-row { padding: 10px 14px; border-bottom: 1px solid var(--border); cursor: pointer; display: flex; gap: 8px; align-items: center; }
    .log-row:hover { background: var(--bg2); }
    .log-row.selected { background: var(--bg3); border-left: 2px solid var(--blue); }
    .method { font-weight: 700; font-size: 11px; width: 44px; text-align: center; border-radius: 4px; padding: 2px 0; }
    .method-get { color: var(--green); }
    .method-post { color: var(--blue); }
    .method-put { color: var(--yellow); }
    .method-delete { color: var(--red); }
    .route { flex: 1; color: var(--text2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .status { font-size: 11px; font-weight: 600; }
    .status-ok { color: var(--green); }
    .status-err { color: var(--red); }
    .dur { font-size: 11px; color: var(--text2); }
    .detail { flex: 1; overflow-y: auto; padding: 20px; }
    .detail h3 { margin-bottom: 12px; font-size: 14px; }
    .detail-section { margin-bottom: 16px; }
    .detail-section h4 { font-size: 12px; color: var(--text2); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
    pre { background: var(--bg2); padding: 10px 12px; border-radius: 6px; font-size: 11px; color: var(--text2); word-break: break-all; white-space: pre-wrap; overflow-x: auto; border: 1px solid var(--border); max-height: 300px; overflow-y: auto; }
    .tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; }
    .tag-encrypted { background: #1a3a2a; color: var(--green); }
    .tag-excluded { background: #3a2a1a; color: var(--yellow); }
    .tag-error { background: #3a1a1a; color: var(--red); }
    .fp-row { display: flex; gap: 12px; }
    .fp-badge { padding: 2px 8px; border-radius: 4px; font-size: 11px; }
    .fp-match { background: #1a3a2a; color: var(--green); }
    .fp-mismatch { background: #3a1a1a; color: var(--red); }
    .btn { padding: 5px 14px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg3); color: var(--text2); cursor: pointer; font-size: 12px; font-family: inherit; }
    .btn:hover { color: var(--text); border-color: var(--text2); }
    .spacer { flex: 1; }
    .empty { color: var(--text2); padding: 40px; text-align: center; }
  </style>
</head>
<body>
  <header>
    <h1>🔒 Ciph Inspector</h1>
    <span class="badge">Go</span>
    <span class="badge" id="count-badge">0 logs</span>
    <span class="spacer"></span>
    <button class="btn" onclick="loadLogs()">↻ Refresh</button>
    <button class="btn" onclick="clearLogs()">✕ Clear</button>
  </header>
  <div class="main">
    <div class="log-list" id="log-list">
      <div class="empty">No logs yet — make a request</div>
    </div>
    <div class="detail" id="detail">
      <div class="empty">Select a request to inspect</div>
    </div>
  </div>
  <script>
    let logs = [];
    let selected = -1;

    function loadLogs() {
      fetch('/ciph/logs')
        .then(r => r.json())
        .then(data => {
          logs = data || [];
          document.getElementById('count-badge').textContent = logs.length + ' logs';
          renderLogs();
        })
        .catch(e => console.error('Failed to load logs:', e));
    }

    function renderLogs() {
      const list = document.getElementById('log-list');
      list.textContent = '';

      if (logs.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = 'No logs yet — make a request';
        list.appendChild(empty);
        return;
      }

      logs.forEach((log, i) => {
        const div = document.createElement('div');
        div.className = 'log-row' + (i === selected ? ' selected' : '');

        const method = document.createElement('span');
        method.className = 'method method-' + log.method.toLowerCase();
        method.textContent = log.method;
        div.appendChild(method);

        const route = document.createElement('span');
        route.className = 'route';
        route.textContent = log.route;
        div.appendChild(route);

        const status = document.createElement('span');
        status.className = 'status ' + (log.status < 400 ? 'status-ok' : 'status-err');
        status.textContent = log.status;
        div.appendChild(status);

        const dur = document.createElement('span');
        dur.className = 'dur';
        dur.textContent = log.duration + 'ms';
        div.appendChild(dur);

        div.onclick = () => { selected = i; renderLogs(); showDetail(i); };
        list.appendChild(div);
      });
    }

    function showDetail(idx) {
      const log = logs[idx];
      const detail = document.getElementById('detail');
      detail.innerHTML = '';

      // Header
      const h3 = document.createElement('h3');
      h3.textContent = log.method + ' ' + log.route;
      detail.appendChild(h3);

      // Tags
      const tags = document.createElement('div');
      tags.style.cssText = 'margin-bottom: 16px; display: flex; gap: 8px;';
      if (log.excluded) {
        const t = document.createElement('span');
        t.className = 'tag tag-excluded';
        t.textContent = 'EXCLUDED';
        tags.appendChild(t);
      } else if (log.error) {
        const t = document.createElement('span');
        t.className = 'tag tag-error';
        t.textContent = log.error;
        tags.appendChild(t);
      } else {
        const t = document.createElement('span');
        t.className = 'tag tag-encrypted';
        t.textContent = 'ENCRYPTED';
        tags.appendChild(t);
      }
      const st = document.createElement('span');
      st.className = 'tag';
      st.style.cssText = 'background: var(--bg3); color: var(--text2); border: 1px solid var(--border);';
      st.textContent = log.status + ' · ' + log.duration + 'ms';
      tags.appendChild(st);
      detail.appendChild(tags);

      // ECDH
      if (log.ecdh) {
        const sec = document.createElement('div');
        sec.className = 'detail-section';
        const h4 = document.createElement('h4');
        h4.textContent = 'ECDH Key Exchange';
        sec.appendChild(h4);
        const pre = document.createElement('pre');
        pre.textContent = 'Client Public Key: ' + (log.ecdh.clientPublicKey || '').substring(0, 40) + '...\nSession Key Derived: ' + (log.ecdh.sharedSecretDerived ? '✓ Yes' : '✕ No');
        sec.appendChild(pre);
        detail.appendChild(sec);
      }

      // Fingerprint
      if (log.fingerprint && log.fingerprint.value) {
        const sec = document.createElement('div');
        sec.className = 'detail-section';
        const h4 = document.createElement('h4');
        h4.textContent = 'Fingerprint';
        sec.appendChild(h4);
        const row = document.createElement('div');
        row.className = 'fp-row';
        row.style.marginBottom = '8px';

        const ua = document.createElement('span');
        ua.className = 'fp-badge ' + (log.fingerprint.uaMatch ? 'fp-match' : 'fp-mismatch');
        ua.textContent = 'UA: ' + (log.fingerprint.uaMatch ? '✓ match' : '✕ mismatch');
        row.appendChild(ua);

        const ip = document.createElement('span');
        ip.className = 'fp-badge ' + (log.fingerprint.ipMatch ? 'fp-match' : 'fp-mismatch');
        ip.textContent = 'IP: ' + (log.fingerprint.ipMatch ? '✓ match' : '✕ skip (v2)');
        row.appendChild(ip);

        sec.appendChild(row);
        const pre = document.createElement('pre');
        pre.textContent = log.fingerprint.value.substring(0, 64);
        sec.appendChild(pre);
        detail.appendChild(sec);
      }

      // Request
      const reqSec = document.createElement('div');
      reqSec.className = 'detail-section';
      const reqH4 = document.createElement('h4');
      reqH4.textContent = 'Request';
      reqSec.appendChild(reqH4);

      if (log.request) {
        const info = document.createElement('pre');
        info.textContent = 'IP: ' + (log.request.ip || '-') + '\nUA: ' + (log.request.userAgent || '-');
        reqSec.appendChild(info);

        if (log.request.plainBody) {
          const lbl = document.createElement('h4');
          lbl.textContent = 'Decrypted Body';
          lbl.style.marginTop = '8px';
          reqSec.appendChild(lbl);
          const pre = document.createElement('pre');
          pre.textContent = JSON.stringify(log.request.plainBody, null, 2);
          reqSec.appendChild(pre);
        }
        if (log.request.encryptedBody) {
          const lbl = document.createElement('h4');
          lbl.textContent = 'Encrypted Body (wire)';
          lbl.style.marginTop = '8px';
          reqSec.appendChild(lbl);
          const pre = document.createElement('pre');
          pre.textContent = log.request.encryptedBody.substring(0, 200) + (log.request.encryptedBody.length > 200 ? '...' : '');
          reqSec.appendChild(pre);
        }
      }
      detail.appendChild(reqSec);

      // Response
      const resSec = document.createElement('div');
      resSec.className = 'detail-section';
      const resH4 = document.createElement('h4');
      resH4.textContent = 'Response';
      resSec.appendChild(resH4);

      if (log.response) {
        if (log.response.plainBody) {
          const lbl = document.createElement('h4');
          lbl.textContent = 'Decrypted Body';
          resSec.appendChild(lbl);
          const pre = document.createElement('pre');
          pre.textContent = JSON.stringify(log.response.plainBody, null, 2);
          resSec.appendChild(pre);
        }
        if (log.response.encryptedBody) {
          const lbl = document.createElement('h4');
          lbl.textContent = 'Encrypted Body (wire)';
          lbl.style.marginTop = '8px';
          resSec.appendChild(lbl);
          const pre = document.createElement('pre');
          pre.textContent = log.response.encryptedBody.substring(0, 200) + (log.response.encryptedBody.length > 200 ? '...' : '');
          resSec.appendChild(pre);
        }
      }
      detail.appendChild(resSec);

      // Headers
      if (log.request && log.request.headers) {
        const hSec = document.createElement('div');
        hSec.className = 'detail-section';
        const hH4 = document.createElement('h4');
        hH4.textContent = 'Request Headers';
        hSec.appendChild(hH4);
        const pre = document.createElement('pre');
        pre.textContent = Object.entries(log.request.headers).map(([k,v]) => k + ': ' + v).join('\n');
        hSec.appendChild(pre);
        detail.appendChild(hSec);
      }
    }

    function clearLogs() {
      fetch('/ciph/logs', { method: 'DELETE' }).then(() => {
        logs = [];
        selected = -1;
        document.getElementById('count-badge').textContent = '0 logs';
        renderLogs();
        document.getElementById('detail').innerHTML = '<div class="empty">Select a request to inspect</div>';
      });
    }

    loadLogs();
    setInterval(loadLogs, 1500);
  </script>
</body>
</html>`
}
