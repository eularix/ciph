import { ImageResponse } from 'next/og';

export const revalidate = 3600; // Revalidate every hour

export async function GET() {
  return new ImageResponse(
    <div
      style={{
        fontSize: 128,
        background: `linear-gradient(135deg, #0f172a 0%, #1e293b 100%)`,
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 40,
        padding: '60px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Logo/Icon */}
      <div
        style={{
          fontSize: 80,
          fontWeight: 'bold',
          background: 'linear-gradient(135deg, #60a5fa, #a78bfa)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '-2px',
        }}
      >
        🛡️ Ciph
      </div>

      {/* Title */}
      <div
        style={{
          fontSize: 60,
          fontWeight: 800,
          color: '#e6edf3',
          textAlign: 'center',
          lineHeight: 1.2,
          maxWidth: '900px',
          letterSpacing: '-1px',
        }}
      >
        Transparent HTTP Encryption
      </div>

      {/* Description */}
      <div
        style={{
          fontSize: 32,
          color: '#8b949e',
          textAlign: 'center',
          maxWidth: '900px',
          lineHeight: 1.4,
        }}
      >
        Encrypt request/response bodies. Plain text never visible in Network tab.
      </div>

      {/* Features */}
      <div
        style={{
          display: 'flex',
          gap: 60,
          fontSize: 24,
          color: '#a5c8ff',
          fontWeight: 600,
        }}
      >
        <span>AES-256-GCM</span>
        <span>ECDH P-256</span>
        <span>Zero DX</span>
      </div>

      {/* URL */}
      <div
        style={{
          fontSize: 20,
          color: '#4f8ef7',
          marginTop: 20,
        }}
      >
        ciph.sh
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
    },
  );
}
