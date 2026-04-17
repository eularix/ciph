import type { CiphServerLog } from "@ciph/core"

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

// ─── Inspector HTML (DOM-based rendering — no dynamic HTML injection) ──────────

const BASE_PATH = "/ciph-devtools"

function buildInspectorHtml(wsUrl: string): string {
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
  var wsUrl='${wsUrl}';
  var logsUrl='${BASE_PATH}/logs';
  var logs=[],sel=null,ws=null,delay=1000;

  function mk(tag,cls,txt){
    var e=document.createElement(tag);
    if(cls)e.className=cls;
    if(txt!==undefined)e.textContent=String(txt);
    return e;
  }
  function ap(p){for(var i=1;i<arguments.length;i++)p.appendChild(arguments[i]);return p;}
  function sc(s){return s>=500?'fail':s>=400?'warn':'ok';}
  function fmtObj(v){
    if(v===null||v===undefined)return'—';
    try{return JSON.stringify(v,null,2);}catch(e){return String(v);}
  }
  function trunc(s){if(!s)return'—';return s.length>120?s.slice(0,120)+'…':s;}

  function showEmpty(){
    var d=document.getElementById('detail');
    d.replaceChildren();
    d.appendChild(ap(mk('div','empty'),'← Select a request to inspect'));
    // Note: above uses textContent via mk helper — no dynamic HTML injection
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
    // Header section
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
    // Body columns
    var req=l.request||{};
    var res=l.response||{};
    var rawReqEnc=(req.encryptedBody)||'';
    var rawResEnc=(res.encryptedBody)||'';
    var cols1=mk('div','cols');
    ap(cols1,
      codeBlock('Request (Plain)',fmtObj(req.plainBody)),
      codeBlock('Response (Plain)',fmtObj(res.plainBody))
    );
    detail.appendChild(cols1);
    var cols2=mk('div','cols');
    ap(cols2,
      codeBlock('Request Encrypted',trunc(rawReqEnc),rawReqEnc),
      codeBlock('Response Encrypted',trunc(rawResEnc),rawResEnc)
    );
    detail.appendChild(cols2);
    // Fingerprint section
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
    ws=new WebSocket(wsUrl);
    ws.onopen=function(){
      document.getElementById('dot').className='dot live';
      document.getElementById('lbl').textContent='Live';
      delay=1000;
      fetch(logsUrl).then(function(r){return r.json();}).then(function(d){
        if(d.logs){logs=d.logs.reverse();render();}
      }).catch(function(){});
    };
    ws.onmessage=function(e){
      try{
        logs.unshift(JSON.parse(e.data));
        if(logs.length>500)logs.pop();
        render();
        if(sel===null)pick(0);
      }catch(err){}
    };
    ws.onclose=function(){
      document.getElementById('dot').className='dot';
      document.getElementById('lbl').textContent='Reconnecting…';
      setTimeout(function(){delay=Math.min(delay*2,30000);connect();},delay);
    };
    ws.onerror=function(){ws.close();};
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

// ─── Devtools server ──────────────────────────────────────────────────────────

let _started = false
const _logs: CiphServerLog[] = []
const MAX_LOGS = 500

export async function startDevtools(port: number): Promise<void> {
  if (_started) return
  _started = true

  try {
    const [httpModule, wsModule] = await Promise.all([
      import("node:http") as Promise<typeof import("node:http")>,
      import("ws") as Promise<{ WebSocketServer: typeof import("ws").WebSocketServer }>,
    ])
    const WebSocketServer = wsModule.WebSocketServer

    type WsClient = import("ws").WebSocket
    const wsClients = new Set<WsClient>()

    const emitter = globalThis.ciphServerEmitter
    if (emitter) {
      emitter.on("log", (log) => {
        _logs.unshift(log)
        if (_logs.length > MAX_LOGS) _logs.pop()
        const payload = JSON.stringify(log)
        for (const client of wsClients) {
          if (client.readyState === 1 /* OPEN */) client.send(payload)
        }
      })
    }

    const server = httpModule.createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://localhost:${port}`)
      const method = req.method ?? "GET"

      if (method === "OPTIONS") { res.writeHead(204); res.end(); return }

      if (url.pathname === "/" && method === "GET") {
        const wsUrl = `ws://localhost:${port}${BASE_PATH}`
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" })
        res.end(buildInspectorHtml(wsUrl))
        return
      }

      if (url.pathname === `${BASE_PATH}/logs`) {
        if (method === "GET") {
          res.writeHead(200, { "content-type": "application/json" })
          res.end(JSON.stringify({ logs: [..._logs], total: _logs.length }))
          return
        }
        if (method === "DELETE") {
          _logs.length = 0
          res.writeHead(200, { "content-type": "application/json" })
          res.end(JSON.stringify({ ok: true }))
          return
        }
      }

      res.writeHead(404, { "content-type": "application/json" })
      res.end(JSON.stringify({ message: "Not Found" }))
    })

    const wss = new WebSocketServer({ noServer: true })

    server.on("upgrade", (req, socket, head) => {
      const url = new URL(req.url ?? "/", `http://localhost:${port}`)
      if (url.pathname !== BASE_PATH) { socket.destroy(); return }
      wss.handleUpgrade(req, socket, head, (ws) => {
        wsClients.add(ws as WsClient)
        ws.on("close", () => wsClients.delete(ws as WsClient))
      })
    })

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject)
      server.listen(port, () => { server.off("error", reject); resolve() })
    })

    console.log(`[ciph] devtools inspector → http://localhost:${port}`)
  } catch {
    _started = false // allow retry if port was busy
  }
}
