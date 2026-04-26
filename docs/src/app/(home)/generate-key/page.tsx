'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface KeyPair {
  privateKey: {
    jwk: string;
    pkcs8: string;
  };
  publicKey: {
    jwk: string;
    raw: string;
  };
}

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
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
  const privateKeyPkcs8 = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
  const publicKeyRaw = await window.crypto.subtle.exportKey('raw', keyPair.publicKey);

  return {
    privateKey: {
      jwk: JSON.stringify(privateKeyJwk),
      pkcs8: toBase64Url(privateKeyPkcs8),
    },
    publicKey: {
      jwk: JSON.stringify(publicKeyJwk),
      raw: toBase64Url(publicKeyRaw),
    },
  };
}

export default function GenerateKeyPage() {
  const [keyPair, setKeyPair] = useState<KeyPair | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedState, setCopiedState] = useState<string | null>(null);
  const [privateKeyFormat, setPrivateKeyFormat] = useState<'jwk' | 'pkcs8'>('pkcs8');
  const [publicKeyFormat, setPublicKeyFormat] = useState<'jwk' | 'raw'>('raw');

  useEffect(() => {
    generateECDHKeyPair().then((pair) => {
      setKeyPair(pair);
      setIsLoading(false);
    });
  }, []);

  const regen = useCallback(async () => {
    const newKeyPair = await generateECDHKeyPair();
    setKeyPair(newKeyPair);
    setCopiedState(null);
  }, []);

  const copyPrivateKey = useCallback(async () => {
    if (!keyPair) return;
    const text = privateKeyFormat === 'pkcs8' ? keyPair.privateKey.pkcs8 : keyPair.privateKey.jwk;
    await navigator.clipboard.writeText(text);
    setCopiedState('private');
    setTimeout(() => setCopiedState(null), 2000);
  }, [keyPair, privateKeyFormat]);

  const copyPublicKey = useCallback(async () => {
    if (!keyPair) return;
    const text = publicKeyFormat === 'raw' ? keyPair.publicKey.raw : keyPair.publicKey.jwk;
    await navigator.clipboard.writeText(text);
    setCopiedState('public');
    setTimeout(() => setCopiedState(null), 2000);
  }, [keyPair, publicKeyFormat]);

  const copyEnv = useCallback(async (type: 'private' | 'public') => {
    if (!keyPair) return;
    const privateVal = privateKeyFormat === 'pkcs8' ? keyPair.privateKey.pkcs8 : keyPair.privateKey.jwk;
    const publicVal = publicKeyFormat === 'raw' ? keyPair.publicKey.raw : keyPair.publicKey.jwk;
    const text = type === 'private' ? `CIPH_PRIVATE_KEY=${privateVal}` : `CIPH_PUBLIC_KEY=${publicVal}`;
    await navigator.clipboard.writeText(text);
    setCopiedState('env');
    setTimeout(() => setCopiedState(null), 2000);
  }, [keyPair, privateKeyFormat, publicKeyFormat]);

  if (!keyPair) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'var(--font-inter, system-ui)', color: '#e6edf3', position: 'relative', zIndex: 1 }} suppressHydrationWarning>
        {isLoading ? 'Loading...' : ''}
      </div>
    );
  }


  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap');

        .gk { --bg: #07090e; --surface: #0d1117; --border: rgba(255,255,255,0.08); --accent: #4f8ef7; --cyan: #22d3ee; --red: #f87171; --text: #e6edf3; --muted: #8b949e; --green: #3fb950; }
        .gk { font-family: var(--font-inter, sans-serif); background: var(--bg); color: var(--text); min-height: 100vh; position: relative; z-index: 1; }
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
        .gk-env-copy { background: transparent; border: 1px solid var(--border); border-radius: 5px; color: var(--muted); font-size: 11px; padding: 4px 8px; cursor: pointer; transition: all 0.15s; font-family: inherit; white-space: nowrap; }
        .gk-env-copy:hover { background: rgba(255,255,255,0.06); color: var(--text); border-color: rgba(255,255,255,0.15); }
        .gk-section-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin-bottom: 12px; }
      `}</style>

      <div className="gk" style={{ display: 'flex', justifyContent: 'center', padding: '64px 16px' }}>
        <div style={{ width: '100%', maxWidth: 600 }}>

          {/* Header */}
          <div style={{ marginBottom: 40 }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div className="gk-section-label" style={{ margin: 0 }}>Server Private Key</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className={`gk-btn ${privateKeyFormat === 'pkcs8' ? 'gk-btn-primary' : 'gk-btn-ghost'}`} style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => setPrivateKeyFormat('pkcs8')}>
                  PKCS8
                </button>
                <button className={`gk-btn ${privateKeyFormat === 'jwk' ? 'gk-btn-primary' : 'gk-btn-ghost'}`} style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => setPrivateKeyFormat('jwk')}>
                  JWK
                </button>
              </div>
            </div>
            <div className="gk-secret" style={{ marginBottom: 16, maxHeight: 140, overflow: 'auto', wordBreak: 'break-all' }}>
              {keyPair.privateKey[privateKeyFormat] || '—'}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="gk-btn gk-btn-primary" style={{ flex: 1 }} onClick={copyPrivateKey}>
                {copiedState === 'private' ? '✓ Copied' : 'Copy Key'}
              </button>
              <button className="gk-btn gk-btn-ghost" onClick={regen}>
                ↻ Generate New
              </button>
            </div>
          </div>

          {/* Public Key Section */}
          <div className="gk-card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div className="gk-section-label" style={{ margin: 0 }}>Client Public Key</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className={`gk-btn ${publicKeyFormat === 'raw' ? 'gk-btn-primary' : 'gk-btn-ghost'}`} style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => setPublicKeyFormat('raw')}>
                  Raw
                </button>
                <button className={`gk-btn ${publicKeyFormat === 'jwk' ? 'gk-btn-primary' : 'gk-btn-ghost'}`} style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => setPublicKeyFormat('jwk')}>
                  JWK
                </button>
              </div>
            </div>
            <div className="gk-secret" style={{ marginBottom: 16, maxHeight: 140, overflow: 'auto', wordBreak: 'break-all' }}>
              {keyPair.publicKey[publicKeyFormat] || '—'}
            </div>
            <button className="gk-btn gk-btn-ghost" style={{ width: '100%' }} onClick={copyPublicKey}>
              {copiedState === 'public' ? '✓ Copied' : 'Copy Public Key'}
            </button>
          </div>

          {/* .env snippet */}
          <div className="gk-card" style={{ marginBottom: 20 }}>
            <div className="gk-section-label" style={{ marginBottom: 16 }}>.env (backend)</div>
            <div className="gk-env-row" style={{ marginBottom: 12 }}>
              <span style={{ flexShrink: 0 }}>CIPH_PRIVATE_KEY=</span>
              <button className="gk-env-copy" onClick={() => copyEnv('private')}>
                {copiedState === 'env' ? '✓' : 'copy'}
              </button>
            </div>

            <div className="gk-section-label" style={{ marginTop: 16, marginBottom: 16 }}>.env (frontend)</div>
            <div className="gk-env-row">
              <span style={{ flexShrink: 0 }}>CIPH_PUBLIC_KEY=</span>
              <button className="gk-env-copy" onClick={() => copyEnv('public')}>
                {copiedState === 'env' ? '✓' : 'copy'}
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
