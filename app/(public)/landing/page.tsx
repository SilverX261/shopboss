import type { Metadata } from 'next'
import Link from 'next/link'
import { Zap } from 'lucide-react'

export const metadata: Metadata = {
  title: 'ShopBoss — Laptop Shop Intelligence by Volta Builds',
  description: 'Manage your laptop shop with ease. Track stock, sales, udhar, workers, cash and accessories — all in one PWA.',
  openGraph: {
    title: 'ShopBoss — Laptop Shop Intelligence',
    description: 'The complete management system for Pakistani laptop shops.',
    type: 'website',
  },
}

export default function LandingPage() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, background: 'var(--accent)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={15} style={{ color: 'var(--bg)' }} />
          </div>
          <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: 18 }}>ShopBoss</span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/pricing" style={{ color: 'var(--text-2)', fontSize: 14, textDecoration: 'none' }}>Pricing</Link>
          <Link href="/login" style={{ background: 'var(--accent)', color: 'var(--bg)', fontSize: 14, fontWeight: 700, padding: '8px 18px', borderRadius: 8, textDecoration: 'none' }}>Get Started</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', textAlign: 'center' }}>
        <h1 style={{ color: 'var(--text)', fontWeight: 800, fontSize: 'clamp(32px, 6vw, 56px)', lineHeight: 1.15, marginBottom: 20, maxWidth: 700 }}>
          Run your laptop shop like a{' '}
          <span style={{ color: 'var(--accent)' }}>boss</span>
        </h1>
        <p style={{ color: 'var(--text-2)', fontSize: 18, maxWidth: 540, marginBottom: 40, lineHeight: 1.6 }}>
          Track stock, sales, udhar, workers, cash and accessories — all in one PWA built for Pakistani laptop markets.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link href="/signup" style={{ background: 'var(--accent)', color: 'var(--bg)', fontWeight: 700, fontSize: 16, padding: '14px 32px', borderRadius: 10, textDecoration: 'none' }}>
            Start free trial
          </Link>
          <Link href="/pricing" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text)', fontWeight: 500, fontSize: 16, padding: '14px 32px', borderRadius: 10, textDecoration: 'none' }}>
            See pricing
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '24px 32px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-3)', fontSize: 13 }}>
          ShopBoss is a product of Volta Builds. All rights reserved 2025.
        </p>
      </footer>
    </main>
  )
}
