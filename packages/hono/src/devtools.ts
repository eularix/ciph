import type { CiphServerLog } from "@ciph/core"
import { Hono } from "hono"

// ─── Emitter ──────────────────────────────────────────────────────────────────

export interface CiphHonoEmitter {
  emit(event: "log", log: CiphServerLog): void
  on(event: "log", listener: (log: CiphServerLog) => void): void
  off(event: "log", listener: (log: CiphServerLog) => void): void
}

declare global {
  // eslint-disable-next-line no-var
  var ciphServerEmitter: CiphHonoEmitter | undefined
}

// ─── DevTools Config ──────────────────────────────────────────────────────────

export interface CiphDevtoolsConfig {
  /**
   * If true (default), keep logs only in memory (_logs array / circular buffer).
   * If false, also persist logs to disk as JSONL (JSON Lines format).
   * File-based logging requires Node.js runtime.
   */
  temporary?: boolean

  /**
   * Path to log file (JSONL format). Only used if temporary === false.
   * Default: ".ciph-logs.jsonl"
   * Relative to process.cwd() in Node.js.
   */
  logFilePath?: string

  /**
   * Max in-memory buffer size (circular). Default: 500
   */
  maxInMemoryLogs?: number
}

// ─── Log buffer ────────────────────────────────────────────────────────────

const _logs: CiphServerLog[] = []
let _maxLogs = 500
let _bufferSubscribed = false
let _devtoolsConfig: CiphDevtoolsConfig = { temporary: true, logFilePath: ".ciph-logs.jsonl" }

// Write log to file (Node.js only, gracefully skips on other runtimes)
async function writeLogToFile(log: CiphServerLog): Promise<void> {
  if (_devtoolsConfig.temporary !== false || typeof global === "undefined") return

  try {
    // Node.js runtime
    if (typeof require !== "undefined") {
      const fs = require("fs")
      const path = require("path")
      const logPath = path.resolve(_devtoolsConfig.logFilePath || ".ciph-logs.jsonl")
      const line = JSON.stringify(log) + "\n"
      fs.appendFileSync(logPath, line)
      return
    }
  } catch (e) {
    // Silently fail in dev — file I/O not available
  }
}

// Clear log file (Node.js only)
function clearLogFile(): void {
  if (_devtoolsConfig.temporary !== false || typeof global === "undefined") return

  try {
    if (typeof require !== "undefined") {
      const fs = require("fs")
      const path = require("path")
      const logPath = path.resolve(_devtoolsConfig.logFilePath || ".ciph-logs.jsonl")
      if (fs.existsSync(logPath)) fs.unlinkSync(logPath)
    }
  } catch (e) {
    // Silently fail
  }
}

export function autoInitEmitter(): void {
  if (globalThis.ciphServerEmitter) return
  const listeners: Array<(log: CiphServerLog) => void> = []
  globalThis.ciphServerEmitter = {
    emit(event, log) {
      if (event === "log") for (const l of listeners) l(log)
    },
    on(event, listener) {
      if (event === "log") listeners.push(listener)
    },
    off(event, listener) {
      if (event === "log") {
        const i = listeners.indexOf(listener)
        if (i >= 0) listeners.splice(i, 1)
      }
    },
  }
}

// Subscribe the in-memory log buffer to the emitter.
// Called once after autoInitEmitter() so the buffer accumulates logs
// even before any browser connects to /ciph-devtools/stream.
export function initDevtools(config?: CiphDevtoolsConfig): void {
  if (_bufferSubscribed) return
  _bufferSubscribed = true

  // Merge config
  if (config) {
    _devtoolsConfig = { ...{ temporary: true, logFilePath: ".ciph-logs.jsonl" }, ...config }
  }

  // Apply max logs setting
  if (config?.maxInMemoryLogs) {
    _maxLogs = config.maxInMemoryLogs
  }

  globalThis.ciphServerEmitter?.on("log", (log) => {
    // Add to in-memory circular buffer
    _logs.unshift(log)
    if (_logs.length > _maxLogs) _logs.pop()

    // Write to disk if persistent mode
    if (_devtoolsConfig.temporary === false) {
      writeLogToFile(log).catch(() => { /* silently fail */ })
    }
  })
}

// ─── Inspector HTML ────────────────────────────────────────────────────────────

function buildInspectorHtml(streamUrl: string, logsUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Ciph Inspector</title>
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  :root{--bg:#0f1117;--bg2:#161b22;--bg3:#1c2230;--border:#30363d;--text:#e6edf3;--text2:#8b949e;--green:#3fb950;--red:#f85149;--blue:#58a6ff;--orange:#d29922;--purple:#bc8cff;}
  body{background:var(--bg);color:var(--text);font-family:'Menlo','Monaco','Consolas',monospace;font-size:13px;height:100vh;display:flex;flex-direction:column;overflow:hidden;}
  header{background:var(--bg2);border-bottom:1px solid var(--border);padding:12px 20px;display:flex;align-items:center;gap:16px;flex-shrink:0;}
  h1{font-size:15px;font-weight:600;letter-spacing:.5px;}
  .dot{width:8px;height:8px;border-radius:50%;background:var(--red);flex-shrink:0;}
  .dot.live{background:var(--green);box-shadow:0 0 6px var(--green);}
  .lbl{font-size:11px;color:var(--text2);}
  .spacer{flex:1;}
  .btn{padding:5px 12px;border-radius:6px;border:1px solid var(--border);background:var(--bg3);color:var(--text2);cursor:pointer;font-size:12px;font-family:inherit;}
  .btn:hover{color:var(--text);border-color:var(--text2);}
  .badge{background:var(--bg3);border:1px solid var(--border);border-radius:10px;padding:2px 8px;font-size:11px;color:var(--text2);}
  .main{display:flex;flex:1;overflow:hidden;}
  .list{width:420px;border-right:1px solid var(--border);overflow-y:auto;flex-shrink:0;}
  .list-head{position:sticky;top:0;background:var(--bg2);border-bottom:1px solid var(--border);padding:8px 12px;display:grid;grid-template-columns:60px 1fr 52px 52px;gap:8px;font-size:11px;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;z-index:1;}
  .row{padding:9px 12px;display:grid;grid-template-columns:60px 1fr 52px 52px;gap:8px;border-bottom:1px solid var(--border);cursor:pointer;align-items:center;border-left:2px solid transparent;}
  .row:hover{background:var(--bg2);}
  .row.sel{background:var(--bg3);border-left-color:var(--blue);}
  .row.err{border-left-color:var(--red);}
  .m{font-size:10px;font-weight:700;padding:2px 5px;border-radius:4px;text-align:center;}
  .GET{background:#0d1b2e;color:var(--blue);}
  .POST{background:#0d2010;color:var(--green);}
  .PUT{background:#1e1500;color:var(--orange);}
  .PATCH{background:#1a0d2e;color:var(--purple);}
  .DELETE{background:#2e0d0d;color:var(--red);}
  .route{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;}
  .ok{color:var(--green);font-size:12px;font-weight:600;}
  .warn{color:var(--orange);font-size:12px;font-weight:600;}
  .fail{color:var(--red);font-size:12px;font-weight:600;}
  .dur{color:var(--text2);font-size:11px;}
  .detail{flex:1;overflow-y:auto;padding:20px;}
  .empty{display:flex;align-items:center;justify-content:center;height:100%;color:var(--text2);font-size:14px;}
  .dhead{margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border);}
  .dtitle{font-size:14px;font-weight:600;display:flex;align-items:center;gap:10px;margin-bottom:6px;}
  .dmeta{color:var(--text2);font-size:11px;display:flex;gap:12px;}
  .sec{margin-bottom:20px;}
  .stitle{font-size:11px;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;}
  .cols{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
  .code{background:var(--bg2);border:1px solid var(--border);border-radius:6px;padding:12px;overflow-x:auto;}
  pre{color:var(--text);font-family:inherit;font-size:12px;line-height:1.6;white-space:pre-wrap;word-break:break-all;}
  .cbtn{font-size:10px;padding:2px 6px;cursor:pointer;border:1px solid var(--border);background:var(--bg);color:var(--text2);border-radius:4px;font-family:inherit;}
  .cbtn:hover{color:var(--text);}
  .fp{display:flex;gap:8px;align-items:center;padding:4px 0;font-size:12px;}
  .fpk{color:var(--blue);min-width:100px;}
  .fpv{color:var(--text);}
  .tag{display:inline-flex;align-items:center;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:600;}
  .tenc{background:#0d1b2e;color:var(--blue);}
  .texcl{background:var(--bg3);color:var(--text2);}
  ::-webkit-scrollbar{width:6px;height:6px;}
  ::-webkit-scrollbar-track{background:transparent;}
  ::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px;}
</style>
</head>
<body>
<header>
  <div class="dot" id="dot"></div>
  <h1>🔒 Ciph Inspector</h1>
  <span class="lbl" id="lbl">Connecting…</span>
  <div class="spacer"></div>
  <span class="badge" id="cnt">0 requests</span>
  <button class="btn" id="clrBtn">Clear</button>
</header>
<div class="main">
  <div class="list">
    <div class="list-head"><span>Method</span><span>Route</span><span>Status</span><span>Time</span></div>
    <div id="rows"></div>
  </div>
  <div class="detail" id="detail"></div>
</div>
<script>
(function(){
  var streamUrl='${streamUrl}';
  var logsUrl='${logsUrl}';
  var logs=[],sel=null;

  function mk(tag,cls,txt){
    var e=document.createElement(tag);
    if(cls)e.className=cls;
    if(txt!==undefined)e.textContent=String(txt);
    return e;
  }
  function ap(p){for(var i=1;i<arguments.length;i++)p.appendChild(arguments[i]);return p;}
  function sc(s){return s>=500?'fail':s>=400?'warn':'ok';}
  function fmtObj(v){if(v===null||v===undefined)return'—';try{return JSON.stringify(v,null,2);}catch(e){return String(v);}}
  function trunc(s){if(!s)return'—';return s.length>120?s.slice(0,120)+'…':s;}

  function showEmpty(){
    var d=document.getElementById('detail');
    d.replaceChildren();
    d.appendChild(mk('div','empty','← Select a request to inspect'));
  }

  function render(){
    var c=logs.length;
    document.getElementById('cnt').textContent=c+' request'+(c===1?'':'s');
    var rows=document.getElementById('rows');
    rows.replaceChildren();
    for(var i=0;i<logs.length;i++){
      (function(idx){
        var l=logs[idx];
        var cls='row'+(sel===idx?' sel':'')+(l.status>=400?' err':'');
        var row=mk('div',cls);
        row.onclick=function(){pick(idx);};
        ap(row,
          mk('span','m '+(l.method||'GET'),l.method||'GET'),
          mk('span','route',l.route||'/'),
          mk('span',sc(l.status),String(l.status)),
          mk('span','dur',l.duration+'ms')
        );
        rows.appendChild(row);
      })(i);
    }
  }

  function codeBlock(label,text,rawForCopy){
    var sec=mk('div','sec');
    var stitle=mk('div','stitle');
    stitle.appendChild(mk('span','',label));
    if(rawForCopy!==undefined){
      var btn=mk('button','cbtn','Copy');
      btn.onclick=(function(raw){return function(){navigator.clipboard.writeText(raw).catch(function(){});};})(rawForCopy);
      stitle.appendChild(btn);
    }
    var code=mk('div','code');
    code.appendChild(ap(mk('pre'),document.createTextNode(text||'—')));
    ap(sec,stitle,code);
    return sec;
  }

  function pick(i){
    sel=i;render();
    var l=logs[i];
    if(!l)return;
    var detail=document.getElementById('detail');
    detail.replaceChildren();
    var isEnc=!l.excluded;
    var dhead=mk('div','dhead');
    var dtitle=mk('div','dtitle');
    ap(dtitle,
      mk('span','m '+(l.method||'GET'),l.method||'GET'),
      mk('span','',l.route||'/'),
      mk('span',sc(l.status),String(l.status)),
      mk('span','tag '+(isEnc?'tenc':'texcl'),isEnc?'🔒 Encrypted':'○ Plain')
    );
    var dmeta=mk('div','dmeta');
    dmeta.appendChild(mk('span','',l.timestamp||''));
    dmeta.appendChild(mk('span','',l.duration+'ms'));
    if(l.request&&l.request.ip)dmeta.appendChild(mk('span','','IP: '+l.request.ip));
    ap(dhead,dtitle,dmeta);
    detail.appendChild(dhead);
    var req=l.request||{};var res=l.response||{};
    var rawReqEnc=(req.encryptedBody)||'';var rawResEnc=(res.encryptedBody)||'';
    var cols1=mk('div','cols');
    ap(cols1,codeBlock('Request (Plain)',fmtObj(req.plainBody)),codeBlock('Response (Plain)',fmtObj(res.plainBody)));
    detail.appendChild(cols1);
    var cols2=mk('div','cols');
    ap(cols2,codeBlock('Request Encrypted',trunc(rawReqEnc),rawReqEnc),codeBlock('Response Encrypted',trunc(rawResEnc),rawResEnc));
    detail.appendChild(cols2);
    var fp=l.fingerprint||{};
    var fpSec=mk('div','sec');
    fpSec.appendChild(mk('div','stitle','Fingerprint'));
    [['Hash',fp.value||'—'],['UA Match',fp.uaMatch?'✅':'❌']].forEach(function(pair){
      var row=mk('div','fp');
      ap(row,mk('span','fpk',pair[0]),mk('span','fpv',pair[1]));
      fpSec.appendChild(row);
    });
    detail.appendChild(fpSec);
  }

  function connect(){
    var es=new EventSource(streamUrl);
    es.onopen=function(){
      document.getElementById('dot').className='dot live';
      document.getElementById('lbl').textContent='Live';
      fetch(logsUrl).then(function(r){return r.json();}).then(function(d){
        if(d.logs&&logs.length===0){logs=d.logs.reverse();render();}
      }).catch(function(){});
    };
    es.onmessage=function(e){
      try{
        logs.unshift(JSON.parse(e.data));
        if(logs.length>500)logs.pop();
        render();
        if(sel===null)pick(0);
      }catch(err){}
    };
    es.onerror=function(){
      document.getElementById('dot').className='dot';
      document.getElementById('lbl').textContent='Reconnecting…';
    };
  }

  document.getElementById('clrBtn').onclick=function(){
    fetch(logsUrl,{method:'DELETE'}).then(function(){
      logs=[];sel=null;render();showEmpty();
      document.getElementById('cnt').textContent='0 requests';
    });
  };

  showEmpty();
  connect();
})();
</script>
</body>
</html>`
}

// ─── SSE stream helper ─────────────────────────────────────────────────────────

function makeSSEStream(signal: AbortSignal): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()
  const { readable, writable } = new TransformStream<Uint8Array>()
  const writer = writable.getWriter()

  const write = (s: string) => writer.write(enc.encode(s)).catch(() => { /* client gone */ })

  write(": connected\n\n")

  const send = (log: CiphServerLog) => write(`data: ${JSON.stringify(log)}\n\n`)
  globalThis.ciphServerEmitter?.on("log", send)

  const keepalive = setInterval(() => write(": ping\n\n"), 25000)

  signal.addEventListener("abort", () => {
    clearInterval(keepalive)
    globalThis.ciphServerEmitter?.off("log", send)
    writer.close().catch(() => { /* already closed */ })
  })

  return readable
}

const sseResponseHeaders = {
  "content-type": "text/event-stream; charset=utf-8",
  "cache-control": "no-cache",
  "connection": "keep-alive",
}

// ─── Inspector sub-app (mount on same port as your Hono app) ──────────────────
//
// Usage in your Hono app:
//   app.route("/ciph-devtools", getCiphInspectorApp())
//   app.use("*", ciph({ privateKey: "..." }))
//   // Inspector UI → http://localhost:<port>/ciph-devtools

export function getCiphInspectorApp() {
  const app = new Hono()

  app.get("/", (c) => {
    // Build absolute stream URL and root-relative logs URL from current request context
    const host = c.req.header("host") ?? "localhost"
    const proto = c.req.header("x-forwarded-proto") ?? "http"
    // routePath is the matched pattern e.g. "/ciph-devtools/*"; strip trailing wildcard/slash
    const base = c.req.routePath.replace(/\/\*$/, "").replace(/\/$/, "")
    const streamUrl = `${proto}://${host}${base}/stream`
    const logsUrl = `${base}/logs`
    return c.html(buildInspectorHtml(streamUrl, logsUrl))
  })

  app.get("/stream", (c) => {
    return new Response(makeSSEStream(c.req.raw.signal), { headers: sseResponseHeaders })
  })

  app.get("/logs", (c) => {
    return c.json({ logs: [..._logs], total: _logs.length })
  })

  app.delete("/logs", (c) => {
    _logs.length = 0
    clearLogFile()
    return c.json({ ok: true })
  })

  return app
}
