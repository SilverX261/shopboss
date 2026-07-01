import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'hello@voltastudio.dev'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== ADMIN_EMAIL) {
    redirect('/')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div
        style={{
          height: 56,
          background: 'var(--bg-2)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          gap: 12,
        }}
      >
        <div
          style={{
            background: 'var(--danger)',
            borderRadius: 6,
            padding: '2px 10px',
            fontSize: 11,
            fontWeight: 700,
            color: '#fff',
          }}
        >
          ADMIN
        </div>
        <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: 16 }}>ShopBoss Admin</span>
        <span style={{ color: 'var(--text-3)', fontSize: 13, marginLeft: 'auto' }}>{user.email}</span>
      </div>
      <main>{children}</main>
    </div>
  )
}
