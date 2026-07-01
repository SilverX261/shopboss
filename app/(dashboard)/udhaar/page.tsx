'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useShop } from '@/hooks/useShop'
import { localDayISO } from '@/lib/utils/daily-accounting'
import { Plus, X, Copy, CheckCircle, ArrowDownCircle, ArrowUpCircle, MessageSquare, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

type Kind = 'customer' | 'supplier'

interface LedgerItem {
  id: string
  name: string
  phone: string | null
  total: number
  paid: number
  remaining: number
  due_date: string | null
  status: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtRs = (n: number) => `Rs ${Math.round(n).toLocaleString('en-PK')}`
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

// Days overdue (positive = overdue, negative = not due yet). null when no due date.
function overdueDays(due: string | null): number | null {
  if (!due) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(due); d.setHours(0, 0, 0, 0)
  return Math.round((today.getTime() - d.getTime()) / 86_400_000)
}

function dueColor(due: string | null): { color: string; bg: string; border: string } {
  const od = overdueDays(due)
  if (od === null) return { color: 'var(--text-3)', bg: 'var(--bg-3)', border: 'var(--border)' }
  if (od > 0) return { color: 'var(--danger)', bg: 'var(--danger-bg)', border: 'var(--danger-border)' }     // overdue
  if (od >= -3) return { color: 'var(--warning)', bg: 'var(--warning-bg)', border: 'var(--border)' }          // due soon
  return { color: 'var(--success)', bg: 'var(--success-bg)', border: 'var(--success-border)' }                // not due
}

const AGING_BUCKETS = [
  { key: 'notdue', label: 'Not due yet', test: (od: number | null) => od === null || od <= 0 },
  { key: '1-7', label: '1–7 days overdue', test: (od: number | null) => od !== null && od >= 1 && od <= 7 },
  { key: '8-30', label: '8–30 days overdue', test: (od: number | null) => od !== null && od >= 8 && od <= 30 },
  { key: '31-60', label: '31–60 days overdue', test: (od: number | null) => od !== null && od >= 31 && od <= 60 },
  { key: '60+', label: '60+ days overdue', test: (od: number | null) => od !== null && od > 60 },
] as const

// ─── WhatsApp Templates Modal ────────────────────────────────────────────────

function TemplatesModal({
  item, shopName, onClose,
}: {
  item: LedgerItem
  shopName: string
  onClose: () => void
}) {
  const [copied, setCopied] = useState<number | null>(null)
  const dueStr = item.due_date ? new Date(item.due_date).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' }) : 'due date'

  const templates = [
    {
      label: 'Gentle Reminder (3 days before)',
      text: `Assalamu Alaikum ${item.name},\n${shopName} ki taraf se yaad dahaani.\nAapka Rs ${Math.round(item.remaining).toLocaleString('en-PK')} ka payment ${dueStr} ko due hai.\nShukriya.`,
    },
    {
      label: 'Firm Reminder (overdue)',
      text: `Assalamu Alaikum ${item.name},\nAapka Rs ${Math.round(item.remaining).toLocaleString('en-PK')} ka payment ${dueStr} se overdue hai.\nMeherbani karke jald payment karein.\n${shopName}`,
    },
  ]

  const copy = (idx: number, text: string) => {
    navigator.clipboard.writeText(text).then(
      () => { setCopied(idx); setTimeout(() => setCopied(null), 2000) },
      () => {},
    )
  }

  const openWhatsApp = (text: string) => {
    if (!item.phone) return
    const phone = '92' + item.phone.replace(/\D/g, '').replace(/^0/, '')
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }} onClick={onClose}>
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14, padding: '28px 24px', width: '100%', maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 17 }}>Reminder Templates</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}><X size={18} /></button>
        </div>
        <p style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 20 }}>{item.name} · Remaining: Rs {Math.round(item.remaining).toLocaleString('en-PK')}</p>

        {templates.map((t, i) => (
          <div key={i} style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px', marginBottom: 12 }}>
            <p style={{ color: 'var(--text-2)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>{t.label}</p>
            <p style={{ color: 'var(--text)', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: 14, background: 'var(--bg-2)', borderRadius: 8, padding: '12px' }}>
              {t.text}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => copy(i, t.text)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: copied === i ? 'var(--success-bg)' : 'var(--bg-2)', border: `1px solid ${copied === i ? 'var(--success-border)' : 'var(--border)'}`, borderRadius: 8, padding: '9px', color: copied === i ? 'var(--success)' : 'var(--text-2)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                <Copy size={13} /> {copied === i ? 'Copied!' : 'Copy'}
              </button>
              {item.phone && (
                <button onClick={() => openWhatsApp(t.text)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 8, padding: '9px', color: 'var(--success)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  <ExternalLink size={13} /> Send on WhatsApp
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Payment modal ──────────────────────────────────────────────────────────

function PaymentModal({
  item, kind, onClose, onConfirm,
}: {
  item: LedgerItem
  kind: Kind
  onClose: () => void
  onConfirm: (amount: number, method: 'cash' | 'bank') => Promise<void>
}) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'cash' | 'bank'>('cash')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    const n = parseFloat(amount)
    if (isNaN(n) || n <= 0) { toast.error('Enter a valid amount'); return }
    if (n > item.remaining) { toast.error(`Cannot exceed remaining (${fmtRs(item.remaining)})`); return }
    setSaving(true)
    await onConfirm(n, method)
    setSaving(false)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }} onClick={onClose}>
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14, padding: '28px 24px', width: '100%', maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <h3 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 17 }}>Partial Payment</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}><X size={18} /></button>
        </div>
        <p style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 16 }}>
          {item.name} · {kind === 'customer' ? 'owes' : 'owed'} {fmtRs(item.remaining)}
        </p>
        <input
          type="number" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)}
          placeholder={kind === 'customer' ? 'Amount received…' : 'Amount paid…'}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          style={{ width: '100%', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px', color: 'var(--text)', fontSize: 20, fontWeight: 700, outline: 'none', marginBottom: 14, boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', gap: 0, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: 4, marginBottom: 16 }}>
          {(['cash', 'bank'] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMethod(m)} style={{ flex: 1, background: method === m ? 'var(--bg-2)' : 'transparent', border: 'none', borderRadius: 6, padding: '8px 0', color: method === m ? 'var(--text)' : 'var(--text-3)', fontWeight: method === m ? 600 : 400, fontSize: 13, cursor: 'pointer', textTransform: 'capitalize' }}>{m}</button>
          ))}
        </div>
        <button onClick={submit} disabled={saving} style={{ width: '100%', background: 'var(--success)', border: 'none', borderRadius: 8, padding: '12px', color: '#fff', fontWeight: 600, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving…' : 'Record Payment'}
        </button>
      </div>
    </div>
  )
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function Card({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
      <p style={{ color: 'var(--text-3)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</p>
      <p style={{ color: color ?? 'var(--text)', fontWeight: 800, fontSize: 20 }}>{value}</p>
      {sub && <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 2 }}>{sub}</p>}
    </div>
  )
}

// ─── Ledger card ──────────────────────────────────────────────────────────────

function LedgerCard({
  item, kind, onMarkPaid, onPartial, onRemind,
}: {
  item: LedgerItem
  kind: Kind
  onMarkPaid: (item: LedgerItem) => void
  onPartial: (item: LedgerItem) => void
  onRemind?: (item: LedgerItem) => void
}) {
  const od = overdueDays(item.due_date)
  const dc = dueColor(item.due_date)
  const isOverdue = item.status === 'overdue' || (od !== null && od > 0 && item.status !== 'paid')

  return (
    <div style={{ background: isOverdue ? 'rgba(255,180,171,0.05)' : 'var(--bg-2)', border: `1px solid ${isOverdue ? 'var(--danger-border)' : 'var(--border)'}`, borderLeft: `4px solid ${dc.color}`, borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <p style={{ color: isOverdue ? '#ffb4ab' : 'var(--text)', fontWeight: 700, fontSize: 15 }}>{item.name}</p>
            {isOverdue && (
              <span style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: '#ffb4ab', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em' }}>OVERDUE</span>
            )}
          </div>
          {item.phone && <p style={{ color: 'var(--text-3)', fontSize: 12 }}>{item.phone}</p>}
        </div>
        <span style={{ background: dc.bg, color: dc.color, border: `1px solid ${dc.border}`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
          {od === null ? 'No due date' : od > 0 ? `${od}d overdue` : od === 0 ? 'Due today' : `Due in ${Math.abs(od)}d`}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 22, marginBottom: 14, flexWrap: 'wrap' }}>
        <div><p style={{ color: 'var(--text-3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total</p><p style={{ color: 'var(--text)', fontWeight: 700 }}>{fmtRs(item.total)}</p></div>
        <div><p style={{ color: 'var(--text-3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Paid</p><p style={{ color: 'var(--success)', fontWeight: 700 }}>{fmtRs(item.paid)}</p></div>
        <div><p style={{ color: 'var(--text-3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Remaining</p><p style={{ color: dc.color, fontWeight: 700 }}>{fmtRs(item.remaining)}</p></div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}><p style={{ color: 'var(--text-3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Due</p><p style={{ color: 'var(--text-2)', fontWeight: 600, fontSize: 13 }}>{fmtDate(item.due_date)}</p></div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onMarkPaid(item)} style={{ flex: 1, background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 7, padding: '9px 12px', color: 'var(--success)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          Mark Paid
        </button>
        <button onClick={() => onPartial(item)} style={{ flex: 1, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 7, padding: '9px 12px', color: 'var(--text-2)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
          Partial Payment
        </button>
        {kind === 'customer' && onRemind && (
          <button onClick={() => onRemind(item)} style={{ flexShrink: 0, background: 'var(--warning-bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '9px 12px', color: 'var(--warning)', fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <MessageSquare size={12} /> Templates
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Aging breakdown ──────────────────────────────────────────────────────────

function Aging({ items }: { items: LedgerItem[] }) {
  const buckets = AGING_BUCKETS.map((b) => ({
    ...b,
    total: items.filter((i) => b.test(overdueDays(i.due_date))).reduce((s, i) => s + i.remaining, 0),
  }))
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: 13 }}>Aging breakdown</p>
      </div>
      {buckets.map((b) => {
        const serious = b.key === '60+' && b.total > 0
        return (
          <div key={b.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ color: serious ? 'var(--danger)' : 'var(--text-2)', fontSize: 13, fontWeight: serious ? 700 : 400 }}>
              {b.label}{serious ? ' — serious problem' : ''}
            </span>
            <span style={{ color: serious ? 'var(--danger)' : 'var(--text)', fontSize: 13, fontWeight: 600 }}>{fmtRs(b.total)}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UdhaarPage() {
  const { shop } = useShop()
  const [tab, setTab] = useState<Kind>('customer')
  const [customers, setCustomers] = useState<LedgerItem[]>([])
  const [suppliers, setSuppliers] = useState<LedgerItem[]>([])
  const [recoveredMonth, setRecoveredMonth] = useState(0)
  const [supplierPaidTotal, setSupplierPaidTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [payTarget, setPayTarget] = useState<{ item: LedgerItem; kind: Kind } | null>(null)
  const [templateTarget, setTemplateTarget] = useState<LedgerItem | null>(null)

  const load = useCallback(async () => {
    if (!shop) return
    const supabase = createClient()
    const monthStart = localDayISO(new Date()).slice(0, 7) + '-01'

    const [{ data: udhaar }, { data: supp }, { data: pays }] = await Promise.all([
      supabase
        .from('udhaar_records')
        .select('id, customer_name, customer_phone, total_amount, amount_paid, amount_remaining, due_date, status')
        .eq('shop_id', shop.id)
        .in('status', ['pending', 'partial'])
        .order('due_date', { ascending: true }),
      supabase
        .from('supplier_credits')
        .select('id, supplier_name, amount_owed, amount_paid, due_date, status')
        .eq('shop_id', shop.id)
        .in('status', ['pending', 'partial'])
        .order('due_date', { ascending: true }),
      supabase
        .from('udhaar_payments')
        .select('amount_paid, payment_date')
        .eq('shop_id', shop.id)
        .gte('payment_date', monthStart),
    ])

    setCustomers((udhaar ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      name: r.customer_name as string,
      phone: (r.customer_phone as string) ?? null,
      total: (r.total_amount as number) ?? 0,
      paid: (r.amount_paid as number) ?? 0,
      remaining: (r.amount_remaining as number) ?? 0,
      due_date: (r.due_date as string) ?? null,
      status: r.status as string,
    })))

    setSuppliers((supp ?? []).map((r: Record<string, unknown>) => {
      const owed = (r.amount_owed as number) ?? 0
      const paid = (r.amount_paid as number) ?? 0
      return {
        id: r.id as string,
        name: r.supplier_name as string,
        phone: null,
        total: owed,
        paid,
        remaining: owed - paid,
        due_date: (r.due_date as string) ?? null,
        status: r.status as string,
      }
    }))

    setRecoveredMonth((pays ?? []).reduce((s: number, p: { amount_paid: number }) => s + p.amount_paid, 0))

    // supplier all-time paid (no date log for suppliers)
    const { data: allSupp } = await supabase.from('supplier_credits').select('amount_paid').eq('shop_id', shop.id)
    setSupplierPaidTotal((allSupp ?? []).reduce((s: number, r: { amount_paid: number }) => s + (r.amount_paid ?? 0), 0))

    setLoading(false)
  }, [shop])

  useEffect(() => { load() }, [load])

  // ── Customer actions ──
  const customerMarkPaid = async (item: LedgerItem) => {
    if (!shop) return
    const supabase = createClient()
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from('udhaar_payments').insert({
        shop_id: shop.id, udhaar_id: item.id, amount_paid: item.remaining, payment_date: localDayISO(), payment_method: 'cash',
      }),
      supabase.from('udhaar_records').update({ status: 'paid', amount_paid: item.total, amount_remaining: 0 }).eq('id', item.id),
    ])
    if (e1 || e2) { toast.error('Something went wrong. Please try again.'); return }
    toast.success('Marked paid — added to today’s cash')
    load()
  }

  const customerPartial = async (item: LedgerItem, amount: number, method: 'cash' | 'bank') => {
    if (!shop) return
    const supabase = createClient()
    const newPaid = item.paid + amount
    const newRemaining = item.remaining - amount
    const status = newRemaining <= 0 ? 'paid' : 'partial'
    const { error: e1 } = await supabase.from('udhaar_payments').insert({
      shop_id: shop.id, udhaar_id: item.id, amount_paid: amount, payment_date: localDayISO(), payment_method: method,
    })
    const { error: e2 } = await supabase.from('udhaar_records').update({ amount_paid: newPaid, amount_remaining: newRemaining, status }).eq('id', item.id)
    if (e1 || e2) { toast.error('Something went wrong. Please try again.'); return }
    toast.success(`Payment of ${fmtRs(amount)} recorded${method === 'cash' ? ' — added to cash' : ''}`)
    load()
  }

  const customerRemind = (item: LedgerItem) => {
    setTemplateTarget(item)
  }

  // ── Supplier actions ──
  const supplierMarkPaid = async (item: LedgerItem) => {
    const supabase = createClient()
    const { error } = await supabase.from('supplier_credits').update({ status: 'paid', amount_paid: item.total }).eq('id', item.id)
    if (error) { toast.error('Something went wrong. Please try again.'); return }
    toast.success('Marked paid')
    load()
  }

  const supplierPartial = async (item: LedgerItem, amount: number) => {
    const supabase = createClient()
    const newPaid = item.paid + amount
    const status = newPaid >= item.total ? 'paid' : 'partial'
    const { error } = await supabase.from('supplier_credits').update({ amount_paid: newPaid, status }).eq('id', item.id)
    if (error) { toast.error('Something went wrong. Please try again.'); return }
    toast.success(`Payment of ${fmtRs(amount)} recorded`)
    load()
  }

  const items = tab === 'customer' ? customers : suppliers
  const today = localDayISO()
  const weekEnd = localDayISO(new Date(Date.now() + 7 * 86_400_000))

  const summary = useMemo(() => {
    const totalOutstanding = items.reduce((s, i) => s + i.remaining, 0)
    const overdue = items.filter((i) => i.due_date && i.due_date < today).reduce((s, i) => s + i.remaining, 0)
    const dueWeek = items.filter((i) => i.due_date && i.due_date >= today && i.due_date <= weekEnd).reduce((s, i) => s + i.remaining, 0)
    return { totalOutstanding, overdue, dueWeek }
  }, [items, today, weekEnd])

  if (loading) return <div style={{ color: 'var(--text-3)', fontSize: 14 }}>Loading udhaar…</div>

  return (
    <div style={{ maxWidth: 820, marginInline: 'auto' }}>
      {templateTarget && (
        <TemplatesModal
          item={templateTarget}
          shopName={shop?.name ?? 'our shop'}
          onClose={() => setTemplateTarget(null)}
        />
      )}

      {payTarget && (
        <PaymentModal
          item={payTarget.item}
          kind={payTarget.kind}
          onClose={() => setPayTarget(null)}
          onConfirm={async (amount, method) => {
            if (payTarget.kind === 'customer') await customerPartial(payTarget.item, amount, method)
            else await supplierPartial(payTarget.item, amount)
          }}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 32, marginBottom: 2 }}>Udhaar Ledger</h1>
          <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Track credit both ways — what customers owe you and what you owe suppliers</p>
        </div>
        <Link href="/udhaar/new" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '9px 16px', color: 'var(--bg)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
          <Plus size={14} /> New Udhaar
        </Link>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {([['customer', 'Customers owe me', ArrowDownCircle], ['supplier', 'I owe suppliers', ArrowUpCircle]] as [Kind, string, typeof ArrowDownCircle][]).map(([k, label, Icon]) => {
          const active = tab === k
          return (
            <button key={k} onClick={() => setTab(k)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: active ? 'var(--accent-bg)' : 'var(--bg-2)', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, padding: '9px 16px', color: active ? 'var(--accent-2)' : 'var(--text-2)', fontWeight: active ? 600 : 500, fontSize: 13, cursor: 'pointer' }}>
              <Icon size={15} /> {label}
            </button>
          )
        })}
      </div>

      {/* Summary bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 20 }}>
        <Card label="Total outstanding" value={fmtRs(summary.totalOutstanding)} sub={`${items.length} active`} />
        <Card label="Overdue" value={fmtRs(summary.overdue)} color={summary.overdue > 0 ? 'var(--danger)' : 'var(--text)'} />
        <Card label="Due this week" value={fmtRs(summary.dueWeek)} color={summary.dueWeek > 0 ? 'var(--warning)' : 'var(--text)'} />
        {tab === 'customer'
          ? <Card label="Recovered this month" value={fmtRs(recoveredMonth)} color="var(--success)" />
          : <Card label="Paid (all time)" value={fmtRs(supplierPaidTotal)} color="var(--success)" />}
      </div>

      {/* Aging */}
      <Aging items={items} />

      {/* List */}
      {items.length === 0 ? (
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '48px', textAlign: 'center' }}>
          <CheckCircle size={28} style={{ color: 'var(--success)', marginBottom: 10 }} />
          <p style={{ color: 'var(--text-3)', fontSize: 14 }}>
            {tab === 'customer' ? 'No customers owe you right now. 🎉' : 'You don’t owe any suppliers right now. 🎉'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((item) => (
            <LedgerCard
              key={item.id}
              item={item}
              kind={tab}
              onMarkPaid={tab === 'customer' ? customerMarkPaid : supplierMarkPaid}
              onPartial={(it) => setPayTarget({ item: it, kind: tab })}
              onRemind={tab === 'customer' ? customerRemind : undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}
