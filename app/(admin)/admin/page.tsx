'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, XCircle, ExternalLink, RefreshCw, MessageCircle, ToggleRight } from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PaymentRow {
  id: string
  shop_id: string
  screenshot_url: string
  amount: number
  plan: string
  status: 'pending' | 'verified' | 'rejected'
  submitted_at: string
  verified_at: string | null
  admin_note: string | null
  shops: { name: string; owner_name: string; owner_phone: string; whatsapp_number: string }
}

interface ShopRow {
  id: string
  name: string
  owner_name: string
  owner_phone: string
  whatsapp_number: string
  plan: string
  subscription_status: string
  trial_ends_at: string | null
  subscription_ends_at: string | null
  created_at: string
}

interface Stats {
  activeCount: number
  trialCount: number
  pendingCount: number
  monthlyRevenue: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

const statusColor: Record<string, string> = {
  active: 'var(--success)',
  trial: 'var(--accent)',
  expired: 'var(--danger)',
  payment_pending: 'var(--warning)',
  cancelled: 'var(--text-3)',
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
      <p style={{ color: 'var(--text-3)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{label}</p>
      <p style={{ color: color ?? 'var(--text)', fontWeight: 700, fontSize: 28 }}>{value}</p>
    </div>
  )
}

// ─── Reject modal ─────────────────────────────────────────────────────────────

function RejectModal({ onConfirm, onClose }: { onConfirm: (reason: string) => void; onClose: () => void }) {
  const [reason, setReason] = useState('')
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }} onClick={onClose}>
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14, padding: 28, width: '100%', maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <h3 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Reject payment proof</h3>
        <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 16 }}>Provide a reason — this will be sent to the shop owner via WhatsApp.</p>
        <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Screenshot unclear, amount doesn't match..." rows={4}
          style={{ width: '100%', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text)', fontSize: 14, resize: 'vertical', outline: 'none', marginBottom: 16, fontFamily: 'inherit' }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, color: 'var(--text-2)', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => reason.trim() && onConfirm(reason.trim())} disabled={!reason.trim()}
            style={{ flex: 1, background: 'var(--danger)', border: 'none', borderRadius: 8, padding: 10, color: '#fff', fontWeight: 600, cursor: reason.trim() ? 'pointer' : 'not-allowed', opacity: reason.trim() ? 1 : 0.6 }}>
            Reject & notify
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type ActiveSection = 'payments' | 'shops'

export default function AdminPage() {
  const [section, setSection] = useState<ActiveSection>('payments')
  const [proofs, setProofs] = useState<PaymentRow[]>([])
  const [shops, setShops] = useState<ShopRow[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<PaymentRow | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()

    const [{ data: proofsData }, { data: shopsData }] = await Promise.all([
      supabase.from('payment_proofs').select('*,shops(name,owner_name,owner_phone,whatsapp_number)')
        .eq('status', 'pending').order('submitted_at', { ascending: true }),
      supabase.from('shops').select('id,name,owner_name,owner_phone,whatsapp_number,plan,subscription_status,trial_ends_at,subscription_ends_at,created_at')
        .order('created_at', { ascending: false }),
    ])

    setProofs((proofsData ?? []) as PaymentRow[])
    setShops((shopsData ?? []) as ShopRow[])

    const [{ count: activeCount }, { count: trialCount }, { count: pendingCount }] = await Promise.all([
      supabase.from('shops').select('id', { count: 'exact', head: true }).eq('subscription_status', 'active'),
      supabase.from('shops').select('id', { count: 'exact', head: true }).eq('subscription_status', 'trial'),
      supabase.from('payment_proofs').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ])

    const { data: activePlans } = await supabase.from('shops').select('plan').eq('subscription_status', 'active')
    const PLAN_PRICE: Record<string, number> = { standard: 3500, pro: 5000, boss: 10000 }
    const monthlyRevenue = (activePlans ?? []).reduce((sum, s) => sum + (PLAN_PRICE[s.plan] ?? 0), 0)

    setStats({ activeCount: activeCount ?? 0, trialCount: trialCount ?? 0, pendingCount: pendingCount ?? 0, monthlyRevenue })
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleVerify = async (proof: PaymentRow) => {
    setActionId(proof.id)
    const supabase = createClient()
    try {
      const subEndsAt = new Date(); subEndsAt.setDate(subEndsAt.getDate() + 30)
      await Promise.all([
        supabase.from('payment_proofs').update({ status: 'verified', verified_at: new Date().toISOString() }).eq('id', proof.id),
        supabase.from('shops').update({ subscription_status: 'active', plan: proof.plan, subscription_ends_at: subEndsAt.toISOString() }).eq('id', proof.shop_id),
      ])
      toast.success(`Verified — ${proof.shops.name} is now active`)
      await load()
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally { setActionId(null) }
  }

  const handleReject = async (proof: PaymentRow, reason: string) => {
    setRejectTarget(null); setActionId(proof.id)
    const supabase = createClient()
    try {
      await supabase.from('payment_proofs').update({ status: 'rejected', admin_note: reason }).eq('id', proof.id)
      await fetch('/api/whatsapp/notify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: proof.shops.whatsapp_number, message: `ShopBoss: Your payment proof was rejected.\n\nReason: ${reason}\n\nPlease resubmit at shopboss.app/dashboard/billing.` }),
      }).catch(() => null)
      toast.success('Rejected and owner notified'); await load()
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally { setActionId(null) }
  }

  const sendReminderWA = async (shop: ShopRow) => {
    try {
      const res = await fetch('/api/whatsapp/notify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: shop.whatsapp_number,
          message: `Hi ${shop.owner_name}! 👋 Your ShopBoss ${shop.plan} plan subscription ${shop.subscription_status === 'trial' ? `trial ends on ${fmtDate(shop.trial_ends_at)}` : 'has expired'}. Renew now at shopboss.app/dashboard/billing to keep your shop running. Questions? Reply here.`,
        }),
      })
      if (res.ok) toast.success(`Reminder sent to ${shop.name}`)
      else toast.error('Could not send reminder. Please try again.')
    } catch { toast.error('No internet connection. Please check your network.') }
  }

  const activateShop = async (shop: ShopRow, plan: string) => {
    const supabase = createClient()
    const subEndsAt = new Date(); subEndsAt.setDate(subEndsAt.getDate() + 30)
    const { error } = await supabase.from('shops').update({ subscription_status: 'active', plan, subscription_ends_at: subEndsAt.toISOString() }).eq('id', shop.id)
    if (error) toast.error('Something went wrong. Please try again.')
    else { toast.success(`${shop.name} activated on ${plan}`); await load() }
  }

  if (loading) return <div style={{ padding: 32, color: 'var(--text-3)', fontSize: 14 }}>Loading…</div>

  return (
    <>
      {rejectTarget && (
        <RejectModal onConfirm={reason => handleReject(rejectTarget, reason)} onClose={() => setRejectTarget(null)} />
      )}

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
          <StatCard label="ACTIVE SUBSCRIPTIONS" value={stats?.activeCount ?? 0} color="var(--success)" />
          <StatCard label="TRIAL SHOPS" value={stats?.trialCount ?? 0} color="var(--accent-2)" />
          <StatCard label="PENDING PAYMENTS" value={stats?.pendingCount ?? 0} color="var(--warning)" />
          <StatCard label="MONTHLY REVENUE (EST)" value={`Rs ${(stats?.monthlyRevenue ?? 0).toLocaleString()}`} />
        </div>

        {/* Section tabs */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          {([['payments', 'Pending Payments'], ['shops', 'All Shops']] as [ActiveSection, string][]).map(([id, label]) => (
            <button key={id} onClick={() => setSection(id)}
              style={{ padding: '8px 18px', borderRadius: 8, background: section === id ? 'var(--accent)' : 'var(--bg-2)', border: `1px solid ${section === id ? 'var(--accent)' : 'var(--border)'}`, color: section === id ? 'var(--bg)' : 'var(--text-2)', fontWeight: section === id ? 700 : 500, fontSize: 13, cursor: 'pointer' }}>
              {label} {id === 'payments' && proofs.length > 0 ? `(${proofs.length})` : ''}
            </button>
          ))}
          <button onClick={load} style={{ marginLeft: 'auto', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', color: 'var(--text-2)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        {/* Pending payments */}
        {section === 'payments' && (
          proofs.length === 0 ? (
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
              No pending payment proofs. 🎉
            </div>
          ) : (
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Shop','Owner','Phone','Plan','Amount','Submitted','Screenshot','Actions'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-3)', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {proofs.map(proof => {
                    const busy = actionId === proof.id
                    return (
                      <tr key={proof.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 16px', color: 'var(--text)', fontWeight: 600, fontSize: 13 }}>{proof.shops.name}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-2)', fontSize: 13 }}>{proof.shops.owner_name}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-2)', fontSize: 13 }}>{proof.shops.owner_phone}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text)', fontSize: 13, fontWeight: 500, textTransform: 'capitalize' }}>{proof.plan}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text)', fontSize: 13 }}>Rs {proof.amount.toLocaleString()}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-2)', fontSize: 12, whiteSpace: 'nowrap' }}>
                          {new Date(proof.submitted_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <a href={proof.screenshot_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent-2)', fontSize: 13 }} className="hover:underline">
                            View <ExternalLink size={11} />
                          </a>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => handleVerify(proof)} disabled={busy}
                              style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 7, padding: '6px 12px', color: 'var(--success)', fontSize: 12, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                              <CheckCircle size={12} /> {busy ? '…' : 'Verify'}
                            </button>
                            <button onClick={() => setRejectTarget(proof)} disabled={busy}
                              style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 7, padding: '6px 12px', color: 'var(--danger)', fontSize: 12, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <XCircle size={12} /> Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* All shops */}
        {section === 'shops' && (
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Shop','Owner','Phone','Plan','Status','Trial/Exp Date','Joined','Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-3)', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shops.map(shop => (
                  <tr key={shop.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 16px', color: 'var(--text)', fontWeight: 600, fontSize: 13 }}>{shop.name}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-2)', fontSize: 12 }}>{shop.owner_name}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-2)', fontSize: 12 }}>{shop.owner_phone}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>{shop.plan}</span>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ color: statusColor[shop.subscription_status] ?? 'var(--text-3)', fontWeight: 600, fontSize: 12, textTransform: 'capitalize' }}>{shop.subscription_status}</span>
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-3)', fontSize: 12 }}>
                      {shop.subscription_status === 'trial' ? fmtDate(shop.trial_ends_at) : fmtDate(shop.subscription_ends_at)}
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-3)', fontSize: 12 }}>{fmtDate(shop.created_at)}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {/* Activate */}
                        {shop.subscription_status !== 'active' && (
                          <button onClick={() => activateShop(shop, shop.plan)}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 6, padding: '5px 10px', color: 'var(--success)', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            <ToggleRight size={11} /> Activate
                          </button>
                        )}
                        {/* WhatsApp reminder */}
                        {shop.whatsapp_number && (
                          <button onClick={() => sendReminderWA(shop)}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', color: 'var(--text-2)', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            <MessageCircle size={11} /> Remind
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
