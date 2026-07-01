'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Zap, RefreshCw } from 'lucide-react'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0C0B09', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 40 }}>
          <div style={{ width: 32, height: 32, background: '#C17F3E', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={16} style={{ color: '#0C0B09' }} />
          </div>
          <span style={{ color: '#F0EDE8', fontWeight: 700, fontSize: 20 }}>ShopBoss</span>
        </div>
        <p style={{ color: '#C17F3E', fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Something went wrong</p>
        <p style={{ color: '#8A8580', fontSize: 14, marginBottom: 32, maxWidth: 380 }}>
          An unexpected error occurred. Your data is safe — please try refreshing.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={reset}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#C17F3E', border: 'none', borderRadius: 10, padding: '12px 24px', color: '#0C0B09', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
          >
            <RefreshCw size={14} /> Try Again
          </button>
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', background: '#1E1D1A', border: '1px solid #2A2925', borderRadius: 10, padding: '12px 24px', color: '#B8B3AE', fontWeight: 500, fontSize: 14, textDecoration: 'none' }}>
            Go to Dashboard
          </Link>
        </div>
      </body>
    </html>
  )
}
