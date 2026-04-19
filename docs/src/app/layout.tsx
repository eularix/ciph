import { RootProvider } from 'fumadocs-ui/provider/next';
import './global.css';
import { Inter } from 'next/font/google';
import { StarBackground } from '@/components/StarBackground';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata = {
  metadataBase: new URL('https://ciph.eularix.com'),
  title: {
    default: 'Ciph - Transparent HTTP Encryption',
    template: '%s | Ciph',
  },
  description: 'Transparent HTTP encryption for frontend-backend communication. Encrypt request/response bodies with zero DX change.',
  keywords: ['encryption', 'HTTP', 'security', 'frontend', 'backend', 'AES-256-GCM', 'ECDH', 'P-256'],
  authors: [{ name: 'Eularix', url: 'https://github.com/eularix' }],
  creator: 'Eularix',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://ciph.eularix.com',
    title: 'Ciph - Transparent HTTP Encryption',
    description: 'Encrypt request/response bodies. Plain text never visible in Network tab. Your code stays identical.',
    siteName: 'Ciph',
    images: [
      {
        url: '/og/default.png',
        width: 1200,
        height: 630,
        alt: 'Ciph - Transparent HTTP Encryption',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ciph - Transparent HTTP Encryption',
    description: 'Encrypt request/response bodies with zero DX change.',
    images: ['/og/default.png'],
    creator: '@eularix',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} dark`}
      style={{ fontFamily: 'var(--font-inter), sans-serif' }}
      suppressHydrationWarning
    >
      <body className="flex flex-col min-h-screen">
        <StarBackground />
        <RootProvider theme={{ forcedTheme: 'dark' }}>
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
