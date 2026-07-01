'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, Package, ShoppingCart, Boxes, CreditCard,
  Users, Monitor, BarChart2, Receipt, Settings, Wallet,
  UserCircle, ChevronRight, LogOut,
} from 'lucide-react'
import { useDashboard } from '@/components/layout/DashboardContext'
import { createClient } from '@/lib/supabase/client'

const MAIN_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/sales',     label: 'Sales',     icon: ShoppingCart },
  { href: '/inventory', label: 'Inventory', icon: Package },
] as const

const FINANCE_NAV = [
  { href: '/udhaar', label: 'Udhaar', icon: CreditCard },
  { href: '/cash',   label: 'Cash',   icon: Wallet },
] as const

const STOCK_NAV = [
  { href: '/accessories', label: 'Accessories', icon: Boxes },
] as const

const TEAM_NAV = [
  { href: '/workers', label: 'Workers', icon: Users },
] as const

const INSIGHTS_NAV = [
  { href: '/reports', label: 'Reports', icon: BarChart2 },
] as const

const BOSS_NAV = [
  { href: '/monitor', label: 'Monitor', icon: Monitor },
] as const

const BOTTOM_NAV = [
  { href: '/billing',  label: 'Billing',  icon: Receipt },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const

const STAFF_NAV = [
  { href: '/sales/new', label: 'New Sale',  icon: ShoppingCart },
  { href: '/inventory', label: 'Inventory', icon: Package },
  { href: '/udhaar',    label: 'Udhaar',    icon: CreditCard },
] as const

const PLAN_LABELS: Record<string, string> = {
  standard: 'Standard',
  pro:      'Pro Plan',
  boss:     'Boss Plan',
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { shop, isStaff, workerName } = useDashboard()
  const isBoss = shop?.plan === 'boss'

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard'
    : href === '/sales/new' ? pathname === '/sales/new'
    : pathname.startsWith(href)

  const navItem = (href: string, label: string, Icon: React.ElementType) => {
    const active = isActive(href)
    return (
      <Link
        key={href}
        href={href}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '9px 12px 9px 13px',
          borderRadius: '0 8px 8px 0',
          marginLeft: -8,
          borderLeft: `3px solid ${active ? 'var(--accent)' : 'transparent'}`,
          background: active ? 'var(--bg-4)' : 'transparent',
          color: active ? 'var(--text)' : 'var(--text-3)',
          fontWeight: active ? 600 : 500,
          fontSize: 13,
          textDecoration: 'none',
          transition: 'background 0.12s, color 0.12s',
        }}
      >
        <Icon size={15} style={{ opacity: active ? 1 : 0.65, flexShrink: 0 }} />
        {label}
      </Link>
    )
  }

  const section = (text: string) => (
    <div style={{
      padding: '12px 12px 5px',
      fontSize: 10,
      fontWeight: 700,
      color: 'var(--text-3)',
      letterSpacing: '0.1em',
      textTransform: 'uppercase' as const,
    }}>
      {text}
    </div>
  )

  return (
    <aside style={{
      width: 240,
      flexShrink: 0,
      height: '100vh',
      background: 'var(--bg-2)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>

      {/* Logo */}
      <div style={{ padding: '22px 20px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34,
            background: 'var(--accent)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
              <rect x="3" y="7" width="14" height="10" rx="2" stroke="#4b2800" strokeWidth="1.7"/>
              <path d="M7 7V5.5A1.5 1.5 0 0 1 8.5 4h3A1.5 1.5 0 0 1 13 5.5V7" stroke="#4b2800" strokeWidth="1.7" strokeLinecap="round"/>
              <path d="M3 11h14" stroke="#4b2800" strokeWidth="1.7" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1 }}>
              ShopBoss
            </div>
            <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-3)', marginTop: 3, letterSpacing: '0.02em' }}>
              {shop?.name ?? 'Laptop Shop OS'}
            </div>
          </div>
        </div>
      </div>

      {/* Staff badge */}
      {isStaff && workerName && (
        <div style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 8,
          flexShrink: 0,
        }}>
          <UserCircle size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <div>
            <p style={{ color: 'var(--text)', fontSize: 12, fontWeight: 600 }}>{workerName}</p>
            <p style={{ color: 'var(--text-3)', fontSize: 10 }}>Staff account</p>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px 8px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {isStaff ? (
          <>
            {section('Staff Menu')}
            {STAFF_NAV.map(({ href, label, icon }) => navItem(href, label, icon))}
          </>
        ) : (
          <>
            {section('Main')}
            {MAIN_NAV.map(({ href, label, icon }) => navItem(href, label, icon))}

            {section('Finance')}
            {FINANCE_NAV.map(({ href, label, icon }) => navItem(href, label, icon))}

            {section('Stock')}
            {STOCK_NAV.map(({ href, label, icon }) => navItem(href, label, icon))}

            {section('Team')}
            {TEAM_NAV.map(({ href, label, icon }) => navItem(href, label, icon))}

            {section('Insights')}
            {INSIGHTS_NAV.map(({ href, label, icon }) => navItem(href, label, icon))}
            {isBoss && BOSS_NAV.map(({ href, label, icon }) => navItem(href, label, icon))}

            <div style={{ marginTop: 'auto', paddingTop: 8 }}>
              {section('Account')}
              {BOTTOM_NAV.map(({ href, label, icon }) => navItem(href, label, icon))}
            </div>
          </>
        )}
      </nav>

      {/* Sign out */}
      <div style={{ padding: '10px 14px 0', flexShrink: 0 }}>
        <button
          onClick={handleSignOut}
          style={{
            display: 'flex', alignItems: 'center', gap: 9,
            width: '100%', background: 'none', border: 'none',
            padding: '9px 12px 9px 13px', borderRadius: '0 8px 8px 0',
            marginLeft: -8, color: 'var(--text-3)', fontWeight: 500,
            fontSize: 13, cursor: 'pointer', textAlign: 'left',
            transition: 'color 0.12s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--error, #ef4444)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-3)'
          }}
        >
          <LogOut size={15} style={{ opacity: 0.65, flexShrink: 0 }} />
          Sign Out
        </button>
      </div>

      {/* Plan badge */}
      {shop && !isStaff && (
        <div style={{ padding: 14, borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <Link href="/billing" style={{
            display: 'flex', alignItems: 'center', gap: 9,
            background: 'var(--bg-3)',
            border: '1px solid var(--border-2)',
            borderRadius: 8,
            padding: '11px 12px',
            textDecoration: 'none',
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: 'var(--accent)',
              flexShrink: 0,
              boxShadow: '0 0 6px rgba(255,184,118,0.5)',
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1 }}>
                {PLAN_LABELS[shop.plan] ?? 'Standard'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {shop.subscription_status === 'trial' ? 'Trial active' : 'Subscription active'}
              </div>
            </div>
            <ChevronRight size={13} style={{ color: 'var(--text-3)', opacity: 0.5, flexShrink: 0 }} />
          </Link>
        </div>
      )}

    </aside>
  )
}
