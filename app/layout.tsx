import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import './globals.css'

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plus-jakarta',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ShopBoss — Laptop Shop Intelligence by Volta Builds',
  description: 'Manage your laptop shop with ease. Track stock, sales, udhar, workers, cash and accessories — all in one PWA.',
  manifest: '/manifest.json',
  icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ShopBoss',
  },
  openGraph: {
    title: 'ShopBoss — Laptop Shop Intelligence',
    description: 'The complete management system for Pakistani laptop shops.',
    type: 'website',
    siteName: 'ShopBoss',
  },
}

export const viewport: Viewport = {
  themeColor: '#0C0B09',
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
      <body className={`${plusJakartaSans.variable} font-sans antialiased`}>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'var(--bg-3)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              fontFamily: 'var(--font-plus-jakarta)',
            },
            success: {
              iconTheme: { primary: 'var(--success)', secondary: 'var(--bg-3)' },
            },
            error: {
              iconTheme: { primary: 'var(--danger)', secondary: 'var(--bg-3)' },
            },
          }}
        />
      </body>
    </html>
  )
}
