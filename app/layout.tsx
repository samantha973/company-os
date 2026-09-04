import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import './styles/tokens.css'
import './styles/utilities.css'
import './globals.css'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.startsWith('http')
  ? process.env.NEXT_PUBLIC_SITE_URL
  : 'https://company-os-neon.vercel.app'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'The PR Hub — Company OS',
  description:
    'The internal operations platform for The PR Hub — the single sign-in for staff, team members and clients of the PR & strategic communications agency.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'The PR Hub',
    description: '8 Edges Operating System',
    siteName: 'The PR Hub',
    type: 'website',
    images: [{ url: '/og-pr-hub.png', width: 1200, height: 630, alt: 'The PR Hub — 8 Edges Operating System' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The PR Hub',
    description: '8 Edges Operating System',
    images: ['/og-pr-hub.png'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
