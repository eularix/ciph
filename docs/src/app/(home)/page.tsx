'use client';
import Link from 'next/link';
import { useState } from 'react';

export default function HomePage() {
  const [copied, setCopied] = useState(false);

  function copyInstall() {
    void navigator.clipboard.writeText('pnpm add @ciph/react @ciph/hono').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', color: '#e6edf3', position: 'relative', zIndex: 1 }}>
      <style>{`
        .hp-btn { border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.15s; border: none; font-family: inherit; }
        .hp-btn-primary { background: #4f8ef7; color: white; padding: 11px 20px; font-size: 14px; }
        .hp-btn-primary:hover { background: #6ba3ff; }
        .hp-btn-ghost { background: transparent; border: 1px solid rgba(255,255,255,0.1); color: #e6edf3; padding: 10px 20px; font-size: 14px; }
        .hp-btn-ghost:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.2); }

        .hp-copy-btn { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #8b949e; font-size: 12px; padding: 4px 8px; border-radius: 4px; cursor: pointer; transition: all 0.15s; font-family: inherit; }
        .hp-copy-btn:hover { background: rgba(255,255,255,0.1); color: #e6edf3; }
      `}</style>
      
      <section style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', textAlign: 'center' }}>
        <div style={{ maxWidth: '720px' }}>
          
          {/* Badge */}
          <div style={{ display: 'inline-block', padding: '6px 12px', borderRadius: '6px', background: 'rgba(79,142,247,0.1)', border: '1px solid rgba(79,142,247,0.2)', marginBottom: 24, fontSize: 12, color: '#a5c8ff', fontWeight: 600, letterSpacing: '0.05em' }}>
            AES-256-GCM • ECDH P-256 • Zero DX
          </div>
          
          {/* Hero */}
          <h1 style={{ fontSize: 56, fontWeight: 800, margin: '0 0 20px 0', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
            Encrypt the Wire
          </h1>
          
          <p style={{ fontSize: 18, color: '#8b949e', margin: '0 0 40px 0', lineHeight: 1.7, letterSpacing: '-0.01em' }}>
            Request and response bodies encrypted. Plain text never visible in Network tab. Your code stays identical.
          </p>

          {/* CTA Buttons */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 40 }}>
            <Link href="/docs" style={{ textDecoration: 'none' }}>
              <button className="hp-btn hp-btn-primary">
                Docs →
              </button>
            </Link>
            
            <Link href="/generate-key" style={{ textDecoration: 'none' }}>
              <button className="hp-btn hp-btn-ghost">
                Generate Key
              </button>
            </Link>
          </div>

          {/* Install command */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', padding: '12px 16px', borderRadius: 8, margin: '0 0 32px 0', fontSize: 13 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#8b949e', flexShrink: 0 }}>$</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#4f8ef7', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>pnpm add @ciph/react @ciph/hono</span>
            <button
              onClick={copyInstall}
              className="hp-copy-btn"
            >
              {copied ? '✓ copied' : 'copy'}
            </button>
          </div>

          {/* Features bullet points */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14, color: '#8b949e' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span style={{ color: '#3fb950' }}>✓</span> Drop-in replacement for axios
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span style={{ color: '#3fb950' }}>✓</span> Device fingerprint binding, replay-proof
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span style={{ color: '#3fb950' }}>✓</span> Browser DevTools inspector (dev only)
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <section style={{ padding: '32px 20px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', color: '#8b949e', fontSize: 13 }}>
        <p style={{ margin: 0 }}>
          Made by <a href="https://eularix.com" style={{ color: '#4f8ef7', textDecoration: 'none' }}>Eularix</a>
        </p>
      </section>
    </div>
  );
}
