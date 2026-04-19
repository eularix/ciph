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
  :root{
    --bg:#0a0e27;--bg2:#0f1423;--bg3:#151b3a;--bg4:#1a1f4f;
    --border:#2d3e7a;--border2:#1a2555;
    --text:#f0f4ff;--text2:#9ca4c8;
    --green:#4ade80;--red:#f87171;--blue:#60a5fa;--orange:#fb923c;--purple:#d8b4fe;
    --accent:#6366f1;--accent2:#a78bfa;
  }
  html,body{height:100%;width:100%;}
  body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif;font-size:13px;display:flex;flex-direction:column;overflow:hidden;}
  header{background:linear-gradient(135deg, var(--bg2) 0%, var(--bg3) 100%);border-bottom:1px solid var(--border);padding:16px 24px;display:flex;align-items:center;gap:16px;flex-shrink:0;box-shadow:0 2px 12px rgba(0,0,0,0.3);}
  h1{font-size:16px;font-weight:700;letter-spacing:-0.5px;background:linear-gradient(135deg, #60a5fa, #a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
  .dot{width:10px;height:10px;border-radius:50%;background:var(--red);flex-shrink:0;transition:all 0.3s ease;}
  .dot.live{background:var(--green);box-shadow:0 0 8px var(--green);}
  .lbl{font-size:12px;color:var(--text2);font-weight:500;}
  .spacer{flex:1;}
  .btn{padding:7px 14px;border-radius:8px;border:1px solid var(--border);background:var(--bg3);color:var(--text2);cursor:pointer;font-size:12px;font-weight:500;transition:all 0.2s ease;font-family:inherit;}
  .btn:hover{background:var(--bg4);color:var(--text);border-color:var(--accent);box-shadow:0 2px 8px rgba(99,102,241,0.2);}
  .btn:active{transform:scale(0.98);}
  .badge{background:var(--bg3);border:1px solid var(--border);border-radius:12px;padding:4px 12px;font-size:12px;color:var(--text2);font-weight:500;}
  .main{display:flex;flex:1;overflow:hidden;gap:0;}
  .list{width:380px;border-right:1px solid var(--border);overflow-y:auto;flex-shrink:0;display:flex;flex-direction:column;}
  .search-box{padding:12px 16px;border-bottom:1px solid var(--border);flex-shrink:0;}
  .search-box input{width:100%;padding:8px 12px;border:1px solid var(--border);background:var(--bg3);color:var(--text);border-radius:8px;font-size:12px;transition:all 0.2s ease;}
  .search-box input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px rgba(99,102,241,0.1);}
  .search-box input::placeholder{color:var(--text2);}
  .list-head{position:sticky;top:0;background:var(--bg2);border-bottom:1px solid var(--border);padding:10px 14px;display:flex;align-items:center;gap:12px;font-size:11px;color:var(--text2);text-transform:uppercase;letter-spacing:0.5px;z-index:2;font-weight:600;}
  .list-head span:nth-child(1){min-width:60px;}
  .list-head span:nth-child(2){flex:1;min-width:200px;}
  .list-head span:nth-child(3){min-width:50px;text-align:center;}
  .list-head span:nth-child(4){min-width:50px;text-align:right;}
  .list-rows{flex:1;overflow-y:auto;}
  .row{padding:12px 14px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--border2);cursor:pointer;border-left:3px solid transparent;transition:all 0.15s ease;position:relative;}
  .row span:nth-child(1){min-width:60px;text-align:center;}
  .row span:nth-child(2){flex:1;min-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .row span:nth-child(3){min-width:50px;text-align:center;}
  .row span:nth-child(4){min-width:50px;text-align:right;}
  .row:hover{background:var(--bg3);border-left-color:var(--accent);}
  .row.sel{background:var(--bg4);border-left-color:var(--blue);box-shadow:inset 0 0 12px rgba(96,165,250,0.1);}
  .row.err{border-left-color:var(--red);}
  .row.warn{border-left-color:var(--orange);}
  .m{font-size:11px;font-weight:700;padding:3px 6px;border-radius:6px;text-align:center;}
  .GET{background:rgba(96,165,250,0.15);color:var(--blue);}
  .POST{background:rgba(74,222,128,0.15);color:var(--green);}
  .PUT{background:rgba(251,146,60,0.15);color:var(--orange);}
  .PATCH{background:rgba(216,180,254,0.15);color:var(--purple);}
  .DELETE{background:rgba(248,113,113,0.15);color:var(--red);}
  .route{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--text);}
  .status-col{font-weight:600;font-size:12px;}
  .time{font-size:12px;color:var(--text2);}
  .ok{color:var(--green);font-size:12px;font-weight:600;}
  .warn{color:var(--orange);font-size:12px;font-weight:600;}
  .fail{color:var(--red);font-size:12px;font-weight:600;}
  .detail{flex:1;overflow-y:auto;padding:24px;}
  .detail::-webkit-scrollbar{width:8px;}
  .detail::-webkit-scrollbar-track{background:transparent;}
  .detail::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px;}
  .detail::-webkit-scrollbar-thumb:hover{background:var(--accent);}
  .empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--text2);font-size:14px;gap:12px;text-align:center;padding:20px;}
  .empty svg{width:48px;height:48px;opacity:0.3;}
  .dhead{margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid var(--border);}
  .dtitle{font-size:16px;font-weight:700;display:flex;align-items:center;gap:12px;margin-bottom:8px;}
  .dmeta{color:var(--text2);font-size:12px;display:flex;gap:16px;flex-wrap:wrap;}
  .sec{margin-bottom:24px;}
  .stitle{font-size:11px;color:var(--accent);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;font-weight:700;}
  .cols{display:grid;grid-template-columns:1fr 1fr;gap:20px;}
  .code{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:16px;overflow-x:auto;}
  pre{color:var(--text);font-family:'Monaco','Menlo','Ubuntu Mono','Courier New',monospace;font-size:12px;line-height:1.6;white-space:pre-wrap;word-break:break-all;}
  .cbtn{font-size:11px;padding:6px 10px;cursor:pointer;border:1px solid var(--border);background:var(--bg3);color:var(--text2);border-radius:6px;font-family:inherit;transition:all 0.2s ease;font-weight:500;}
  .cbtn:hover{color:var(--text);border-color:var(--accent);background:var(--bg4);}
  .fp{display:flex;gap:12px;align-items:center;padding:8px 0;font-size:12px;}
  .fpk{color:var(--accent);min-width:120px;font-weight:600;}
  .fpv{color:var(--text);}
  .tag{display:inline-flex;align-items:center;padding:4px 10px;border-radius:8px;font-size:11px;font-weight:600;}
  .tenc{background:rgba(96,165,250,0.15);color:var(--blue);}
  .texcl{background:rgba(156,164,200,0.1);color:var(--text2);}
  ::-webkit-scrollbar{width:8px;height:8px;}
  ::-webkit-scrollbar-track{background:transparent;}
  ::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px;transition:background 0.2s ease;}
  ::-webkit-scrollbar-thumb:hover{background:var(--accent);}
</style>
</head>
<body>
<header>
  <div class="dot" id="dot"></div>
  <h1>🔒 Ciph</h1>
  <span class="lbl" id="lbl">Connecting…</span>
  <div class="spacer"></div>
  <span class="badge" id="cnt">0 requests</span>
  <button class="btn" id="clrBtn">Clear Logs</button>
</header>
<div class="main">
  <div class="list">
    <div class="search-box"><input type="text" id="searchInput" placeholder="Search routes..."></div>
    <div class="list-head"><span>Method</span><span>Route</span><span>Status</span><span>Time</span></div>
    <div class="list-rows" id="rows"></div>
  </div>
  <div class="detail" id="detail"></div>
</div>
<script>
(function(){
  var streamUrl='${streamUrl}';
  var logsUrl='${logsUrl}';
  var logs=[],sel=null,searchTerm='';

  function mk(tag,cls,txt){
    var e=document.createElement(tag);
    if(cls)e.className=cls;
    if(txt!==undefined)e.textContent=String(txt);
    return e;
  }
  function ap(p){for(var i=1;i<arguments.length;i++)p.appendChild(arguments[i]);return p;}
  function sc(s){return s>=500?'fail':s>=400?'warn':'ok';}
  function fmtObj(v){if(v===null||v===undefined)return'—';try{return JSON.stringify(v,null,2);}catch(e){return String(v);}}
  function trunc(s){if(!s)return'—';return s.length>100?s.slice(0,100)+'…':s;}
  function getStatus(s){if(s>=500)return'●';if(s>=400)return'●';return'✓';}

  function showEmpty(){
    var d=document.getElementById('detail');
    d.replaceChildren();
    var empty=mk('div','empty');
    ap(empty,
      mk('div','','←'),
      mk('div','','Select a request to inspect')
    );
    d.appendChild(empty);
  }

  function matchesSearch(log){
    if(!searchTerm)return true;
    var route=(log.route||'').toLowerCase();
    var method=(log.method||'').toLowerCase();
    return route.includes(searchTerm.toLowerCase())||method.includes(searchTerm.toLowerCase());
  }

  function getVisibleLogs(){
    return logs.filter(function(l,i){
      return matchesSearch(l);
    });
  }

  function render(){
    var visible=getVisibleLogs();
    var total=logs.length;
    var badge=document.getElementById('cnt');
    badge.textContent=total+' request'+(total===1?'':'s')+(searchTerm?' ('+visible.length+' matches)':'');
    var rows=document.getElementById('rows');
    rows.replaceChildren();
    for(var i=0;i<visible.length;i++){
      (function(idx){
        var l=visible[idx];
        var logIdx=logs.indexOf(l);
        var cls='row'+(sel===logIdx?' sel':'')+(l.status>=400?' '+(l.status>=500?'err':'warn'):'');
        var row=mk('div',cls);
        row.onclick=function(){pick(logIdx);};
        var statusClass=sc(l.status);
        ap(row,
          mk('span','m '+(l.method||'GET'),l.method||'GET'),
          mk('span','route',l.route||'/'),
          mk('span','status-col '+statusClass,String(l.status||'?')),
          mk('span','time',(l.duration||'?')+'ms')
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
      var btn=mk('button','cbtn','📋 Copy');
      btn.onclick=(function(raw){return function(){
        navigator.clipboard.writeText(raw).then(function(){
          var oldText=btn.textContent;
          btn.textContent='✓ Copied';
          setTimeout(function(){btn.textContent=oldText;},1500);
        }).catch(function(){});
      };})(rawForCopy);
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
      mk('span','tag '+(isEnc?'tenc':'texcl'),isEnc?'🔒 Encrypted':'○ Passthrough')
    );
    var dmeta=mk('div','dmeta');
    dmeta.appendChild(mk('span','',l.timestamp||''));
    dmeta.appendChild(mk('span','','Duration: '+(l.duration||'?')+'ms'));
    if(l.request&&l.request.ip)dmeta.appendChild(mk('span','','IP: '+l.request.ip));
    if(l.request&&l.request.ua)dmeta.appendChild(mk('span','','UA matched: '+(l.request.uaMatch?'✓':'✗')));
    ap(dhead,dtitle,dmeta);
    detail.appendChild(dhead);
    var req=l.request||{};var res=l.response||{};
    var rawReqEnc=(req.encryptedBody)||'';var rawResEnc=(res.encryptedBody)||'';
    var cols1=mk('div','cols');
    ap(cols1,codeBlock('🔓 Request Data',fmtObj(req.plainBody)),codeBlock('🔓 Response Data',fmtObj(res.plainBody)));
    detail.appendChild(cols1);
    if(isEnc){
      var cols2=mk('div','cols');
      var truncReq=trunc(rawReqEnc);var truncRes=trunc(rawResEnc);
      ap(cols2,codeBlock('🔐 Request Encrypted',truncReq,rawReqEnc),codeBlock('🔐 Response Encrypted',truncRes,rawResEnc));
      detail.appendChild(cols2);
    }
    var fp=l.fingerprint||{};
    if(fp.value||fp.uaMatch!==undefined){
      var fpSec=mk('div','sec');
      fpSec.appendChild(mk('div','stitle','🎯 Fingerprint'));
      if(fp.value){
        var row=mk('div','fp');
        ap(row,mk('span','fpk','Hash'),mk('span','fpv',trunc(fp.value)));
        fpSec.appendChild(row);
      }
      if(fp.uaMatch!==undefined){
        var row2=mk('div','fp');
        ap(row2,mk('span','fpk','UA Match'),mk('span','fpv',fp.uaMatch?'✓ Matched':'✗ Changed'));
        fpSec.appendChild(row2);
      }
      detail.appendChild(fpSec);
    }
  }

  var es=null,reconnectDelay=1000,reconnectAttempt=0;
  function connect(){
    if(es)es.close();
    es=new EventSource(streamUrl);
    es.onopen=function(){
      document.getElementById('dot').className='dot live';
      document.getElementById('lbl').textContent='Live';
      reconnectDelay=1000;reconnectAttempt=0;
      fetch(logsUrl).then(function(r){return r.json();}).then(function(d){
        if(d.logs&&logs.length===0){logs=d.logs.reverse();render();}
      }).catch(function(){});
    };
    es.onmessage=function(e){
      try{
        var log=JSON.parse(e.data);
        logs.unshift(log);
        if(logs.length>500)logs.pop();
        render();
        if(sel===null&&getVisibleLogs().length>0)pick(logs.indexOf(getVisibleLogs()[0]));
      }catch(err){}
    };
    es.onerror=function(){
      es.close();
      document.getElementById('dot').className='dot';
      reconnectAttempt++;
      var nextDelay=Math.min(reconnectDelay*Math.pow(1.5,reconnectAttempt-1),30000);
      document.getElementById('lbl').textContent='Reconnecting in '+(nextDelay/1000|0)+'s…';
      setTimeout(function(){connect();},nextDelay);
    };
  }

  document.getElementById('clrBtn').onclick=function(){
    fetch(logsUrl,{method:'DELETE'}).then(function(){
      logs=[];sel=null;render();showEmpty();
      document.getElementById('cnt').textContent='0 requests';
    });
  };

  document.getElementById('searchInput').addEventListener('keyup',function(e){
    searchTerm=e.target.value;
    sel=null;
    render();
    if(getVisibleLogs().length>0){
      pick(logs.indexOf(getVisibleLogs()[0]));
    }else{
      showEmpty();
    }
  });

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
