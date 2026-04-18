'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface KeyPair {
  publicKey: string;
  privateKey: string;
}

async function generateECDHKeyPair(): Promise<KeyPair> {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true,
    ['deriveBits']
  );

  const publicKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const privateKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);

  return {
    publicKey: JSON.stringify(publicKeyJwk),
    privateKey: JSON.stringify(privateKeyJwk),
  };
}

export default function GenerateKeyPage() {
  const [keyPair, setKeyPair] = useState<KeyPair | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);

  useEffect(() => {
    generateECDHKeyPair().then((pair) => {
      setKeyPair(pair);
      setIsLoading(false);
    });
  }, []);

  const regen = useCallback(async () => {
    const newKeyPair = await generateECDHKeyPair();
    setKeyPair(newKeyPair);
    setCopied(false);
  }, []);

  const copy = useCallback(async () => {
    if (!keyPair) return;
    await navigator.clipboard.writeText(keyPair.privateKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [keyPair]);

  const copyEnv = useCallback(async (val: string) => {
    await navigator.clipboard.writeText(val);
    setCopiedEnv(true);
    setTimeout(() => setCopiedEnv(false), 2000);
  }, []);

  if (!keyPair) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'system-ui', background: '#07090e', color: '#e6edf3' }} suppressHydrationWarning>
        {isLoading ? 'Loading...' : ''}
      </div>
    );
  }

  const envServerPrivate = `CIPH_PRIVATE_KEY=${keyPair.privateKey}`;
  const envClientPublic = `VITE_CIPH_SERVER_PUBLIC_KEY=${keyPair.publicKey}`;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        
        .gk { --bg: #07090e; --surface: #0d1117; --border: rgba(255,255,255,0.08); --accent: #4f8ef7; --cyan: #22d3ee; --red: #f87171; --text: #e6edf3; --muted: #8b949e; --green: #3fb950; }
        .gk { font-family: 'Syne', sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; }
        .gk-mono { font-family: 'JetBrains Mono', monospace; }
        .gk-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 24px; }
        .gk-secret { background: #010409; border: 1px solid var(--border); border-radius: 8px; padding: 16px; font-family: 'JetBrains Mono', monospace; font-size: 12px; word-break: break-all; line-height: 1.6; color: var(--cyan); letter-spacing: 0.02em; }
        .gk-btn { display: flex; align-items: center; justify-content: center; gap: 8px; border-radius: 8px; padding: 10px 16px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; border: none; font-family: inherit; }
        .gk-btn-primary { background: var(--accent); color: #fff; }
        .gk-btn-primary:hover { background: #6ba3ff; }
        .gk-btn-ghost { background: transparent; color: var(--text); border: 1px solid var(--border); }
        .gk-btn-ghost:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.15); }
        .gk-btn-green { background: rgba(63,185,80,0.15); color: var(--green); border: 1px solid rgba(63,185,80,0.3); }
        .gk-btn-green:hover { background: rgba(63,185,80,0.25); }
        .gk-warn { background: rgba(248,113,113,0.07); border: 1px solid rgba(248,113,113,0.2); border-radius: 8px; padding: 12px 16px; font-size: 13px; color: var(--red); display: flex; gap: 10px; align-items: flex-start; }
        .gk-info { background: rgba(79,142,247,0.07); border: 1px solid rgba(79,142,247,0.2); border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #a5c8ff; }
        .gk-env-row { background: #010409; border: 1px solid var(--border); border-radius: 8px; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; font-family: 'JetBrains Mono', monospace; font-size: 12px; }
        .gk-env-key { color: var(--muted); }
        .gk-env-val { color: var(--accent); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
        .gk-env-copy { background: transparent; border: 1px solid var(--border); border-radius: 5px; color: var(--muted); font-size: 11px; padding: 4px 8px; cursor: pointer; transition: all 0.15s; font-family: 'Syne', sans-serif; white-space: nowrap; }
        .gk-env-copy:hover { background: rgba(255,255,255,0.06); color: var(--text); border-color: rgba(255,255,255,0.15); }
        .gk-section-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin-bottom: 12px; }
      `}</style>

      <div className="gk" style={{ display: 'flex', justifyContent: 'center', padding: '64px 16px' }}>
        <div style={{ width: '100%', maxWidth: 600 }}>

          {/* Header */}
          <div style={{ marginBottom: 40 }}>
            <Link href="/" style={{ color: 'var(--muted)', fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 24, transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted)'}>
              ← back
            </Link>
            <h1 style={{ fontSize: 40, fontWeight: 800, margin: '0 0 12px 0', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              Generate Key Pair
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8, fontFamily: "'JetBrains Mono', monospace", margin: 0 }}>
              ECDH P-256 asymmetric key exchange
            </p>
          </div>

          {/* Warning */}
          <div className="gk-warn" style={{ marginBottom: 28 }}>
            <span style={{ flexShrink: 0, fontSize: 16 }}>⚠</span>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Security Notice</div>
              <div style={{ fontSize: 12, color: 'inherit', opacity: 0.9 }}>Store <strong>private key</strong> in backend secrets only (Vault, AWS SSM, environment). Never expose in frontend. Public key can be shared safely.</div>
            </div>
          </div>

          {/* Private Key Section */}
          <div className="gk-card" style={{ marginBottom: 20 }}>
            <div className="gk-section-label">Server Private Key</div>
            <div className="gk-secret" style={{ marginBottom: 16, maxHeight: 140, overflow: 'auto' }}>
              {keyPair.privateKey || '—'}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="gk-btn gk-btn-primary" style={{ flex: 1 }} onClick={copy}>
                {copied ? '✓ Copied' : 'Copy Key'}
              </button>
              <button className="gk-btn gk-btn-ghost" onClick={regen}>
                ↻ Generate New
              </button>
            </div>
          </div>

          {/* Public Key Section */}
          <div className="gk-card" style={{ marginBottom: 20 }}>
            <div className="gk-section-label">Client Public Key</div>
            <div className="gk-secret" style={{ marginBottom: 16, maxHeight: 140, overflow: 'auto' }}>
              {keyPair.publicKey || '—'}
            </div>
            <button className="gk-btn gk-btn-ghost" style={{ width: '100%' }} onClick={() => copyEnv(keyPair.publicKey)}>
              {copiedEnv ? '✓ Copied' : 'Copy Public Key'}
            </button>
          </div>

          {/* .env snippet */}
          <div className="gk-card" style={{ marginBottom: 20 }}>
            <div className="gk-section-label" style={{ marginBottom: 16 }}>.env (backend)</div>
            <div className="gk-env-row" style={{ marginBottom: 12 }}>
              <span style={{ flexShrink: 0 }}>CIPH_PRIVATE_KEY=</span>
              <button className="gk-env-copy" onClick={() => copyEnv(envServerPrivate)}>
                {copiedEnv ? '✓' : 'copy'}
              </button>
            </div>

            <div className="gk-section-label" style={{ marginTop: 16, marginBottom: 16 }}>.env (frontend)</div>
            <div className="gk-env-row">
              <span style={{ flexShrink: 0 }}>VITE_CIPH_SERVER_PUBLIC_KEY=</span>
              <button className="gk-env-copy" onClick={() => copyEnv(envClientPublic)}>
                {copiedEnv ? '✓' : 'copy'}
              </button>
            </div>
          </div>

          {/* Info */}
          <div className="gk-info" style={{ marginBottom: 32 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>How it works</div>
            <div style={{ fontSize: 12, lineHeight: 1.6 }}>
              Client and server use ECDH P-256 to derive a shared secret <em>per-request</em>. No shared secret in .env required. Each request generates fresh encryption keys.
            </div>
          </div>

          {/* CTA */}
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/docs" style={{ flex: 1, textDecoration: 'none' }}>
              <button className="gk-btn gk-btn-green" style={{ width: '100%' }}>
                Read Docs →
              </button>
            </Link>
            <Link href="/" style={{ textDecoration: 'none' }}>
              <button className="gk-btn gk-btn-ghost" style={{ width: '100%' }}>
                ← Home
              </button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
