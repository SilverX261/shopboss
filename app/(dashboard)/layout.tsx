import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { TrialBanner } from '@/components/shared/TrialBanner'
import { DashboardProvider } from '@/components/layout/DashboardContext'
import type { Shop } from '@/lib/types'

interface SessionContext {
  shop: Shop
  isStaff: boolean
  workerId: string | null
  workerName: string | null
}

async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Check if this user is a shop owner
  const { data: shop } = await supabase
    .from('shops')
    .select('*')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (shop) {
    const now = new Date()
    if (shop.subscription_status === 'trial' && new Date(shop.trial_ends_at) < now) {
      await supabase.from('shops').update({ subscription_status: 'expired' }).eq('id', shop.id)
      redirect('/billing')
    }
    if (
      shop.subscription_status === 'active' &&
      shop.subscription_ends_at &&
      new Date(shop.subscription_ends_at) < now
    ) {
      await supabase.from('shops').update({ subscription_status: 'expired' }).eq('id', shop.id)
      redirect('/billing')
    }
    return { shop: shop as Shop, isStaff: false, workerId: null, workerName: null }
  }

  // Check if this user is a staff worker
  const { data: worker } = await supabase
    .from('workers')
    .select('id, name, shop_id, is_active')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (worker?.is_active) {
    const { data: workerShop } = await supabase
      .from('shops')
      .select('*')
      .eq('id', worker.shop_id)
      .maybeSingle()
    if (workerShop) {
      return {
        shop: workerShop as Shop,
        isStaff: true,
        workerId: worker.id,
        workerName: worker.name,
      }
    }
  }

  return null
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getSessionContext()

  return (
    <DashboardProvider
      shop={ctx?.shop ?? null}
      isStaff={ctx?.isStaff ?? false}
      workerId={ctx?.workerId ?? null}
      workerName={ctx?.workerName ?? null}
    >
      <div
        style={{
          display: 'flex',
          height: '100vh',
          background: 'var(--bg)',
          overflow: 'hidden',
        }}
      >
        <Sidebar />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {ctx?.shop?.subscription_status === 'trial' && !ctx.isStaff && (
            <TrialBanner shop={ctx.shop} />
          )}
          <main style={{ flex: 1, overflowY: 'auto', padding: '24px 32px 100px' }}>
            {children}
          </main>
        </div>
      </div>
    </DashboardProvider>
  )
}
