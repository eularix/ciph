'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

function generateSecret(): string {
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export default function GenerateKeyPage() {
  const [secret, setSecret] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);

  useEffect(() => { setSecret(generateSecret()); }, []);

  const regen = useCallback(() => { setSecret(generateSecret()); setCopied(false); }, []);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [secret]);

  const copyEnv = useCallback(async (val: string) => {
    await navigator.clipboard.writeText(val);
    setCopiedEnv(true);
    setTimeout(() => setCopiedEnv(false), 2000);
  }, []);

  const envFrontend = `VITE_CIPH_SECRET=${secret}`;
  const envBackend = `CIPH_SECRET=${secret}`;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        .gk { --bg: #07090e; --surface: #0d1117; --border: rgba(255,255,255,0.08); --accent: #4f8ef7; --cyan: #22d3ee; --red: #f87171; --text: #e6edf3; --muted: #8b949e; --green: #3fb950; }
        .gk { font-family: 'Syne', sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; }
        .gk-mono { font-family: 'JetBrains Mono', monospace; }
        .gk-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 28px; }
        .gk-secret { background: #010409; border: 1px solid var(--border); border-radius: 8px; padding: 16px 20px; font-family: 'JetBrains Mono', monospace; font-size: 13px; word-break: break-all; line-height: 1.7; color: var(--cyan); letter-spacing: 0.02em; }
        .gk-btn { display: flex; align-items: center; justify-content: center; gap: 8px; border-radius: 8px; padding: 10px 18px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; border: none; font-family: inherit; }
        .gk-btn-primary { background: var(--accent); color: #fff; }
        .gk-btn-primary:hover { background: #6ba3ff; }
        .gk-btn-ghost { background: transparent; color: var(--text); border: 1px solid var(--border); }
        .gk-btn-ghost:hover { background: rgba(255,255,255,0.05); }
        .gk-btn-green { background: rgba(63,185,80,0.15); color: var(--green); border: 1px solid rgba(63,185,80,0.3); }
        .gk-btn-green:hover { background: rgba(63,185,80,0.25); }
        .gk-warn { background: rgba(248,113,113,0.07); border: 1px solid rgba(248,113,113,0.2); border-radius: 8px; padding: 12px 16px; font-size: 13px; color: var(--red); display: flex; gap: 10px; align-items: flex-start; }
        .gk-env-row { background: #010409; border: 1px solid var(--border); border-radius: 8px; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; font-family: 'JetBrains Mono', monospace; font-size: 12px; }
        .gk-env-key { color: var(--muted); }
        .gk-env-val { color: var(--accent); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
        .gk-env-copy { background: transparent; border: 1px solid var(--border); border-radius: 5px; color: var(--muted); font-size: 11px; padding: 3px 9px; cursor: pointer; transition: all 0.15s; font-family: 'Syne', sans-serif; white-space: nowrap; }
        .gk-env-copy:hover { background: rgba(255,255,255,0.06); color: var(--text); }
        .gk-section-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin-bottom: 8px; }
      `}</style>

      <div className="gk" style={{ display: 'flex', justifyContent: 'center', padding: '64px 16px' }}>
        <div style={{ width: '100%', maxWidth: 580 }}>

          {/* Header */}
          <div style={{ marginBottom: 40 }}>
            <Link href="/" style={{ color: 'var(--muted)', fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 28 }}>
              ← home
            </Link>
            <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              Generate Secret Key
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8, fontFamily: "'JetBrains Mono', monospace" }}>
              AES-256-GCM via HKDF — 96-char hex, 384 bits of entropy
            </p>
          </div>

          {/* Warning */}
          <div className="gk-warn" style={{ marginBottom: 24 }}>
            <span style={{ flexShrink: 0, marginTop: 1 }}>⚠</span>
            <span>Never commit this key to version control. Store in a secrets manager (Vault, AWS SSM, Doppler) or <code style={{ background: 'rgba(255,255,255,0.07)', padding: '1px 5px', borderRadius: 4 }}>.env.local</code> (gitignored).</span>
          </div>

          {/* Secret card */}
          <div className="gk-card" style={{ marginBottom: 16 }}>
            <div className="gk-section-label">Your Secret Key</div>
            <div className="gk-secret" style={{ marginBottom: 16 }}>
              {secret || '—'}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="gk-btn gk-btn-primary" style={{ flex: 1 }} onClick={copy}>
                {copied ? '✓ Copied' : 'Copy Key'}
              </button>
              <button className="gk-btn gk-btn-ghost" onClick={regen}>
                ↻ Regenerate
              </button>
            </div>
          </div>

          {/* .env snippet */}
          <div className="gk-card" style={{ marginBottom: 16 }}>
            <div className="gk-section-label">.env (frontend)</div>
            <div className="gk-env-row" style={{ marginBottom: 8 }}>
              <span className="gk-mono" style={{ color: 'var(--muted)', flexShrink: 0 }}>VITE_CIPH_SECRET=</span>
              <span className="gk-env-val">{secret ? secret.slice(0, 24) + '…' : '—'}</span>
              <button className="gk-env-copy" onClick={() => copyEnv(envFrontend)}>
                {copiedEnv ? '✓' : 'copy'}
              </button>
            </div>

            <div className="gk-section-label" style={{ marginTop: 16 }}>.env (backend)</div>
            <div className="gk-env-row">
              <span className="gk-mono" style={{ color: 'var(--muted)', flexShrink: 0 }}>CIPH_SECRET=</span>
              <span className="gk-env-val">{secret ? secret.slice(0, 24) + '…' : '—'}</span>
              <button className="gk-env-copy" onClick={() => copyEnv(envBackend)}>
                copy
              </button>
            </div>
          </div>

          {/* Important: same secret both sides */}
          <div style={{ background: 'rgba(79,142,247,0.07)', border: '1px solid rgba(79,142,247,0.2)', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#a5c8ff', marginBottom: 32 }}>
            <strong style={{ color: 'var(--accent)' }}>Required:</strong> frontend and backend must share the <strong>same</strong> secret. Ciph uses it as the HKDF root key — mismatch = 401 CIPH002.
          </div>

          {/* CTA */}
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/docs" style={{ flex: 1, textAlign: 'center' }}>
              <button className="gk-btn gk-btn-green" style={{ width: '100%' }}>
                Continue to Docs →
              </button>
            </Link>
            <Link href="/">
              <button className="gk-btn gk-btn-ghost">
                ← Back
              </button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
