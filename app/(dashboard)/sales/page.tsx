'use client'

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useShop } from '@/hooks/useShop'
import { Download, Search, X, AlertTriangle, Plus, ChevronDown, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SaleRow {
  id: string
  sale_price: number
  payment_type: string
  profit: number
  sold_at: string
  is_voided: boolean
  customer_name: string | null
  customer_phone: string | null
  bank_reference: string | null
  notes: string | null
  laptop: { brand: string; model: string; imei: string; purchase_price: number } | null
  worker: { name: string } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtRs = (n: number) => `Rs ${Math.round(n).toLocaleString('en-PK')}`
const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })
const fmtTime = (s: string) =>
  new Date(s).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
const startOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) }

const purchasePriceOf = (s: SaleRow) => s.laptop?.purchase_price ?? (s.sale_price - s.profit)

const payBadge = (type: string) => {
  const cfg: Record<string, { bg: string; color: string; label: string }> = {
    cash: { bg: 'var(--success-bg)', color: 'var(--success)', label: 'Cash' },
    udhaar: { bg: 'var(--warning-bg)', color: 'var(--warning)', label: 'Udhaar' },
    bank_transfer: { bg: 'var(--info-bg)', color: 'var(--info)', label: 'Bank' },
  }
  const c = cfg[type] ?? { bg: 'var(--bg-3)', color: 'var(--text-3)', label: type }
  return (
    <span style={{ background: c.bg, color: c.color, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {c.label}
    </span>
  )
}

// ─── Void modal ───────────────────────────────────────────────────────────────

function VoidModal({ sale, onClose, onVoided }: { sale: SaleRow; onClose: () => void; onVoided: () => void }) {
  const [phase, setPhase] = useState<'confirm' | 'otp'>('confirm')
  const [voidToken, setVoidToken] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)

  const requestOtp = async () => {
    setLoading(true)
    const res = await fetch('/api/sales/void-request', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sale_id: sale.id }),
    })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) { toast.error('Could not send OTP. Please try again.'); return }
    setVoidToken(json.void_token)
    setPhase('otp')
    toast.success('OTP sent to your WhatsApp')
  }

  const confirmVoid = async () => {
    if (otp.length !== 6) { toast.error('Enter the 6-digit OTP'); return }
    setLoading(true)
    const res = await fetch('/api/sales/void', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sale_id: sale.id, void_token: voidToken, otp }),
    })
    await res.json()
    setLoading(false)
    if (!res.ok) { toast.error('Could not void the sale. Please try again.'); return }
    toast.success('Sale voided')
    onVoided()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }} onClick={onClose}>
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14, padding: '28px 24px', width: '100%', maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 17 }}>{phase === 'confirm' ? 'Void Sale' : 'Enter OTP'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}><X size={18} /></button>
        </div>

        {phase === 'confirm' ? (
          <>
            <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 8, padding: '12px', marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <AlertTriangle size={16} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ color: 'var(--danger)', fontSize: 13, fontWeight: 600 }}>Void sale #{sale.id.slice(0, 8)} — {fmtRs(sale.sale_price)}</p>
                  <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 3 }}>This will restore the laptop to &quot;In Stock&quot; and requires WhatsApp OTP approval.</p>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '11px', color: 'var(--text-2)', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
              <button onClick={requestOtp} disabled={loading} style={{ flex: 1, background: 'var(--danger)', border: 'none', borderRadius: 8, padding: '11px', color: '#fff', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 14, opacity: loading ? 0.7 : 1 }}>{loading ? 'Sending…' : 'Send OTP →'}</button>
            </div>
          </>
        ) : (
          <>
            <p style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 16 }}>Enter the 6-digit OTP sent to your WhatsApp number.</p>
            <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="_ _ _ _ _ _" style={{ width: '100%', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px', color: 'var(--text)', fontSize: 24, letterSpacing: 8, textAlign: 'center', outline: 'none', marginBottom: 16, boxSizing: 'border-box' }} autoFocus />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setPhase('confirm')} style={{ flex: 1, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '11px', color: 'var(--text-2)', cursor: 'pointer', fontSize: 14 }}>Back</button>
              <button onClick={confirmVoid} disabled={loading || otp.length !== 6} style={{ flex: 1, background: 'var(--danger)', border: 'none', borderRadius: 8, padding: '11px', color: '#fff', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 14, opacity: loading || otp.length !== 6 ? 0.6 : 1 }}>{loading ? 'Voiding…' : 'Void Sale'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function Card({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
      <p style={{ color: 'var(--text-3)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</p>
      <p style={{ color: accent ?? 'var(--text)', fontWeight: 700, fontSize: 19 }}>{value}</p>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SalesPage() {
  const { shop } = useShop()
  const [sales, setSales] = useState<SaleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterPayment, setFilterPayment] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [voidSale, setVoidSale] = useState<SaleRow | null>(null)

  const load = useCallback(async () => {
    if (!shop) return
    const supabase = createClient()
    const { data } = await supabase
      .from('sales')
      .select(`
        id, sale_price, payment_type, profit, sold_at, is_voided, customer_name, customer_phone, bank_reference, notes,
        laptops ( brand, model, imei, purchase_price ),
        workers ( name )
      `)
      .eq('shop_id', shop.id)
      .order('sold_at', { ascending: false })
      .limit(1000)

    const rows = (data ?? []).map((s: Record<string, unknown>) => ({
      ...s,
      laptop: Array.isArray(s.laptops) ? s.laptops[0] ?? null : (s.laptops as SaleRow['laptop']),
      worker: Array.isArray(s.workers) ? s.workers[0] ?? null : (s.workers as SaleRow['worker']),
    })) as SaleRow[]

    setSales(rows)
    setLoading(false)
  }, [shop])

  useEffect(() => { load() }, [load])

  // Real-time: refresh whenever a sale is inserted/updated for this shop
  useEffect(() => {
    if (!shop) return
    const supabase = createClient()
    const channel = supabase
      .channel(`sales-${shop.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales', filter: `shop_id=eq.${shop.id}` }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [shop, load])

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // ── Time-based summary cards (always over all sales, not filters) ──
  const cards = useMemo(() => {
    const todayStart = startOfToday().getTime()
    const monthStart = startOfMonth().getTime()
    let todayRev = 0, todayProfit = 0, monthRev = 0, monthProfit = 0
    for (const s of sales) {
      if (s.is_voided) continue
      const t = new Date(s.sold_at).getTime()
      if (t >= todayStart) { todayRev += s.sale_price; todayProfit += s.profit }
      if (t >= monthStart) { monthRev += s.sale_price; monthProfit += s.profit }
    }
    return { todayRev, todayProfit, monthRev, monthProfit }
  }, [sales])

  // ── Filtered list + totals ──
  const filtered = useMemo(() => sales.filter((s) => {
    if (filterPayment && s.payment_type !== filterPayment) return false
    if (filterDateFrom && new Date(s.sold_at) < new Date(filterDateFrom)) return false
    if (filterDateTo && new Date(s.sold_at) > new Date(filterDateTo + 'T23:59:59')) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        (s.laptop?.imei.includes(q) ?? false) ||
        (s.laptop?.model.toLowerCase().includes(q) ?? false) ||
        (s.laptop?.brand.toLowerCase().includes(q) ?? false) ||
        (s.customer_name ?? '').toLowerCase().includes(q)
      )
    }
    return true
  }), [sales, filterPayment, filterDateFrom, filterDateTo, search])

  const totals = useMemo(() => {
    const active = filtered.filter((s) => !s.is_voided)
    return {
      count: active.length,
      profit: active.reduce((a, s) => a + s.profit, 0),
      cash: active.filter((s) => s.payment_type === 'cash').reduce((a, s) => a + s.sale_price, 0),
      udhaar: active.filter((s) => s.payment_type === 'udhaar').reduce((a, s) => a + s.sale_price, 0),
    }
  }, [filtered])

  const handleExport = () => {
    const rows = filtered.map((s) => ({
      Date: fmtDate(s.sold_at),
      Time: fmtTime(s.sold_at),
      Brand: s.laptop?.brand ?? '',
      Model: s.laptop?.model ?? '',
      'Serial Number': s.laptop?.imei ?? '',
      'Purchase Price': purchasePriceOf(s),
      'Sale Price': s.sale_price,
      Profit: s.profit,
      Payment: s.payment_type,
      Customer: s.customer_name ?? '',
      Phone: s.customer_phone ?? '',
      'Bank Ref': s.bank_reference ?? '',
      Notes: s.notes ?? '',
      Status: s.is_voided ? 'Voided' : 'Active',
    }))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 13 }, { wch: 14 }, { wch: 20 }, { wch: 8 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Sales')
    XLSX.writeFile(wb, `shopboss-sales-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  if (loading) return <div style={{ color: 'var(--text-3)', fontSize: 14 }}>Loading sales…</div>

  return (
    <>
      {voidSale && <VoidModal sale={voidSale} onClose={() => setVoidSale(null)} onVoided={() => { setVoidSale(null); load() }} />}

      <div style={{ maxWidth: 1100, marginInline: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 32, marginBottom: 2 }}>Sales</h1>
            <p style={{ color: 'var(--text-3)', fontSize: 13 }}>{sales.length} total sales recorded</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleExport} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', color: 'var(--text-2)', fontSize: 13, cursor: 'pointer' }}>
              <Download size={14} /> Export to Excel
            </button>
            <Link href="/sales/new" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '9px 16px', color: 'var(--bg)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              <Plus size={14} /> Record Sale
            </Link>
          </div>
        </div>

        {/* Time-based summary cards (live) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 14 }}>
          <Card label="Today's revenue" value={fmtRs(cards.todayRev)} />
          <Card label="Today's profit" value={fmtRs(cards.todayProfit)} accent={cards.todayProfit >= 0 ? 'var(--success)' : 'var(--danger)'} />
          <Card label="This month's revenue" value={fmtRs(cards.monthRev)} />
          <Card label="This month's profit" value={fmtRs(cards.monthProfit)} accent={cards.monthProfit >= 0 ? 'var(--success)' : 'var(--danger)'} />
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search serial no., model, customer…" style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px 8px 30px', color: 'var(--text)', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <select value={filterPayment} onChange={(e) => setFilterPayment(e.target.value)} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px', color: 'var(--text-2)', fontSize: 12, cursor: 'pointer' }}>
            <option value="">All payments</option>
            <option value="cash">Cash</option>
            <option value="udhaar">Udhaar</option>
            <option value="bank_transfer">Bank transfer</option>
          </select>
          <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} title="From date" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px', color: 'var(--text-2)', fontSize: 12, cursor: 'pointer' }} />
          <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} title="To date" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 10px', color: 'var(--text-2)', fontSize: 12, cursor: 'pointer' }} />
          {(search || filterPayment || filterDateFrom || filterDateTo) && (
            <button onClick={() => { setSearch(''); setFilterPayment(''); setFilterDateFrom(''); setFilterDateTo('') }} style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 12, cursor: 'pointer' }}>Clear</button>
          )}
        </div>

        {/* Filtered totals */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
          <Card label="Total sales" value={String(totals.count)} />
          <Card label="Total profit" value={fmtRs(totals.profit)} accent={totals.profit >= 0 ? 'var(--success)' : 'var(--danger)'} />
          <Card label="Total cash" value={fmtRs(totals.cash)} />
          <Card label="Total udhaar given" value={fmtRs(totals.udhaar)} accent="var(--warning)" />
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '64px 48px', textAlign: 'center' }}>
            {sales.length === 0 ? (
              <>
                <div style={{ width: 56, height: 56, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                  <Plus size={24} style={{ color: 'var(--text-3)' }} />
                </div>
                <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: 15, marginBottom: 6 }}>No sales recorded yet.</p>
                <p style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 24 }}>Record your first sale to start tracking revenue.</p>
                <Link
                  href="/sales/new"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--accent)', color: 'var(--bg)', borderRadius: 8, padding: '10px 20px', fontWeight: 600, textDecoration: 'none', fontSize: 13 }}
                >
                  <Plus size={14} /> Record Sale
                </Link>
              </>
            ) : (
              <p style={{ color: 'var(--text-3)', fontSize: 14 }}>No sales match your filters.</p>
            )}
          </div>
        ) : (
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 880 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['', 'Date', 'Laptop', 'Sale Price', 'Purchase', 'Profit', 'Payment', 'Customer', ''].map((h, i) => (
                    <th key={i} style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-3)', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const open = expanded.has(s.id)
                  const purchase = purchasePriceOf(s)
                  const margin = s.sale_price > 0 ? (s.profit / s.sale_price) * 100 : 0
                  return (
                    <Fragment key={s.id}>
                      <tr
                        onClick={() => toggle(s.id)}
                        style={{ borderBottom: open ? 'none' : '1px solid var(--border)', opacity: s.is_voided ? 0.5 : 1, cursor: 'pointer' }}
                      >
                        <td style={{ padding: '10px 14px', color: 'var(--text-3)' }}>
                          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <p style={{ color: 'var(--text)', fontSize: 12, fontWeight: 500 }}>{fmtDate(s.sold_at)}</p>
                          <p style={{ color: 'var(--text-3)', fontSize: 11 }}>{fmtTime(s.sold_at)}</p>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <p style={{ color: 'var(--text)', fontSize: 13, fontWeight: 600 }}>{s.laptop?.brand} {s.laptop?.model}</p>
                          <p style={{ color: 'var(--text-3)', fontSize: 11, fontFamily: 'monospace' }}>…{s.laptop?.imei?.slice(-6)}</p>
                        </td>
                        <td style={{ padding: '10px 14px', color: 'var(--text)', fontSize: 13, fontWeight: 600 }}>{fmtRs(s.sale_price)}</td>
                        <td style={{ padding: '10px 14px', color: 'var(--text-2)', fontSize: 13 }}>{fmtRs(purchase)}</td>
                        <td style={{ padding: '10px 14px', color: s.profit >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: 13, fontWeight: 600 }}>{fmtRs(s.profit)}</td>
                        <td style={{ padding: '10px 14px' }}>{payBadge(s.payment_type)}</td>
                        <td style={{ padding: '10px 14px', color: 'var(--text-2)', fontSize: 13 }}>
                          {s.customer_name || '—'}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          {s.is_voided && <span style={{ background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>Voided</span>}
                        </td>
                      </tr>
                      {open && (
                        <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-3)' }}>
                          <td colSpan={9} style={{ padding: '16px 18px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
                              {[
                                ['Serial Number', s.laptop?.imei ?? '—'],
                                ['Purchase price', fmtRs(purchase)],
                                ['Sale price', fmtRs(s.sale_price)],
                                ['Profit', `${fmtRs(s.profit)} (${margin >= 0 ? '+' : ''}${margin.toFixed(1)}%)`],
                                ['Payment', s.payment_type.replace(/_/g, ' ')],
                                ['Sold at', `${fmtDate(s.sold_at)} ${fmtTime(s.sold_at)}`],
                                ...(s.customer_name ? [['Customer', s.customer_name] as [string, string]] : []),
                                ...(s.customer_phone ? [['Phone', s.customer_phone] as [string, string]] : []),
                                ...(s.bank_reference ? [['Bank reference', s.bank_reference] as [string, string]] : []),
                                ...(s.worker?.name ? [['Recorded by', s.worker.name] as [string, string]] : []),
                              ].map(([label, value]) => (
                                <div key={label}>
                                  <p style={{ color: 'var(--text-3)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 }}>{label}</p>
                                  <p style={{ color: 'var(--text)', fontSize: 13 }}>{value}</p>
                                </div>
                              ))}
                            </div>
                            {s.notes && (
                              <div style={{ marginTop: 14 }}>
                                <p style={{ color: 'var(--text-3)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 }}>Notes</p>
                                <p style={{ color: 'var(--text-2)', fontSize: 13 }}>{s.notes}</p>
                              </div>
                            )}
                            {!s.is_voided && (
                              <div style={{ marginTop: 16 }}>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setVoidSale(s) }}
                                  style={{ background: 'var(--bg-2)', border: '1px solid var(--danger-border)', borderRadius: 6, padding: '6px 12px', color: 'var(--danger)', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
                                >
                                  Void this sale
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
            <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-3)', fontSize: 12 }}>Showing {filtered.length} of {sales.length} sales</span>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
