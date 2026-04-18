'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';

export default function HomePage() {
  const [copied, setCopied] = useState(false);

  function copyInstall() {
    void navigator.clipboard.writeText('pnpm add @ciph/hono @ciph/react').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:ital,wght@0,400;0,500;0,600;1,400&display=swap');

        .cl {
          --bg: #07090e;
          --bg2: #0c0f18;
          --bg3: #111520;
          --border: rgba(255,255,255,0.07);
          --border2: rgba(255,255,255,0.12);
          --text: #f0f4ff;
          --text2: #6b7a99;
          --text3: #3a4560;
          --accent: #4f8ef7;
          --accent2: #22d3ee;
          --green: #34d399;
          background: var(--bg);
          color: var(--text);
          font-family: 'Syne', sans-serif;
          min-height: 100vh;
          position: relative;
          overflow-x: hidden;
        }

        .cl-noise {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");
          pointer-events: none;
          position: fixed;
          inset: 0;
          z-index: 0;
        }

        .cl-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(79,142,247,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(79,142,247,0.04) 1px, transparent 1px);
          background-size: 44px 44px;
          mask-image: radial-gradient(ellipse 90% 55% at 50% 0%, black 0%, transparent 100%);
        }

        .cl-hero {
          position: relative;
          z-index: 1;
          padding: 84px 24px 52px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .cl-glow {
          position: absolute;
          top: -80px;
          left: 50%;
          transform: translateX(-50%);
          width: 800px;
          height: 500px;
          background: radial-gradient(ellipse at 50% 30%, rgba(79,142,247,0.10) 0%, transparent 65%);
          pointer-events: none;
        }

        .cl-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 5px 15px;
          border-radius: 9999px;
          border: 1px solid rgba(79,142,247,0.25);
          background: rgba(79,142,247,0.07);
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: #7eb8ff;
          letter-spacing: 0.4px;
          margin-bottom: 34px;
          animation: cu 0.5s ease both;
        }

        .cl-badge-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #34d399;
          box-shadow: 0 0 6px #34d399;
        }

        .cl-h1 {
          font-size: clamp(2.6rem, 6vw, 4.4rem);
          font-weight: 800;
          line-height: 1.04;
          letter-spacing: -0.035em;
          color: #ffffff;
          max-width: 680px;
          margin-bottom: 22px;
          animation: cu 0.5s 0.08s ease both;
        }

        .cl-h1-em {
          background: linear-gradient(130deg, #4f8ef7 10%, #22d3ee 90%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .cl-sub {
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          line-height: 1.9;
          color: var(--text2);
          max-width: 460px;
          margin-bottom: 40px;
          animation: cu 0.5s 0.16s ease both;
        }

        .cl-ctas {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: center;
          animation: cu 0.5s 0.24s ease both;
        }

        .cl-btn-p {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 11px 22px;
          border-radius: 8px;
          background: #4f8ef7;
          color: #fff;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12.5px;
          font-weight: 600;
          text-decoration: none;
          transition: background 0.14s, transform 0.1s;
        }
        .cl-btn-p:hover { background: #3c7de6; transform: translateY(-1px); }

        .cl-btn-g {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 11px 22px;
          border-radius: 8px;
          border: 1px solid var(--border2);
          color: var(--text2);
          font-family: 'JetBrains Mono', monospace;
          font-size: 12.5px;
          text-decoration: none;
          transition: border-color 0.14s, color 0.14s, transform 0.1s;
        }
        .cl-btn-g:hover { border-color: rgba(255,255,255,0.22); color: var(--text); transform: translateY(-1px); }

        /* ── Demo ── */
        .cl-demo {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 880px;
          margin: 56px auto 0;
          padding: 0 24px;
          animation: cu 0.6s 0.3s ease both;
        }

        .cl-demo-sup {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1.8px;
          color: var(--text3);
          margin-bottom: 12px;
          text-align: center;
        }

        .cl-demo-wrap {
          display: grid;
          grid-template-columns: 1fr 52px 1fr;
          align-items: stretch;
          border: 1px solid var(--border2);
          border-radius: 12px;
          overflow: hidden;
          background: var(--bg2);
          box-shadow: 0 16px 48px rgba(0,0,0,0.35);
        }

        .cl-pane {
          padding: 18px 20px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11.5px;
          line-height: 1.75;
        }

        .cl-pane-hd {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 14px;
          padding-bottom: 10px;
          border-bottom: 1px solid var(--border);
          font-size: 10px;
          color: var(--text3);
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }

        .cl-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

        .cl-mid {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-left: 1px solid var(--border);
          border-right: 1px solid var(--border);
          background: var(--bg3);
          padding: 12px 0;
        }

        .cl-lock {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: rgba(79,142,247,0.12);
          border: 1px solid rgba(79,142,247,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
        }

        .cl-arr { font-size: 9px; color: var(--text3); letter-spacing: 1px; }

        pre.cl-pre { margin: 0; white-space: pre-wrap; word-break: break-all; }
        .tk { color: #7eb8ff; }
        .tv { color: #86efac; }
        .tn { color: #fbbf24; }
        .tb { color: #fb923c; }
        .te { color: #475569; }

        /* ── Features ── */
        .cl-feats {
          position: relative;
          z-index: 1;
          max-width: 880px;
          margin: 72px auto 0;
          padding: 0 24px;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1px;
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
          background: var(--border);
          animation: cu 0.5s 0.4s ease both;
        }

        .cl-feat {
          background: var(--bg2);
          padding: 26px 22px 28px;
        }

        .cl-feat-ico { font-size: 18px; margin-bottom: 12px; }
        .cl-feat-ttl { font-size: 13px; font-weight: 700; margin-bottom: 8px; letter-spacing: -0.01em; }
        .cl-feat-dsc {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10.5px;
          line-height: 1.75;
          color: var(--text2);
        }

        /* ── Install ── */
        .cl-inst {
          position: relative;
          z-index: 1;
          max-width: 520px;
          margin: 60px auto 0;
          padding: 0 24px;
          text-align: center;
          animation: cu 0.5s 0.48s ease both;
        }

        .cl-inst-lbl {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          color: var(--text3);
          letter-spacing: 1.5px;
          text-transform: uppercase;
          margin-bottom: 12px;
        }

        .cl-inst-box {
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--bg2);
          border: 1px solid var(--border2);
          border-radius: 10px;
          padding: 13px 16px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12.5px;
          color: #8fa3c8;
        }

        .cl-inst-ps { color: var(--text3); }
        .cl-inst-cmd { flex: 1; text-align: left; }

        .cl-copy {
          background: none;
          border: 1px solid var(--border2);
          border-radius: 6px;
          color: var(--text2);
          cursor: pointer;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10.5px;
          padding: 4px 10px;
          white-space: nowrap;
          transition: border-color 0.14s, color 0.14s, background 0.14s;
        }
        .cl-copy:hover { border-color: rgba(255,255,255,0.2); color: var(--text); }
        .cl-copy.ok { border-color: #34d399; color: #34d399; background: rgba(52,211,153,0.08); }

        /* ── Footer logo ── */
        .cl-foot {
          position: relative;
          z-index: 1;
          display: flex;
          justify-content: center;
          padding: 52px 0 48px;
          opacity: 0.12;
        }

        @keyframes cu {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 700px) {
          .cl-demo-wrap { grid-template-columns: 1fr; }
          .cl-mid { flex-direction: row; border-left: none; border-right: none; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); padding: 10px 16px; }
          .cl-feats { grid-template-columns: 1fr 1fr; }
          .cl-h1 { font-size: 2.3rem; }
        }

        @media (max-width: 480px) {
          .cl-feats { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="cl">
        <div className="cl-noise" aria-hidden />

        {/* Hero */}
        <section className="cl-hero">
          <div className="cl-grid" aria-hidden />
          <div className="cl-glow" aria-hidden />

          <div className="cl-badge">
            <span className="cl-badge-dot" />
            AES-256-GCM · ECDH v2 · Zero DX change
          </div>

          <h1 className="cl-h1">
            Encrypt the wire.<br />
            <span className="cl-h1-em">Invisibly.</span>
          </h1>

          <p className="cl-sub">
            Request and response bodies are encrypted at the application layer.
            Plain text never appears in Network DevTools.
            Your code stays identical.
          </p>

          <div className="cl-ctas">
            <Link href="/docs/getting-started" className="cl-btn-p">
              Get Started →
            </Link>
            <Link href="/generate-key" className="cl-btn-g">
              Generate Key
            </Link>
          </div>
        </section>

        {/* Cipher demo */}
        <div className="cl-demo">
          <div className="cl-demo-sup">What the network sees vs what your code sees</div>
          <div className="cl-demo-wrap">
            <div className="cl-pane">
              <div className="cl-pane-hd">
                <span className="cl-dot" style={{ background: '#34d399' }} />
                Your code receives
              </div>
              <pre className="cl-pre">{`{
  `}<span className="tk">"user"</span>{`: `}<span className="tv">"dimas"</span>{`,
  `}<span className="tk">"role"</span>{`: `}<span className="tv">"Lead Engineer"</span>{`,
  `}<span className="tk">"salary"</span>{`: `}<span className="tn">120000</span>{`,
  `}<span className="tk">"active"</span>{`: `}<span className="tb">true</span>{`
}`}</pre>
            </div>

            <div className="cl-mid">
              <div className="cl-lock">🔒</div>
              <div className="cl-arr">ciph</div>
            </div>

            <div className="cl-pane">
              <div className="cl-pane-hd">
                <span className="cl-dot" style={{ background: '#4f8ef7' }} />
                Network tab sees
              </div>
              <pre className="cl-pre"><span className="te">{`{
  "status": "encrypted",
  "data": "YWFiYmNjZGRlZWZm
  Z2doaGlpamprb…"
}`}</span></pre>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="cl-feats">
          {([
            ['🔐', 'AES-256-GCM', 'Per-request key via HKDF + device fingerprint. Each device gets unique ciphertext.'],
            ['⚡', 'Zero API change', 'ciph.get() works exactly like axios.get(). Encryption is transparent.'],
            ['🛡️', 'Built-in DevTools', 'Inspector shows decrypted payloads in dev. Zero bytes shipped to production.'],
            ['🔌', 'Framework ready', 'React + Hono now. Express, NestJS, Vue, Svelte in v0.3.'],
          ] as const).map(([ico, ttl, dsc]) => (
            <div key={ttl} className="cl-feat">
              <div className="cl-feat-ico">{ico}</div>
              <div className="cl-feat-ttl">{ttl}</div>
              <div className="cl-feat-dsc">{dsc}</div>
            </div>
          ))}
        </div>

        {/* Install */}
        <div className="cl-inst">
          <div className="cl-inst-lbl">Quick start</div>
          <div className="cl-inst-box">
            <span className="cl-inst-ps">$</span>
            <span className="cl-inst-cmd">pnpm add @ciph/hono @ciph/react</span>
            <button
              className={`cl-copy${copied ? ' ok' : ''}`}
              onClick={copyInstall}
            >
              {copied ? '✓ copied' : 'copy'}
            </button>
          </div>
        </div>

        {/* Footer logo watermark */}
        <div className="cl-foot">
          <Image src="/logo-white.svg" alt="" width={88} height={33} aria-hidden />
        </div>
      </div>
    </>
  );
}
