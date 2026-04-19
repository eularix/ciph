import type { Metadata } from 'next';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { pageOptions } from '@/lib/layout.shared';

export const metadata: Metadata = {
  title: 'Ciph - Transparent HTTP Encryption',
  description: 'Encrypt request/response bodies between frontend and backend. Plain text never visible in browser Network DevTools. Zero DX change for developers.',
  keywords: ['encryption', 'HTTP', 'security', 'API security', 'AES-256-GCM', 'ECDH'],
  openGraph: {
    type: 'website',
    title: 'Ciph - Transparent HTTP Encryption',
    description: 'Encrypt request/response bodies with zero DX change. Plain text never visible in Network tab.',
    images: [
      {
        url: '/og/default.png',
        width: 1200,
        height: 630,
        alt: 'Ciph - Transparent HTTP Encryption',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ciph - Transparent HTTP Encryption',
    description: 'Encrypt request/response bodies with zero DX change.',
    images: ['/og/default.png'],
  },
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return <HomeLayout {...pageOptions()}>{children}</HomeLayout>;
}
