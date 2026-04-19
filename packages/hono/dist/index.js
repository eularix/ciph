"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  autoInitEmitter: () => autoInitEmitter,
  ciph: () => ciph,
  ciphExclude: () => ciphExclude,
  ciphPublicKeyEndpoint: () => ciphPublicKeyEndpoint,
  getCiphInspectorApp: () => getCiphInspectorApp,
  initDevtools: () => initDevtools
});
module.exports = __toCommonJS(index_exports);
var core = __toESM(require("@ciph/core"));

// src/devtools.ts
var import_hono = require("hono");
var _logs = [];
var _maxLogs = 500;
var _bufferSubscribed = false;
var _devtoolsConfig = { temporary: true, logFilePath: ".ciph-logs.jsonl" };
async function writeLogToFile(log) {
  if (_devtoolsConfig.temporary !== false || typeof global === "undefined") return;
  try {
    if (typeof require !== "undefined") {
      const fs = require("fs");
      const path = require("path");
      const logPath = path.resolve(_devtoolsConfig.logFilePath || ".ciph-logs.jsonl");
      const line = JSON.stringify(log) + "\n";
      fs.appendFileSync(logPath, line);
      return;
    }
  } catch (e) {
  }
}
function clearLogFile() {
  if (_devtoolsConfig.temporary !== false || typeof global === "undefined") return;
  try {
    if (typeof require !== "undefined") {
      const fs = require("fs");
      const path = require("path");
      const logPath = path.resolve(_devtoolsConfig.logFilePath || ".ciph-logs.jsonl");
      if (fs.existsSync(logPath)) fs.unlinkSync(logPath);
    }
  } catch (e) {
  }
}
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
function initDevtools(config) {
  if (_bufferSubscribed) return;
  _bufferSubscribed = true;
  if (config) {
    _devtoolsConfig = { ...{ temporary: true, logFilePath: ".ciph-logs.jsonl" }, ...config };
  }
  if (config?.maxInMemoryLogs) {
    _maxLogs = config.maxInMemoryLogs;
  }
  if (globalThis.ciphServerEmitter && typeof globalThis.ciphServerEmitter.on === "function") {
    globalThis.ciphServerEmitter.on("log", (log) => {
      _logs.unshift(log);
      if (_logs.length > _maxLogs) _logs.pop();
      if (_devtoolsConfig.temporary === false) {
        writeLogToFile(log).catch(() => {
        });
      }
    });
  }
}
function buildInspectorHtml(streamUrl, logsUrl) {
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
  <h1>\u{1F512} Ciph</h1>
  <span class="lbl" id="lbl">Connecting\u2026</span>
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
  function fmtObj(v){if(v===null||v===undefined)return'\u2014';try{return JSON.stringify(v,null,2);}catch(e){return String(v);}}
  function trunc(s){if(!s)return'\u2014';return s.length>100?s.slice(0,100)+'\u2026':s;}
  function getStatus(s){if(s>=500)return'\u25CF';if(s>=400)return'\u25CF';return'\u2713';}

  function showEmpty(){
    var d=document.getElementById('detail');
    d.replaceChildren();
    var empty=mk('div','empty');
    ap(empty,
      mk('div','','\u2190'),
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
      var btn=mk('button','cbtn','\u{1F4CB} Copy');
      btn.onclick=(function(raw){return function(){
        navigator.clipboard.writeText(raw).then(function(){
          var oldText=btn.textContent;
          btn.textContent='\u2713 Copied';
          setTimeout(function(){btn.textContent=oldText;},1500);
        }).catch(function(){});
      };})(rawForCopy);
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
      mk('span','tag '+(isEnc?'tenc':'texcl'),isEnc?'\u{1F512} Encrypted':'\u25CB Passthrough')
    );
    var dmeta=mk('div','dmeta');
    dmeta.appendChild(mk('span','',l.timestamp||''));
    dmeta.appendChild(mk('span','','Duration: '+(l.duration||'?')+'ms'));
    if(l.request&&l.request.ip)dmeta.appendChild(mk('span','','IP: '+l.request.ip));
    if(l.request&&l.request.ua)dmeta.appendChild(mk('span','','UA matched: '+(l.request.uaMatch?'\u2713':'\u2717')));
    ap(dhead,dtitle,dmeta);
    detail.appendChild(dhead);
    var req=l.request||{};var res=l.response||{};
    var rawReqEnc=(req.encryptedBody)||'';var rawResEnc=(res.encryptedBody)||'';
    var cols1=mk('div','cols');
    ap(cols1,codeBlock('\u{1F513} Request Data',fmtObj(req.plainBody)),codeBlock('\u{1F513} Response Data',fmtObj(res.plainBody)));
    detail.appendChild(cols1);
    if(isEnc){
      var cols2=mk('div','cols');
      var truncReq=trunc(rawReqEnc);var truncRes=trunc(rawResEnc);
      ap(cols2,codeBlock('\u{1F510} Request Encrypted',truncReq,rawReqEnc),codeBlock('\u{1F510} Response Encrypted',truncRes,rawResEnc));
      detail.appendChild(cols2);
    }
    var fp=l.fingerprint||{};
    if(fp.value||fp.uaMatch!==undefined){
      var fpSec=mk('div','sec');
      fpSec.appendChild(mk('div','stitle','\u{1F3AF} Fingerprint'));
      if(fp.value){
        var row=mk('div','fp');
        ap(row,mk('span','fpk','Hash'),mk('span','fpv',trunc(fp.value)));
        fpSec.appendChild(row);
      }
      if(fp.uaMatch!==undefined){
        var row2=mk('div','fp');
        ap(row2,mk('span','fpk','UA Match'),mk('span','fpv',fp.uaMatch?'\u2713 Matched':'\u2717 Changed'));
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
      document.getElementById('lbl').textContent='Reconnecting in '+(nextDelay/1000|0)+'s\u2026';
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
</html>`;
}
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
  "connection": "keep-alive"
};
function getCiphInspectorApp() {
  const app = new import_hono.Hono();
  app.get("/", (c) => {
    const host = c.req.header("host") ?? "localhost";
    const proto = c.req.header("x-forwarded-proto") ?? "http";
    const base = c.req.routePath.replace(/\/\*$/, "").replace(/\/$/, "");
    const streamUrl = `${proto}://${host}${base}/stream`;
    const logsUrl = `${base}/logs`;
    return c.html(buildInspectorHtml(streamUrl, logsUrl));
  });
  app.get("/stream", (c) => {
    return new Response(makeSSEStream(c.req.raw.signal), { headers: sseResponseHeaders });
  });
  app.get("/logs", (c) => {
    return c.json({ logs: [..._logs], total: _logs.length });
  });
  app.delete("/logs", (c) => {
    _logs.length = 0;
    clearLogFile();
    return c.json({ ok: true });
  });
  return app;
}

// src/index.ts
function ciphPublicKeyEndpoint(publicKey) {
  if (!publicKey || publicKey.trim().length === 0) {
    throw new Error(
      "[ciph] ciphPublicKeyEndpoint requires a non-empty publicKey. Run 'npx ciph generate-keys' to generate both keys, then provide VITE_CIPH_SERVER_PUBLIC_KEY."
    );
  }
  return async (c) => {
    return c.json({ publicKey }, 200);
  };
}
var CIPH_EXCLUDE_KEY = "ciph.exclude.route";
var DEFAULT_EXCLUDE_ROUTES = ["/health", "/ciph", "/ciph/*", "/ciph-public-key", "/ciph-devtools", "/ciph-devtools/*"];
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
  const path = c.req.path;
  if (path === "/ciph-devtools" || path.startsWith("/ciph-devtools/")) {
    return;
  }
  const log = buildLog(c, state);
  console.log(`[Ciph] Log emitted: ${c.req.method} ${c.req.path} \u2192 ${state.errorCode ?? "OK"}`);
  getCiphServerEmitter()?.emit("log", log);
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
  } catch (error) {
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
  } catch (error) {
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
    autoInitEmitter();
    initDevtools();
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  autoInitEmitter,
  ciph,
  ciphExclude,
  ciphPublicKeyEndpoint,
  getCiphInspectorApp,
  initDevtools
});
//# sourceMappingURL=index.js.map