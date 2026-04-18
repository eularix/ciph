// src/index.ts
import * as core from "@ciph/core";

// src/devtools.ts
import { Hono } from "hono";
function autoInitEmitter() {
  if (globalThis.ciphServerEmitter) return;
  const listeners = [];
  globalThis.ciphServerEmitter = {
    emit(event, log) {
      if (event === "log") for (const l of listeners) l(log);
    },
    on(event, listener) {
      if (event === "log") listeners.push(listener);
    },
    off(event, listener) {
      if (event === "log") {
        const i = listeners.indexOf(listener);
        if (i >= 0) listeners.splice(i, 1);
      }
    }
  };
}
var BASE_PATH = "/ciph-devtools";
function buildInspectorHtml(streamUrl) {
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
  <h1>\u{1F512} Ciph Inspector</h1>
  <span class="lbl" id="lbl">Connecting\u2026</span>
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
  var logsUrl='${BASE_PATH}/logs';
  var logs=[],sel=null;

  function mk(tag,cls,txt){
    var e=document.createElement(tag);
    if(cls)e.className=cls;
    if(txt!==undefined)e.textContent=String(txt);
    return e;
  }
  function ap(p){for(var i=1;i<arguments.length;i++)p.appendChild(arguments[i]);return p;}
  function sc(s){return s>=500?'fail':s>=400?'warn':'ok';}
  function fmtObj(v){if(v===null||v===undefined)return'\u2014';try{return JSON.stringify(v,null,2);}catch(e){return String(v);}}
  function trunc(s){if(!s)return'\u2014';return s.length>120?s.slice(0,120)+'\u2026':s;}

  function showEmpty(){
    var d=document.getElementById('detail');
    d.replaceChildren();
    d.appendChild(ap(mk('div','empty'),'\u2190 Select a request to inspect'));
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
    code.appendChild(ap(mk('pre'),document.createTextNode(text||'\u2014')));
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
      mk('span','tag '+(isEnc?'tenc':'texcl'),isEnc?'\u{1F512} Encrypted':'\u25CB Plain')
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
    [['Hash',fp.value||'\u2014'],['UA Match',fp.uaMatch?'\u2705':'\u274C']].forEach(function(pair){
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
      document.getElementById('lbl').textContent='Reconnecting\u2026';
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
</html>`;
}
var _started = false;
var _logs = [];
var MAX_LOGS = 500;
function subscribeBuffer() {
  globalThis.ciphServerEmitter?.on("log", (log) => {
    _logs.unshift(log);
    if (_logs.length > MAX_LOGS) _logs.pop();
  });
}
var corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, DELETE, OPTIONS"
};
function makeSSEStream(signal) {
  const enc = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const write = (s) => writer.write(enc.encode(s)).catch(() => {
  });
  write(": connected\n\n");
  const send = (log) => write(`data: ${JSON.stringify(log)}

`);
  globalThis.ciphServerEmitter?.on("log", send);
  const keepalive = setInterval(() => write(": ping\n\n"), 25e3);
  signal.addEventListener("abort", () => {
    clearInterval(keepalive);
    globalThis.ciphServerEmitter?.off("log", send);
    writer.close().catch(() => {
    });
  });
  return readable;
}
var sseResponseHeaders = {
  "content-type": "text/event-stream; charset=utf-8",
  "cache-control": "no-cache",
  "connection": "keep-alive",
  ...corsHeaders
};
async function startBunDevtools(port) {
  const bunGlobal = globalThis;
  const streamUrl = `http://localhost:${port}${BASE_PATH}/stream`;
  const html = buildInspectorHtml(streamUrl);
  bunGlobal.Bun.serve({
    port,
    fetch(req) {
      const url = new URL(req.url);
      const method = req.method;
      if (method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
      if (url.pathname === "/" && method === "GET") {
        return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
      }
      if (url.pathname === `${BASE_PATH}/stream` && method === "GET") {
        return new Response(makeSSEStream(req.signal), { headers: sseResponseHeaders });
      }
      if (url.pathname === `${BASE_PATH}/logs`) {
        if (method === "GET") {
          return Response.json({ logs: [..._logs], total: _logs.length });
        }
        if (method === "DELETE") {
          _logs.length = 0;
          return Response.json({ ok: true });
        }
      }
      return new Response(JSON.stringify({ message: "Not Found" }), {
        status: 404,
        headers: { "content-type": "application/json" }
      });
    }
  });
}
async function startNodeDevtools(port) {
  const httpModule = await import("http");
  const server = httpModule.createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);
    const method = req.method ?? "GET";
    Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
    if (method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (url.pathname === "/" && method === "GET") {
      const streamUrl = `http://localhost:${port}${BASE_PATH}/stream`;
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(buildInspectorHtml(streamUrl));
      return;
    }
    if (url.pathname === `${BASE_PATH}/stream` && method === "GET") {
      res.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache",
        "connection": "keep-alive"
      });
      res.flushHeaders?.();
      res.write(": connected\n\n");
      const send = (log) => {
        try {
          res.write(`data: ${JSON.stringify(log)}

`);
        } catch {
        }
      };
      globalThis.ciphServerEmitter?.on("log", send);
      const keepalive = setInterval(() => {
        try {
          res.write(": ping\n\n");
        } catch {
          clearInterval(keepalive);
        }
      }, 25e3);
      req.on("close", () => {
        clearInterval(keepalive);
        globalThis.ciphServerEmitter?.off("log", send);
      });
      return;
    }
    if (url.pathname === `${BASE_PATH}/logs`) {
      if (method === "GET") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ logs: [..._logs], total: _logs.length }));
        return;
      }
      if (method === "DELETE") {
        _logs.length = 0;
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: "Not Found" }));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => {
      server.off("error", reject);
      resolve();
    });
  });
}
var isBun = typeof globalThis.Bun !== "undefined";
async function startDevtools(port) {
  if (_started) return;
  _started = true;
  try {
    subscribeBuffer();
    if (isBun) {
      await startBunDevtools(port);
    } else {
      await startNodeDevtools(port);
    }
    console.log(`[ciph] devtools inspector \u2192 http://localhost:${port}`);
  } catch {
    _started = false;
  }
}
function getCiphInspectorApp() {
  const app = new Hono();
  app.get("/", (c) => {
    const host = c.req.header("host") ?? "localhost";
    const proto = c.req.header("x-forwarded-proto") ?? "http";
    const routePath = c.req.routePath.replace(/\/$/, "");
    const streamUrl = `${proto}://${host}${routePath}/stream`;
    return c.html(buildInspectorHtml(streamUrl));
  });
  app.get("/stream", (c) => {
    return new Response(makeSSEStream(c.req.raw.signal), { headers: sseResponseHeaders });
  });
  app.get("/logs", (c) => {
    return c.json({ logs: [..._logs], total: _logs.length });
  });
  app.delete("/logs", (c) => {
    _logs.length = 0;
    return c.json({ ok: true });
  });
  return app;
}

// src/index.ts
var CIPH_EXCLUDE_KEY = "ciph.exclude.route";
var DEFAULT_EXCLUDE_ROUTES = ["/health", "/ciph", "/ciph/*", "/ciph-public-key"];
var DEFAULT_MAX_PAYLOAD_SIZE = 10485760;
var BODY_METHODS = /* @__PURE__ */ new Set(["POST", "PUT", "PATCH"]);
function getCiphServerEmitter() {
  const g = globalThis;
  if (g.ciphServerEmitter && typeof g.ciphServerEmitter.emit === "function") {
    return g.ciphServerEmitter;
  }
  return null;
}
function wildcardToRegex(pattern) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replace(/\*/g, ".*")}$`);
}
function routeMatches(pathname, patterns) {
  return patterns.some((p) => wildcardToRegex(p).test(pathname));
}
function getClientIp(c) {
  const realIp = c.req.header("x-real-ip");
  if (realIp?.trim()) return realIp.trim();
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded?.trim()) {
    const first = forwarded.split(",")[0];
    if (first) return first.trim();
  }
  const raw = c.req.raw;
  return raw.socket?.remoteAddress ?? raw.connection?.remoteAddress ?? "0.0.0.0";
}
function jsonError(code, message, status) {
  return new Response(JSON.stringify({ code, message }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
function buildLog(c, state) {
  return {
    id: crypto.randomUUID(),
    method: c.req.method,
    route: c.req.path,
    status: state.status,
    duration: Date.now() - state.startedAt,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    request: {
      plainBody: state.plainRequestBody,
      encryptedBody: state.encryptedRequestBody,
      headers: (() => {
        const h = {};
        c.req.raw.headers.forEach((v, k) => {
          h[k] = v;
        });
        return h;
      })(),
      ip: state.ip,
      userAgent: state.userAgent
    },
    response: {
      plainBody: state.plainResponseBody,
      encryptedBody: state.encryptedResponseBody ?? ""
    },
    fingerprint: {
      value: state.fingerprint ?? "",
      ipMatch: state.ipMatch,
      uaMatch: state.uaMatch
    },
    excluded: state.excluded,
    error: state.errorCode
  };
}
function emitDevLog(c, state) {
  if (process.env.NODE_ENV === "production") return;
  getCiphServerEmitter()?.emit("log", buildLog(c, state));
}
function buildWireResponse(ciphertext, origResponse) {
  const body = JSON.stringify({ status: "encrypted", data: ciphertext });
  const headers = new Headers(origResponse.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(body, {
    status: origResponse.status,
    statusText: origResponse.statusText,
    headers
  });
}
function ciphExclude() {
  return async (c, next) => {
    ;
    c.set(CIPH_EXCLUDE_KEY, true);
    await next();
  };
}
async function handleV1(c, cx, state, config, next, encryptFn) {
  const { secret, strictFingerprint = true, maxPayloadSize = DEFAULT_MAX_PAYLOAD_SIZE } = config;
  const encryptedFingerprint = c.req.header("x-fingerprint");
  if (!encryptedFingerprint) {
    if (!config.allowUnencrypted) {
      state.errorCode = "CIPH001";
      state.status = 401;
      emitDevLog(c, state);
      return jsonError("CIPH001", "Missing X-Fingerprint header", 401);
    }
    await next();
    state.status = c.res.status;
    emitDevLog(c, state);
    return;
  }
  let fingerprint;
  try {
    fingerprint = await core.decryptFingerprint(encryptedFingerprint, secret);
    state.fingerprint = fingerprint;
    cx.set("ciphFingerprint", fingerprint);
  } catch {
    state.errorCode = "CIPH002";
    state.status = 401;
    emitDevLog(c, state);
    return jsonError("CIPH002", "Failed to decrypt fingerprint", 401);
  }
  const fp = (() => {
    try {
      return JSON.parse(fingerprint);
    } catch {
      return null;
    }
  })();
  state.ipMatch = (fp?.ip ?? "") === state.ip;
  state.uaMatch = (fp?.userAgent ?? "") === state.userAgent;
  const mismatch = strictFingerprint ? !state.ipMatch || !state.uaMatch : !state.uaMatch;
  if (mismatch) {
    state.errorCode = "CIPH003";
    state.status = 401;
    emitDevLog(c, state);
    return jsonError("CIPH003", "Fingerprint mismatch", 401);
  }
  const cl = c.req.header("content-length");
  if (cl) {
    const n = Number(cl);
    if (!Number.isNaN(n) && n > maxPayloadSize) {
      state.errorCode = "CIPH005";
      state.status = 413;
      emitDevLog(c, state);
      return jsonError("CIPH005", "Payload too large", 413);
    }
  }
  let key = null;
  if (BODY_METHODS.has(c.req.method)) {
    const encryptedBody = await c.req.text();
    state.encryptedRequestBody = encryptedBody.length > 0 ? encryptedBody : null;
    if (encryptedBody.length > maxPayloadSize) {
      state.errorCode = "CIPH005";
      state.status = 413;
      emitDevLog(c, state);
      return jsonError("CIPH005", "Payload too large", 413);
    }
    if (encryptedBody.length > 0) {
      try {
        key = await core.deriveKey(secret, fingerprint);
        const result = await core.decrypt(encryptedBody, key);
        const plain = JSON.parse(result.plaintext);
        state.plainRequestBody = plain;
        cx.set("ciphDecryptedJson", plain);
        const origJson = c.req.json.bind(c.req);
        c.req.json = (async () => plain);
      } catch {
        state.errorCode = "CIPH004";
        state.status = 400;
        emitDevLog(c, state);
        return jsonError("CIPH004", "Failed to decrypt request body", 400);
      }
    }
  }
  await next();
  try {
    state.status = c.res.status;
    const plainText = await c.res.clone().text();
    state.plainResponseBody = plainText.length > 0 ? (() => {
      try {
        return JSON.parse(plainText);
      } catch {
        return plainText;
      }
    })() : null;
    if (!key) key = await core.deriveKey(secret, fingerprint);
    const encrypted = await encryptFn(plainText, key);
    state.encryptedResponseBody = encrypted.ciphertext;
    c.res = buildWireResponse(encrypted.ciphertext, c.res);
    emitDevLog(c, state);
  } catch {
    state.errorCode = "CIPH006";
    state.status = 500;
    emitDevLog(c, state);
    c.res = jsonError("CIPH006", "Failed to encrypt response", 500);
  }
}
async function handleV2(c, cx, state, config, next, encryptFn) {
  const { privateKey, strictFingerprint = true, maxPayloadSize = DEFAULT_MAX_PAYLOAD_SIZE } = config;
  const clientPublicKey = c.req.header("x-client-publickey");
  if (!clientPublicKey) {
    if (!config.allowUnencrypted) {
      state.errorCode = "CIPH001";
      state.status = 401;
      emitDevLog(c, state);
      return jsonError("CIPH001", "Missing X-Client-PublicKey header", 401);
    }
    await next();
    state.status = c.res.status;
    emitDevLog(c, state);
    return;
  }
  state.ecdhClientPublicKey = clientPublicKey;
  let sessionKey;
  try {
    const rawShared = await core.deriveECDHBits(privateKey, clientPublicKey);
    sessionKey = await core.deriveSessionKey(rawShared);
    state.ecdhSessionKeyDerived = true;
  } catch {
    state.errorCode = "CIPH007";
    state.status = 401;
    emitDevLog(c, state);
    return jsonError("CIPH007", "ECDH key derivation failed", 401);
  }
  const encryptedFp = c.req.header("x-fingerprint");
  if (!encryptedFp) {
    state.errorCode = "CIPH001";
    state.status = 401;
    emitDevLog(c, state);
    return jsonError("CIPH001", "Missing X-Fingerprint header", 401);
  }
  let fpComponents;
  try {
    const decrypted = await core.decrypt(encryptedFp, sessionKey);
    fpComponents = JSON.parse(decrypted.plaintext);
  } catch {
    state.errorCode = "CIPH002";
    state.status = 401;
    emitDevLog(c, state);
    return jsonError("CIPH002", "Failed to decrypt fingerprint", 401);
  }
  const requestUA = c.req.header("user-agent") ?? "";
  state.uaMatch = (fpComponents["userAgent"] ?? "") === requestUA;
  state.ipMatch = true;
  if (strictFingerprint && !state.uaMatch) {
    state.errorCode = "CIPH003";
    state.status = 401;
    emitDevLog(c, state);
    return jsonError("CIPH003", "Fingerprint mismatch: User-Agent changed", 401);
  }
  const fpResult = await core.generateFingerprint(fpComponents);
  state.fingerprint = fpResult.fingerprint;
  cx.set("ciphFingerprint", fpResult.fingerprint);
  const requestKey = await core.deriveRequestKey(sessionKey, fpResult.fingerprint);
  const cl = c.req.header("content-length");
  if (cl) {
    const n = Number(cl);
    if (!Number.isNaN(n) && n > maxPayloadSize) {
      state.errorCode = "CIPH005";
      state.status = 413;
      emitDevLog(c, state);
      return jsonError("CIPH005", "Payload too large", 413);
    }
  }
  if (BODY_METHODS.has(c.req.method)) {
    const encryptedBody = await c.req.text();
    state.encryptedRequestBody = encryptedBody.length > 0 ? encryptedBody : null;
    if (encryptedBody.length > maxPayloadSize) {
      state.errorCode = "CIPH005";
      state.status = 413;
      emitDevLog(c, state);
      return jsonError("CIPH005", "Payload too large", 413);
    }
    if (encryptedBody.length > 0) {
      try {
        const result = await core.decrypt(encryptedBody, requestKey);
        const plain = JSON.parse(result.plaintext);
        state.plainRequestBody = plain;
        cx.set("ciphDecryptedJson", plain);
        const origJson = c.req.json.bind(c.req);
        c.req.json = (async () => plain);
      } catch {
        state.errorCode = "CIPH004";
        state.status = 400;
        emitDevLog(c, state);
        return jsonError("CIPH004", "Failed to decrypt request body", 400);
      }
    }
  }
  await next();
  try {
    state.status = c.res.status;
    const plainText = await c.res.clone().text();
    state.plainResponseBody = plainText.length > 0 ? (() => {
      try {
        return JSON.parse(plainText);
      } catch {
        return plainText;
      }
    })() : null;
    const encrypted = await encryptFn(plainText, requestKey);
    state.encryptedResponseBody = encrypted.ciphertext;
    c.res = buildWireResponse(encrypted.ciphertext, c.res);
    emitDevLog(c, state);
  } catch {
    state.errorCode = "CIPH006";
    state.status = 500;
    emitDevLog(c, state);
    c.res = jsonError("CIPH006", "Failed to encrypt response", 500);
  }
}
function ciph(config) {
  if (!config.privateKey && !config.secret) {
    throw new Error(
      "[ciph] CiphHonoConfig requires either `privateKey` (v2 ECDH, recommended) or `secret` (v1 symmetric, deprecated)."
    );
  }
  if (process.env.NODE_ENV !== "production") {
    const dtRaw = config.devtools;
    if (dtRaw !== false) {
      const dtOpts = dtRaw ?? {};
      const dtEnabled = dtOpts.enabled ?? true;
      if (dtEnabled) {
        const port = dtOpts.port ?? 4321;
        autoInitEmitter();
        void startDevtools(port);
      }
    }
  }
  const excludeRoutes = config.excludeRoutes ?? DEFAULT_EXCLUDE_ROUTES;
  const encryptFn = config._testOverrides?.encrypt ?? core.encrypt;
  return async (c, next) => {
    const cx = c;
    const state = {
      startedAt: Date.now(),
      excluded: false,
      fingerprint: null,
      ip: getClientIp(c),
      userAgent: c.req.header("user-agent") ?? "",
      ipMatch: false,
      uaMatch: false,
      encryptedRequestBody: null,
      plainRequestBody: null,
      encryptedResponseBody: null,
      plainResponseBody: null,
      errorCode: null,
      status: 200,
      ecdhClientPublicKey: null,
      ecdhSessionKeyDerived: false
    };
    const pathExcluded = routeMatches(c.req.path, excludeRoutes);
    const middlewareExcluded = cx.get(CIPH_EXCLUDE_KEY) === true;
    if (pathExcluded || middlewareExcluded) {
      state.excluded = true;
      await next();
      state.status = c.res.status;
      emitDevLog(c, state);
      return;
    }
    if (config.privateKey) {
      return handleV2(
        c,
        cx,
        state,
        config,
        next,
        encryptFn
      );
    }
    return handleV1(
      c,
      cx,
      state,
      config,
      next,
      encryptFn
    );
  };
}
export {
  ciph,
  ciphExclude,
  getCiphInspectorApp
};
//# sourceMappingURL=index.mjs.map