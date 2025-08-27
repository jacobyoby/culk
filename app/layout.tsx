import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { ImageAdjustmentProvider } from '@/lib/contexts/image-adjustments-context'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AI Photo Culling',
  description: 'Local-first PWA for culling RAW/JPEG files with AI support',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Photo Cull',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon.svg" />
      </head>
      <body className={inter.className}>
        <ImageAdjustmentProvider>
          {children}
        </ImageAdjustmentProvider>
      </body>
    </html>
  )
}