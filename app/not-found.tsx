'use client'

import { useRouter } from 'next/navigation'
import { Zap } from 'lucide-react'

export default function NotFound() {
  const router = useRouter()
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px',
        textAlign: 'center',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 40 }}>
        <div style={{ width: 32, height: 32, background: 'var(--accent)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Zap size={16} style={{ color: 'var(--bg)' }} />
        </div>
        <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: 20 }}>ShopBoss</span>
      </div>

      <p style={{ color: 'var(--text-3)', fontWeight: 700, fontSize: 80, lineHeight: 1, marginBottom: 16 }}>404</p>
      <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 22, marginBottom: 12 }}>
        This page doesn&apos;t exist.
      </h1>
      <p style={{ color: 'var(--text-3)', fontSize: 15, marginBottom: 36 }}>
        But your shop data is safe.
      </p>
      <button
        onClick={() => router.push('/dashboard')}
        style={{
          background: 'var(--accent)', color: 'var(--bg)', fontWeight: 700, fontSize: 15,
          padding: '12px 28px', borderRadius: 10, border: 'none', cursor: 'pointer',
        }}
      >
        Back to Dashboard
      </button>
    </div>
  )
}
