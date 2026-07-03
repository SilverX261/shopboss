'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useShop } from '@/hooks/useShop'
import { useDashboard } from '@/components/layout/DashboardContext'
import type { Supplier, SupplierTransaction, SupplierTransactionType, WarrantyResolution } from '@/lib/types'
import { X, ChevronDown, ChevronRight, Plus, Truck, Wallet, ShieldAlert, Package } from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LaptopRow {
  id: string
  brand: string
  model: string
  condition: string | null
  purchase_price: number
  purchase_date: string | null
  status: string
  supplier_id: string | null
  warranty_status: string
  warranty_sent_at: string | null
  warranty_resolved_at: string | null
  warranty_resolution: string | null
  specs: Record<string, unknown> | null
}

interface CreditRow {
  supplier_name: string
  amount_owed: number
  amount_paid: number
}

type Tab = 'stock' | 'warranty' | 'wallet'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtRs = (n: number) => `Rs ${Math.round(n).toLocaleString('en-PK')}`
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const daysSince = (s: string | null) => (s ? Math.floor((Date.now() - new Date(s).getTime()) / 86400000) : 0)

const TXN_LABELS: Record<SupplierTransactionType, string> = {
  advance_sent: 'Advance sent',
  advance_used: 'Advance used',
  warranty_credit: 'Warranty credit',
  refund_received: 'Refund received',
  manual_adjustment: 'Manual adjustment',
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg-3)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 14,
  outline: 'none', boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block', color: 'var(--text-2)', fontSize: 11, fontWeight: 600, marginBottom: 5,
}

const thStyle: React.CSSProperties = {
  padding: '8px 10px', textAlign: 'left', color: 'var(--text-3)', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = { padding: '8px 10px', color: 'var(--text)', fontSize: 13 }

function laptopStatus(l: LaptopRow): string {
  if (l.warranty_status === 'sent') return 'warranty_sent'
  if (l.warranty_status === 'resolved') return 'warranty_resolved'
  return l.status
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  in_stock: { label: 'In stock', color: 'var(--success)' },
  sold: { label: 'Sold', color: 'var(--info)' },
  traded_in: { label: 'Traded in', color: 'var(--text-3)' },
  warranty_sent: { label: 'Warranty (sent)', color: 'var(--warning)' },
  warranty_resolved: { label: 'Warranty resolved', color: 'var(--text-2)' },
}

// ─── Modal shell ──────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }} onClick={onClose}>
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px', width: '100%', maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 16 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── Warranty resolution modal ────────────────────────────────────────────────

function ResolveModal({
  laptop, onClose, onResolve,
}: {
  laptop: LaptopRow
  onClose: () => void
  onResolve: (resolution: WarrantyResolution, amount: number) => Promise<void>
}) {
  const [choice, setChoice] = useState<WarrantyResolution>('replacement')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    let amt = 0
    if (choice !== 'replacement') {
      amt = parseFloat(amount)
      if (isNaN(amt) || amt <= 0) { toast.error('Enter a valid amount'); return }
    }
    setSaving(true)
    await onResolve(choice, amt)
    setSaving(false)
    onClose()
  }

  const options: { value: WarrantyResolution; label: string; desc: string }[] = [
    { value: 'replacement', label: 'Replacement received', desc: 'Adds a new laptop with the same model/specs to inventory, linked to this supplier.' },
    { value: 'refund', label: 'Refund received', desc: 'Records the refunded amount and adds it to the supplier advance balance.' },
    { value: 'credit', label: 'Credit kept', desc: 'Supplier keeps the amount as credit — added to the advance balance.' },
  ]

  return (
    <Modal title={`Resolve warranty — ${laptop.brand} ${laptop.model}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setChoice(o.value)}
            style={{
              textAlign: 'left', borderRadius: 8, padding: '10px 12px', cursor: 'pointer',
              background: choice === o.value ? 'var(--bg-4)' : 'var(--bg-3)',
              border: `1px solid ${choice === o.value ? 'var(--accent)' : 'var(--border)'}`,
            }}
          >
            <p style={{ color: 'var(--text)', fontSize: 13, fontWeight: 600 }}>{o.label}</p>
            <p style={{ color: 'var(--text-3)', fontSize: 11, marginTop: 2 }}>{o.desc}</p>
          </button>
        ))}
      </div>
      {choice !== 'replacement' && (
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>{choice === 'refund' ? 'Refund amount (Rs) *' : 'Credit amount (Rs) *'}</label>
          <input type="number" min={0} autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50000" style={inputStyle} />
        </div>
      )}
      <button
        onClick={submit}
        disabled={saving}
        style={{ width: '100%', background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '11px', color: 'var(--bg)', fontWeight: 600, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
      >
        {saving ? 'Saving…' : 'Confirm Resolution'}
      </button>
    </Modal>
  )
}

// ─── Advance modal (send / use) ───────────────────────────────────────────────

function AdvanceModal({
  mode, supplier, onClose, onConfirm,
}: {
  mode: 'send' | 'use'
  supplier: Supplier
  onClose: () => void
  onConfirm: (amount: number, note: string) => Promise<void>
}) {
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    const n = parseFloat(amount)
    if (isNaN(n) || n <= 0) { toast.error('Enter a valid amount'); return }
    setSaving(true)
    await onConfirm(n, note.trim())
    setSaving(false)
    onClose()
  }

  return (
    <Modal title={mode === 'send' ? `Send advance to ${supplier.name}` : `Use advance — ${supplier.name}`} onClose={onClose}>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Amount (Rs) *</label>
        <input type="number" min={0} autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100000" style={inputStyle} onKeyDown={(e) => { if (e.key === 'Enter') submit() }} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Note</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={mode === 'send' ? 'e.g. Bank transfer for next batch' : 'e.g. Used against 5 laptops'} style={inputStyle} />
      </div>
      <button
        onClick={submit}
        disabled={saving}
        style={{ width: '100%', background: mode === 'send' ? 'var(--success)' : 'var(--warning)', border: 'none', borderRadius: 8, padding: '11px', color: '#fff', fontWeight: 600, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
      >
        {saving ? 'Saving…' : mode === 'send' ? 'Send Advance' : 'Use Advance'}
      </button>
    </Modal>
  )
}

// ─── Supplier detail tabs ─────────────────────────────────────────────────────

function SupplierDetail({
  supplier, laptops, transactions, isOwner, onResolveClick, onAdvance,
}: {
  supplier: Supplier
  laptops: LaptopRow[]
  transactions: SupplierTransaction[]
  isOwner: boolean
  onResolveClick: (laptop: LaptopRow) => void
  onAdvance: (mode: 'send' | 'use') => void
}) {
  const [tab, setTab] = useState<Tab>('stock')
  const underWarranty = laptops.filter((l) => l.warranty_status === 'sent')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'stock', label: 'Stock History' },
    { id: 'warranty', label: `Warranty${underWarranty.length ? ` (${underWarranty.length})` : ''}` },
    { id: 'wallet', label: 'Wallet / Advance' },
  ]

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: tab === t.id ? 'var(--bg-4)' : 'transparent',
              border: `1px solid ${tab === t.id ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 7, padding: '7px 14px', cursor: 'pointer',
              color: tab === t.id ? 'var(--text)' : 'var(--text-3)', fontSize: 12, fontWeight: 600,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'stock' && (
        laptops.length === 0 ? (
          <p style={{ color: 'var(--text-3)', fontSize: 13 }}>No laptops bought from this supplier yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead>
                <tr>{['Model', 'Condition', 'Purchase Price', 'Purchase Date', 'Status', 'Warranty Resolution'].map((h) => <th key={h} style={thStyle}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {laptops.map((l) => {
                  const st = STATUS_LABELS[laptopStatus(l)] ?? { label: laptopStatus(l), color: 'var(--text-2)' }
                  return (
                    <tr key={l.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ ...tdStyle, fontWeight: 600 }}>{l.brand} {l.model}</td>
                      <td style={{ ...tdStyle, color: 'var(--text-2)', textTransform: 'capitalize' }}>{l.condition ?? '—'}</td>
                      <td style={tdStyle}>{fmtRs(l.purchase_price)}</td>
                      <td style={{ ...tdStyle, color: 'var(--text-2)' }}>{fmtDate(l.purchase_date)}</td>
                      <td style={{ ...tdStyle, color: st.color, fontWeight: 600 }}>{st.label}</td>
                      <td style={{ ...tdStyle, color: 'var(--text-2)', textTransform: 'capitalize' }}>{l.warranty_resolution ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'warranty' && (
        underWarranty.length === 0 ? (
          <p style={{ color: 'var(--text-3)', fontSize: 13 }}>No laptops currently sent for warranty.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
              <thead>
                <tr>{['Model', 'Sent Date', 'Days Outstanding', ''].map((h, i) => <th key={i} style={thStyle}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {underWarranty.map((l) => (
                  <tr key={l.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{l.brand} {l.model}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-2)' }}>{fmtDate(l.warranty_sent_at)}</td>
                    <td style={{ ...tdStyle, color: daysSince(l.warranty_sent_at) > 14 ? 'var(--danger)' : 'var(--warning)', fontWeight: 600 }}>
                      {daysSince(l.warranty_sent_at)} day{daysSince(l.warranty_sent_at) !== 1 ? 's' : ''}
                    </td>
                    <td style={tdStyle}>
                      {isOwner && (
                        <button
                          onClick={() => onResolveClick(l)}
                          style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 6, padding: '6px 12px', color: 'var(--success)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          Mark Resolved
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'wallet' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 18px' }}>
              <p style={{ color: 'var(--text-3)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Advance Balance</p>
              <p style={{ color: supplier.advance_balance >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 800, fontSize: 22 }}>
                {fmtRs(supplier.advance_balance)}
              </p>
              <p style={{ color: 'var(--text-3)', fontSize: 11 }}>
                {supplier.advance_balance > 0 ? 'They owe you' : supplier.advance_balance < 0 ? 'You owe them' : 'Settled'}
              </p>
            </div>
            {isOwner && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => onAdvance('send')} style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 7, padding: '9px 14px', color: 'var(--success)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Send Advance
                </button>
                <button onClick={() => onAdvance('use')} style={{ background: 'var(--warning-bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '9px 14px', color: 'var(--warning)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Use Advance
                </button>
              </div>
            )}
          </div>

          {transactions.length === 0 ? (
            <p style={{ color: 'var(--text-3)', fontSize: 13 }}>No transactions yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
                <thead>
                  <tr>{['Date', 'Type', 'Amount', 'Note'].map((h) => <th key={h} style={thStyle}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ ...tdStyle, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{fmtDate(t.created_at)}</td>
                      <td style={tdStyle}>{TXN_LABELS[t.type] ?? t.type}</td>
                      <td style={{ ...tdStyle, color: t.amount >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                        {t.amount >= 0 ? '+' : '−'}{fmtRs(Math.abs(t.amount))}
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--text-3)', fontSize: 12 }}>{t.note ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SuppliersPage() {
  const { shop } = useShop()
  const { isStaff } = useDashboard()
  const isOwner = !isStaff

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [laptops, setLaptops] = useState<LaptopRow[]>([])
  const [credits, setCredits] = useState<CreditRow[]>([])
  const [transactions, setTransactions] = useState<SupplierTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const [showAddForm, setShowAddForm] = useState(false)
  const [newSup, setNewSup] = useState({ name: '', phone: '', city: '', notes: '' })
  const [savingSupplier, setSavingSupplier] = useState(false)

  const [resolveTarget, setResolveTarget] = useState<{ laptop: LaptopRow; supplier: Supplier } | null>(null)
  const [advanceTarget, setAdvanceTarget] = useState<{ supplier: Supplier; mode: 'send' | 'use' } | null>(null)

  const load = useCallback(async () => {
    if (!shop) return
    const supabase = createClient()
    const [supRes, lapRes, credRes, txnRes] = await Promise.all([
      supabase.from('suppliers').select('*').eq('shop_id', shop.id).order('name'),
      supabase.from('laptops').select('id, brand, model, condition, purchase_price, purchase_date, status, supplier_id, warranty_status, warranty_sent_at, warranty_resolved_at, warranty_resolution, specs').eq('shop_id', shop.id).not('supplier_id', 'is', null),
      supabase.from('supplier_credits').select('supplier_name, amount_owed, amount_paid').eq('shop_id', shop.id),
      supabase.from('supplier_transactions').select('*').eq('shop_id', shop.id).order('created_at', { ascending: false }),
    ])
    setSuppliers((supRes.data as Supplier[]) ?? [])
    setLaptops((lapRes.data as LaptopRow[]) ?? [])
    setCredits((credRes.data as CreditRow[]) ?? [])
    setTransactions((txnRes.data as SupplierTransaction[]) ?? [])
    setLoading(false)
  }, [shop])

  useEffect(() => { load() }, [load])

  const laptopsBySupplier = useMemo(() => {
    const map = new Map<string, LaptopRow[]>()
    for (const l of laptops) {
      if (!l.supplier_id) continue
      if (!map.has(l.supplier_id)) map.set(l.supplier_id, [])
      map.get(l.supplier_id)!.push(l)
    }
    return map
  }, [laptops])

  const owedBySupplierName = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of credits) {
      const remaining = (c.amount_owed ?? 0) - (c.amount_paid ?? 0)
      if (remaining <= 0) continue
      map.set(c.supplier_name, (map.get(c.supplier_name) ?? 0) + remaining)
    }
    return map
  }, [credits])

  const txnsBySupplier = useMemo(() => {
    const map = new Map<string, SupplierTransaction[]>()
    for (const t of transactions) {
      if (!map.has(t.supplier_id)) map.set(t.supplier_id, [])
      map.get(t.supplier_id)!.push(t)
    }
    return map
  }, [transactions])

  const addSupplier = async () => {
    if (!shop) return
    const name = newSup.name.trim()
    if (!name) { toast.error('Supplier name is required'); return }
    setSavingSupplier(true)
    const supabase = createClient()
    const { error } = await supabase.from('suppliers').insert({
      shop_id: shop.id,
      name,
      phone: newSup.phone.trim() || null,
      city: newSup.city.trim() || null,
      notes: newSup.notes.trim() || null,
    })
    setSavingSupplier(false)
    if (error) {
      if (error.code === '23505') { toast.error('A supplier with this name already exists.'); return }
      toast.error('Could not add supplier. Please try again.')
      return
    }
    toast.success(`Supplier "${name}" added`)
    setNewSup({ name: '', phone: '', city: '', notes: '' })
    setShowAddForm(false)
    load()
  }

  // Logs a wallet transaction and moves the advance balance by `delta`
  const recordTransaction = async (supplier: Supplier, type: SupplierTransactionType, delta: number, note: string | null) => {
    if (!shop) return false
    const supabase = createClient()
    const { error: txnErr } = await supabase.from('supplier_transactions').insert({
      shop_id: shop.id, supplier_id: supplier.id, type, amount: delta, note,
    })
    if (txnErr) { toast.error('Could not record transaction.'); return false }
    const { error: balErr } = await supabase
      .from('suppliers')
      .update({ advance_balance: supplier.advance_balance + delta, updated_at: new Date().toISOString() })
      .eq('id', supplier.id)
    if (balErr) { toast.error('Transaction saved but balance update failed.'); return false }
    return true
  }

  const resolveWarranty = async (laptop: LaptopRow, supplier: Supplier, resolution: WarrantyResolution, amount: number) => {
    if (!shop) return
    const supabase = createClient()

    const { error: lapErr } = await supabase
      .from('laptops')
      .update({ warranty_status: 'resolved', warranty_resolved_at: new Date().toISOString(), warranty_resolution: resolution })
      .eq('id', laptop.id)
    if (lapErr) { toast.error('Could not update laptop.'); return }

    if (resolution === 'replacement') {
      const { error: repErr } = await supabase.from('laptops').insert({
        shop_id: shop.id,
        brand: laptop.brand,
        model: laptop.model,
        specs: laptop.specs ?? {},
        condition: laptop.condition ?? 'used',
        purchase_price: laptop.purchase_price,
        asking_price: 0,
        purchase_date: new Date().toISOString().slice(0, 10),
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        status: 'in_stock',
        notes: `Warranty replacement for ${laptop.brand} ${laptop.model}`,
      })
      if (repErr) { toast.error('Warranty resolved, but replacement laptop could not be added.') }
      else toast.success('Replacement added to inventory')
    } else if (resolution === 'refund') {
      const ok = await recordTransaction(supplier, 'refund_received', amount, `Refund for ${laptop.brand} ${laptop.model}`)
      if (ok) toast.success(`Refund of ${fmtRs(amount)} added to advance balance`)
    } else {
      const ok = await recordTransaction(supplier, 'warranty_credit', amount, `Warranty credit for ${laptop.brand} ${laptop.model}`)
      if (ok) toast.success(`Credit of ${fmtRs(amount)} added to advance balance`)
    }
    load()
  }

  const handleAdvance = async (supplier: Supplier, mode: 'send' | 'use', amount: number, note: string) => {
    const delta = mode === 'send' ? amount : -amount
    const type: SupplierTransactionType = mode === 'send' ? 'advance_sent' : 'advance_used'
    const ok = await recordTransaction(supplier, type, delta, note || null)
    if (ok) toast.success(mode === 'send' ? `Advance of ${fmtRs(amount)} sent` : `Advance of ${fmtRs(amount)} used`)
    load()
  }

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  if (loading) return <div style={{ color: 'var(--text-3)', fontSize: 14 }}>Loading suppliers…</div>

  return (
    <div style={{ maxWidth: 980, marginInline: 'auto' }}>
      {resolveTarget && (
        <ResolveModal
          laptop={resolveTarget.laptop}
          onClose={() => setResolveTarget(null)}
          onResolve={(res, amt) => resolveWarranty(resolveTarget.laptop, resolveTarget.supplier, res, amt)}
        />
      )}
      {advanceTarget && (
        <AdvanceModal
          mode={advanceTarget.mode}
          supplier={advanceTarget.supplier}
          onClose={() => setAdvanceTarget(null)}
          onConfirm={(amt, note) => handleAdvance(advanceTarget.supplier, advanceTarget.mode, amt, note)}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 32, marginBottom: 2 }}>Suppliers</h1>
          <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Stock history, warranty claims, and advance wallet per supplier</p>
        </div>
        {isOwner && (
          <button
            onClick={() => setShowAddForm((v) => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '10px 16px', color: 'var(--bg)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            <Plus size={15} /> Add Supplier
          </button>
        )}
      </div>

      {/* Add supplier inline form */}
      {isOwner && showAddForm && (
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Name *</label>
              <input value={newSup.name} onChange={(e) => setNewSup((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Hafiz" style={inputStyle} autoFocus />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input value={newSup.phone} onChange={(e) => setNewSup((p) => ({ ...p, phone: e.target.value }))} placeholder="03xx-xxxxxxx" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>City</label>
              <input value={newSup.city} onChange={(e) => setNewSup((p) => ({ ...p, city: e.target.value }))} placeholder="Lahore" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Notes</label>
              <input value={newSup.notes} onChange={(e) => setNewSup((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional notes" style={inputStyle} />
            </div>
          </div>
          <button
            onClick={addSupplier}
            disabled={savingSupplier}
            style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '10px 20px', color: 'var(--bg)', fontSize: 13, fontWeight: 600, cursor: savingSupplier ? 'not-allowed' : 'pointer', opacity: savingSupplier ? 0.7 : 1 }}
          >
            {savingSupplier ? 'Saving…' : 'Save Supplier'}
          </button>
        </div>
      )}

      {suppliers.length === 0 ? (
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '48px', textAlign: 'center' }}>
          <Truck size={28} style={{ color: 'var(--text-3)', marginBottom: 10 }} />
          <p style={{ color: 'var(--text-3)', fontSize: 14 }}>No suppliers yet.{isOwner ? ' Add your first supplier to start tracking stock and warranties.' : ''}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {suppliers.map((s) => {
            const supLaptops = laptopsBySupplier.get(s.id) ?? []
            const underWarranty = supLaptops.filter((l) => l.warranty_status === 'sent')
            const owed = owedBySupplierName.get(s.name) ?? 0
            const open = expanded.has(s.id)

            // Model breakdown, e.g. "HP 840G9 x3, Dell Latitude x2"
            const modelCounts = new Map<string, number>()
            for (const l of supLaptops) {
              const key = `${l.brand} ${l.model}`
              modelCounts.set(key, (modelCounts.get(key) ?? 0) + 1)
            }
            const modelSummary = Array.from(modelCounts.entries()).map(([m, n]) => `${m} x${n}`).join(', ')

            return (
              <div key={s.id} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: 16 }}>{s.name}</p>
                    <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 2 }}>
                      {[s.phone, s.city].filter(Boolean).join(' · ') || 'No contact info'}
                    </p>
                  </div>
                  <button
                    onClick={() => toggle(s.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 12px', color: 'var(--text-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />} View Details
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 20, marginTop: 12, flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ color: 'var(--text-3)', fontSize: 10, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}><Package size={11} /> Laptops Bought</p>
                    <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: 15 }}>{supLaptops.length}</p>
                  </div>
                  <div>
                    <p style={{ color: 'var(--text-3)', fontSize: 10, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}><ShieldAlert size={11} /> Under Warranty</p>
                    <p style={{ color: underWarranty.length > 0 ? 'var(--warning)' : 'var(--text)', fontWeight: 700, fontSize: 15 }}>
                      {underWarranty.length === 0 ? '0' : underWarranty.map((l) => `${l.brand} ${l.model}`).join(', ')}
                    </p>
                  </div>
                  <div>
                    <p style={{ color: 'var(--text-3)', fontSize: 10, textTransform: 'uppercase' }}>You Owe Them</p>
                    <p style={{ color: owed > 0 ? 'var(--danger)' : 'var(--text)', fontWeight: 700, fontSize: 15 }}>{fmtRs(owed)}</p>
                  </div>
                  <div>
                    <p style={{ color: 'var(--text-3)', fontSize: 10, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}><Wallet size={11} /> Advance Balance</p>
                    <p style={{ color: s.advance_balance > 0 ? 'var(--success)' : s.advance_balance < 0 ? 'var(--danger)' : 'var(--text)', fontWeight: 700, fontSize: 15 }}>
                      {fmtRs(s.advance_balance)}
                    </p>
                  </div>
                </div>

                {modelSummary && (
                  <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 8 }}>{modelSummary}</p>
                )}

                {open && (
                  <SupplierDetail
                    supplier={s}
                    laptops={supLaptops}
                    transactions={txnsBySupplier.get(s.id) ?? []}
                    isOwner={isOwner}
                    onResolveClick={(laptop) => setResolveTarget({ laptop, supplier: s })}
                    onAdvance={(mode) => setAdvanceTarget({ supplier: s, mode })}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
