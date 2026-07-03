'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useShop } from '@/hooks/useShop'
import { useDashboard } from '@/components/layout/DashboardContext'
import { canUse } from '@/lib/utils/plan-gates'
import {
  Search, Plus, Upload, Download, Copy, Check, ShoppingCart, X, Pencil, Package,
  ShieldAlert, ChevronDown, ChevronRight, Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Fuse from 'fuse.js'
import type { Laptop } from '@/lib/types'

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type FilterKey = 'all' | 'in_stock' | 'sold' | 'aging'

interface SaleInfo {
  sale_price: number
  profit: number
  sold_at: string
  payment_type: string
}

interface LaptopRow extends Laptop {
  sale?: SaleInfo | null
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const fmtRs = (n: number) => `Rs ${Math.round(n).toLocaleString('en-PK')}`
const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'

// Aging threshold (red zone) — matches the 60+ day colour band
const AGING_DAYS = 60

function specsLine(specs: Record<string, unknown>): string {
  return [specs.processor, specs.ram, specs.storage, specs.screen].filter(Boolean).join(' · ')
}

// Days in stock from the real purchase date (falls back to added_at)
function daysInStock(l: LaptopRow): number {
  const base = l.purchase_date ? new Date(l.purchase_date) : new Date(l.added_at)
  return Math.max(0, Math.floor((Date.now() - base.getTime()) / 86_400_000))
}

// Profit margin %: actual for sold, potential (vs asking) for in-stock
function profitMargin(l: LaptopRow): { pct: number; actual: boolean } | null {
  if (l.sale && l.sale.sale_price > 0) {
    return { pct: (l.sale.profit / l.sale.sale_price) * 100, actual: true }
  }
  if (l.asking_price > 0) {
    return { pct: ((l.asking_price - l.purchase_price) / l.asking_price) * 100, actual: false }
  }
  return null
}

// Row tint based on age (in-stock only): green 0–30, amber 30–60, red 60+
function ageTint(l: LaptopRow): string | undefined {
  if (l.status !== 'in_stock') return undefined
  const d = daysInStock(l)
  if (d >= AGING_DAYS) return 'var(--danger-bg)'
  if (d >= 30) return 'var(--warning-bg)'
  return 'var(--success-bg)'
}

// â”€â”€â”€ IMEI copy cell â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ImeiCell({ imei }: { imei: string | null }) {
  const [copied, setCopied] = useState(false)
  if (!imei) {
    return <span style={{ color: 'var(--text-3)', fontSize: 12, fontFamily: 'monospace' }}>No serial</span>
  }
  const copy = () => {
    navigator.clipboard.writeText(imei)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={copy}
      title="Click to copy serial number"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--text-2)', fontSize: 12, fontFamily: 'monospace', padding: 0,
      }}
    >
      {imei.slice(0, 8)}{imei.length > 8 ? '…' : ''}
      {copied ? <Check size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />}
    </button>
  )
}

// â”€â”€â”€ Stock type badge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function StockBadge({ laptop }: { laptop: LaptopRow }) {
  const isMarket = laptop.stock_type === 'market'
  if (!isMarket) {
    return (
      <span style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', color: 'var(--success)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
        Own
      </span>
    )
  }
  const cut = laptop.asking_price && laptop.source_shop_price ? laptop.asking_price - laptop.source_shop_price : null
  return (
    <div>
      <span style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', color: 'var(--warning)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
        Market
      </span>
      {laptop.source_shop_price ? (
        <p style={{ color: 'var(--text-3)', fontSize: 10, marginTop: 3 }}>
          Owes {fmtRs(laptop.source_shop_price)}
          {cut !== null && cut > 0 ? <span style={{ color: 'var(--success)', fontWeight: 600 }}> · +{fmtRs(cut)} cut</span> : null}
        </p>
      ) : null}
    </div>
  )
}

// â”€â”€â”€ Status badge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function StatusBadge({ laptop }: { laptop: LaptopRow }) {
  const outOfStock = laptop.status === 'out_of_stock' || (laptop.is_bulk && (laptop.quantity ?? 0) <= 0)
  const cfg = outOfStock
    ? { bg: 'var(--danger-bg)', border: 'var(--border)', color: 'var(--danger)', label: 'Out of Stock' }
    : laptop.status === 'in_stock'
    ? { bg: 'var(--success-bg)', border: 'var(--success-border)', color: 'var(--success)', label: 'In Stock' }
    : laptop.status === 'sold'
    ? { bg: 'var(--bg-3)', border: 'var(--border)', color: 'var(--text-3)', label: 'Sold' }
    : { bg: 'var(--info-bg)', border: 'var(--border)', color: 'var(--info)', label: 'Traded' }
  return (
    <span style={{
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      color: cfg.color, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  )
}

// â”€â”€â”€ Inline asking-price editor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function AskingPriceCell({
  laptop,
  onSave,
}: {
  laptop: LaptopRow
  onSave: (id: string, price: number) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(laptop.asking_price ?? 0))
  const inputRef = useRef<HTMLInputElement>(null)
  const cancelledRef = useRef(false)

  useEffect(() => {
    if (editing) { inputRef.current?.focus(); inputRef.current?.select() }
  }, [editing])

  const commit = async () => {
    if (cancelledRef.current) { cancelledRef.current = false; return }
    const n = parseFloat(val)
    if (isNaN(n) || n < 0) {
      toast.error('Enter a valid price.')
      setVal(String(laptop.asking_price ?? 0))
      setEditing(false)
      return
    }
    if (n !== (laptop.asking_price ?? 0)) await onSave(laptop.id, n)
    setEditing(false)
  }

  const cancel = () => {
    cancelledRef.current = true
    setVal(String(laptop.asking_price ?? 0))
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min={0}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') cancel()
        }}
        onBlur={commit}
        style={{
          width: 100, background: 'var(--bg-3)', border: '1px solid var(--accent)',
          borderRadius: 6, padding: '4px 8px', color: 'var(--text)', fontSize: 13,
          outline: 'none', fontFamily: 'inherit',
        }}
      />
    )
  }

  const canEdit = laptop.status === 'in_stock'
  return (
    <button
      onClick={() => canEdit && setEditing(true)}
      title={canEdit ? 'Click to edit asking price (Enter to save, Esc to cancel)' : undefined}
      style={{
        background: 'none', border: 'none', padding: 0,
        color: laptop.asking_price > 0 ? 'var(--text)' : 'var(--text-3)',
        fontSize: 13, fontWeight: 600,
        cursor: canEdit ? 'text' : 'default',
        textDecoration: canEdit ? 'underline dotted var(--border-2)' : 'none',
      }}
    >
      {laptop.asking_price > 0 ? fmtRs(laptop.asking_price) : (canEdit ? 'Set price' : '—')}
    </button>
  )
}

// â”€â”€â”€ Summary stat â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px' }}>
      <p style={{ color: 'var(--text-3)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>{label}</p>
      <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: 20 }}>{value}</p>
      {hint && <p style={{ color: 'var(--text-3)', fontSize: 11, marginTop: 2 }}>{hint}</p>}
    </div>
  )
}

// â”€â”€â”€ Sale history modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function HistoryModal({ laptop, onClose }: { laptop: LaptopRow; onClose: () => void }) {
  const s = laptop.sale
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14, padding: '28px 24px', width: '100%', maxWidth: 400 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 17 }}>Sale record</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ marginBottom: 12 }}>
          <p style={{ color: 'var(--text)', fontWeight: 600 }}>{laptop.brand} {laptop.model}</p>
          <p style={{ color: 'var(--text-3)', fontSize: 12, fontFamily: 'monospace' }}>S/N: {laptop.imei ?? 'No serial'}</p>
        </div>
        {s ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Purchase price', value: fmtRs(laptop.purchase_price) },
              { label: 'Sale price', value: fmtRs(s.sale_price) },
              { label: 'Profit', value: fmtRs(s.profit), color: 'var(--success)' },
              { label: 'Payment', value: s.payment_type.replace(/_/g, ' ') },
              { label: 'Sold at', value: new Date(s.sold_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-2)', fontSize: 13 }}>{label}</span>
                <span style={{ color: color ?? 'var(--text)', fontSize: 13, fontWeight: 600 }}>{value}</span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--text-3)', fontSize: 13 }}>No sale record found.</p>
        )}
      </div>
    </div>
  )
}

// â”€â”€â”€ Main page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// ─── Edit modal ──────────────────────────────────────────────────────────────

function EditModal({
  laptop, onClose, onSave,
}: {
  laptop: LaptopRow
  onClose: () => void
  onSave: (id: string, updates: Record<string, unknown>) => Promise<void>
}) {
  const specs = (laptop.specs ?? {}) as Record<string, unknown>
  const lr = laptop as unknown as Record<string, unknown>
  const [brand, setBrand] = useState(laptop.brand ?? '')
  const [model, setModel] = useState(laptop.model ?? '')
  const [processor, setProcessor] = useState(String(specs.processor ?? ''))
  const [ram, setRam] = useState(String(specs.ram ?? ''))
  const [storage, setStorage] = useState(String(specs.storage ?? ''))
  const [screen, setScreen] = useState(String(specs.screen ?? ''))
  const [condition, setCondition] = useState(String(lr.condition ?? ''))
  const [purchasePrice, setPurchasePrice] = useState(String(laptop.purchase_price ?? ''))
  const [askingPrice, setAskingPrice] = useState(String(laptop.asking_price ?? ''))
  const [supplier, setSupplier] = useState(String(lr.supplier_name ?? ''))
  const [notes, setNotes] = useState(String(lr.notes ?? ''))
  const [saving, setSaving] = useState(false)

  const mInput: React.CSSProperties = {
    width: '100%', background: 'var(--bg-3)', border: '1px solid var(--border)',
    borderRadius: 7, padding: '8px 10px', color: 'var(--text)', fontSize: 13,
    outline: 'none', boxSizing: 'border-box',
  }
  const mLabel: React.CSSProperties = {
    display: 'block', color: 'var(--text-2)', fontSize: 11, fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4,
  }

  const handleSave = async () => {
    const pp = parseFloat(purchasePrice)
    const ap = parseFloat(askingPrice)
    if (!brand.trim()) { toast.error('Brand is required'); return }
    if (!model.trim()) { toast.error('Model is required'); return }
    if (isNaN(pp) || pp < 0) { toast.error('Enter a valid purchase price'); return }
    setSaving(true)
    await onSave(laptop.id, {
      brand: brand.trim(),
      model: model.trim(),
      specs: { ...specs, processor: processor.trim(), ram: ram.trim(), storage: storage.trim(), screen: screen.trim() },
      condition: condition.trim() || null,
      purchase_price: pp,
      asking_price: isNaN(ap) || ap < 0 ? laptop.asking_price : ap,
      supplier_name: supplier.trim() || null,
      notes: notes.trim() || null,
    })
    setSaving(false)
    onClose()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 17 }}>Edit laptop</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={mLabel}>Brand *</label><input value={brand} onChange={(e) => setBrand(e.target.value)} style={mInput} placeholder="Dell, HP…" /></div>
            <div><label style={mLabel}>Model *</label><input value={model} onChange={(e) => setModel(e.target.value)} style={mInput} placeholder="Latitude 5420" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={mLabel}>Processor</label><input value={processor} onChange={(e) => setProcessor(e.target.value)} style={mInput} placeholder="Core i5 10th Gen" /></div>
            <div><label style={mLabel}>RAM</label><input value={ram} onChange={(e) => setRam(e.target.value)} style={mInput} placeholder="8GB" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={mLabel}>Storage</label><input value={storage} onChange={(e) => setStorage(e.target.value)} style={mInput} placeholder="256GB SSD" /></div>
            <div><label style={mLabel}>Screen size</label><input value={screen} onChange={(e) => setScreen(e.target.value)} style={mInput} placeholder='14"' /></div>
          </div>
          <div><label style={mLabel}>Condition</label><input value={condition} onChange={(e) => setCondition(e.target.value)} style={mInput} placeholder="Good, Fair, Poor…" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={mLabel}>Purchase price (Rs) *</label><input type="number" min={0} value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} style={mInput} /></div>
            <div><label style={mLabel}>Asking price (Rs)</label><input type="number" min={0} value={askingPrice} onChange={(e) => setAskingPrice(e.target.value)} style={mInput} /></div>
          </div>
          <div><label style={mLabel}>Supplier</label><input value={supplier} onChange={(e) => setSupplier(e.target.value)} style={mInput} placeholder="Supplier name" /></div>
          <div><label style={mLabel}>Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ ...mInput, resize: 'vertical', lineHeight: 1.5 }} placeholder="Any notes…" /></div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={saving} style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 18px', color: 'var(--text-2)', fontSize: 13, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '9px 22px', color: 'var(--bg)', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function InventoryPage() {
  const { shop } = useShop()
  const { isStaff } = useDashboard()
  const [laptops, setLaptops] = useState<LaptopRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [historyLaptop, setHistoryLaptop] = useState<LaptopRow | null>(null)
  const [editLaptop, setEditLaptop] = useState<LaptopRow | null>(null)
  const [warrantyOpen, setWarrantyOpen] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleteAllOpen, setDeleteAllOpen] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)

  const load = useCallback(async () => {
    if (!shop) return
    const supabase = createClient()
    const { data } = await supabase
      .from('laptops')
      .select(`*, sales ( sale_price, profit, sold_at, payment_type ), stock_type, source_shop_name, source_shop_price`)
      .eq('shop_id', shop.id)
      .order('added_at', { ascending: false })
    const rows = (data ?? []).map((l: Record<string, unknown>) => ({
      ...l,
      sale: Array.isArray(l.sales) ? ((l.sales[0] as SaleInfo) ?? null) : null,
    })) as LaptopRow[]
    setLaptops(rows)
    setLoading(false)
  }, [shop])

  useEffect(() => { load() }, [load])

  const handleAskingSave = async (id: string, price: number) => {
    const supabase = createClient()
    const { error } = await supabase.from('laptops').update({ asking_price: price }).eq('id', id)
    if (error) { toast.error('Something went wrong. Please try again.'); return }
    toast.success('Asking price updated')
    setLaptops((prev) => prev.map((l) => l.id === id ? { ...l, asking_price: price } : l))
  }

  const handleEditSave = async (id: string, updates: Record<string, unknown>) => {
    const supabase = createClient()
    const { error } = await supabase
      .from('laptops')
      .update({
        brand: updates.brand,
        model: updates.model,
        specs: updates.specs,
        condition: updates.condition,
        purchase_price: updates.purchase_price,
        asking_price: updates.asking_price,
        supplier_name: updates.supplier_name,
        notes: updates.notes,
      })
      .eq('id', id)
    if (error) { toast.error('Failed to save changes. Please try again.'); return }
    toast.success('Laptop updated')
    setLaptops((prev) => prev.map((l) => l.id === id ? { ...l, ...(updates as Partial<LaptopRow>) } : l))
  }

  const handleExport = () => { window.location.href = '/api/inventory/export' }

  // Delete a single laptop (owner only, in_stock / out_of_stock only)
  const handleDelete = async (id: string) => {
    const supabase = createClient()
    const { error } = await supabase.from('laptops').delete().eq('id', id)
    if (error) {
      toast.error('Could not delete — laptops with recorded sales are kept for history.')
      setDeleteConfirmId(null)
      return
    }
    toast.success('Laptop deleted')
    setLaptops((prev) => prev.filter((l) => l.id !== id))
    setDeleteConfirmId(null)
  }

  // Delete all in_stock / out_of_stock laptops. Laptops referenced by sales
  // (partially sold bulk stock) are kept — the FK protects sales history.
  const handleDeleteAll = async () => {
    if (!shop) return
    setDeletingAll(true)
    const supabase = createClient()
    const { data: refs } = await supabase.from('sales').select('laptop_id').eq('shop_id', shop.id)
    const referenced = Array.from(new Set((refs ?? []).map((r) => r.laptop_id).filter(Boolean)))
    let query = supabase
      .from('laptops')
      .delete()
      .eq('shop_id', shop.id)
      .in('status', ['in_stock', 'out_of_stock'])
    if (referenced.length) query = query.not('id', 'in', `(${referenced.join(',')})`)
    const { error } = await query
    setDeletingAll(false)
    setDeleteAllOpen(false)
    if (error) { toast.error('Could not delete inventory. Please try again.'); return }
    const kept = laptops.filter(
      (l) => (l.status === 'in_stock' || l.status === 'out_of_stock') && referenced.includes(l.id)
    ).length
    toast.success(kept > 0 ? `Inventory cleared (${kept} kept — they have sales history)` : 'Inventory cleared')
    load()
  }

  const deletableCount = laptops.filter((l) => l.status === 'in_stock' || l.status === 'out_of_stock').length

  // Send an in-stock laptop to the supplier for warranty
  const handleMarkSent = async (l: LaptopRow) => {
    const supabase = createClient()
    const { error } = await supabase
      .from('laptops')
      .update({ warranty_status: 'sent', warranty_sent_at: new Date().toISOString() })
      .eq('id', l.id)
    if (error) { toast.error('Could not mark as sent for warranty.'); return }
    toast.success(`${l.brand} ${l.model} marked as sent for warranty`)
    load()
  }

  const underWarranty = useMemo(
    () => laptops.filter((l) => l.warranty_status === 'sent'),
    [laptops]
  )

  // Fuzzy search index
  const fuse = useMemo(
    () => new Fuse(laptops, {
      keys: ['imei', 'brand', 'model', 'specs.processor', 'specs.ram', 'specs.storage'],
      threshold: 0.35,
      ignoreLocation: true,
    }),
    [laptops]
  )

  // Filter → search
  const filtered = useMemo(() => {
    let base = laptops.filter((l) => {
      if (filter === 'in_stock') return l.status === 'in_stock'
      if (filter === 'sold') return l.status === 'sold'
      if (filter === 'aging') return l.status === 'in_stock' && daysInStock(l) >= AGING_DAYS
      return true
    })
    if (search.trim()) {
      const ids = new Set(fuse.search(search.trim()).map((r) => r.item.id))
      base = base.filter((l) => ids.has(l.id))
    }
    return base
  }, [laptops, filter, search, fuse])

  // â”€â”€ Summary + valuation figures (in-stock only) â”€â”€
  const stock = useMemo(() => {
    const inStock = laptops.filter((l) => l.status === 'in_stock')
    const stockValue = inStock.reduce((s, l) => s + (l.purchase_price || 0), 0)
    const potentialRevenue = inStock.reduce((s, l) => s + (l.asking_price || 0), 0)
    const totalDays = inStock.reduce((s, l) => s + daysInStock(l), 0)
    return {
      count: inStock.length,
      stockValue,
      potentialRevenue,
      potentialProfit: potentialRevenue - stockValue,
      avgDays: inStock.length ? Math.round(totalDays / inStock.length) : 0,
    }
  }, [laptops])

  const canImport = shop && canUse(shop.plan, 'excelImport')

  if (loading) return <div style={{ color: 'var(--text-3)', fontSize: 14 }}>Loading inventory…</div>

  return (
    <>
      {historyLaptop && <HistoryModal laptop={historyLaptop} onClose={() => setHistoryLaptop(null)} />}
      {editLaptop && <EditModal laptop={editLaptop} onClose={() => setEditLaptop(null)} onSave={handleEditSave} />}
      {deleteAllOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}
          onClick={() => !deletingAll && setDeleteAllOpen(false)}
        >
          <div
            style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14, padding: '28px 24px', width: '100%', maxWidth: 420 }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: 17, marginBottom: 10 }}>Delete all inventory?</p>
            <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.65, marginBottom: 22 }}>
              Delete all {deletableCount} laptop{deletableCount !== 1 ? 's' : ''} in stock? This cannot be undone.
              Sold and traded-in laptops are kept as sales history.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleDeleteAll}
                disabled={deletingAll}
                style={{ flex: 1, background: 'var(--danger)', border: 'none', borderRadius: 8, padding: '11px', color: '#fff', fontWeight: 600, fontSize: 14, cursor: deletingAll ? 'not-allowed' : 'pointer', opacity: deletingAll ? 0.7 : 1 }}
              >
                {deletingAll ? 'Deleting…' : 'Yes, delete all'}
              </button>
              <button
                onClick={() => setDeleteAllOpen(false)}
                disabled={deletingAll}
                style={{ flex: 1, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '11px', color: 'var(--text-2)', fontWeight: 500, fontSize: 14, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1180, marginInline: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 32, marginBottom: 2 }}>Inventory</h1>
            <p style={{ color: 'var(--text-3)', fontSize: 13 }}>
              {stock.count} in stock · {laptops.length} total
            </p>
          </div>

          {!isStaff && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={handleExport}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', color: 'var(--text-2)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
            >
              <Download size={14} /> Export to Excel
            </button>

            {canImport ? (
              <Link
                href="/inventory/import"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', color: 'var(--text-2)', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}
                className="hover:border-[color:var(--border-2)] hover:text-[color:var(--text)]"
              >
                <Upload size={14} /> Excel Import
              </Link>
            ) : (
              <button
                onClick={() => toast('Excel import requires Pro or Boss plan', { icon: '🔒' })}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', color: 'var(--text-3)', fontSize: 13, fontWeight: 500, cursor: 'not-allowed', opacity: 0.6 }}
              >
                <Upload size={14} /> Excel Import 🔒
              </button>
            )}

            <button
              onClick={() => deletableCount > 0 && setDeleteAllOpen(true)}
              disabled={deletableCount === 0}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: 8, padding: '9px 14px', color: 'var(--danger)', fontSize: 13, fontWeight: 600, cursor: deletableCount === 0 ? 'not-allowed' : 'pointer', opacity: deletableCount === 0 ? 0.5 : 1 }}
            >
              <Trash2 size={14} /> Delete All
            </button>

            <Link
              href="/inventory/add"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '9px 16px', color: 'var(--bg)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
              className="hover:opacity-90"
            >
              <Plus size={14} /> Add Laptop
            </Link>
          </div>}
        </div>

        {/* Summary bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 14 }}>
          <Stat label="Units in stock" value={String(stock.count)} />
          <Stat label="Total stock value" value={fmtRs(stock.stockValue)} hint="Sum of purchase prices" />
          <Stat label="Avg days in stock" value={`${stock.avgDays} days`} />
          <Stat label="Potential revenue" value={fmtRs(stock.potentialRevenue)} hint="Sum of asking prices" />
        </div>

        {/* Stock valuation card */}
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 22px', marginBottom: 22 }}>
          <p style={{ color: 'var(--text-2)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 14 }}>
            Stock position
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 18 }}>
            <div>
              <p style={{ color: 'var(--text-3)', fontSize: 12, marginBottom: 4 }}>Total purchase value (unsold)</p>
              <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: 22 }}>{fmtRs(stock.stockValue)}</p>
            </div>
            <div>
              <p style={{ color: 'var(--text-3)', fontSize: 12, marginBottom: 4 }}>Potential revenue (at asking)</p>
              <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: 22 }}>{fmtRs(stock.potentialRevenue)}</p>
            </div>
            <div>
              <p style={{ color: 'var(--text-3)', fontSize: 12, marginBottom: 4 }}>Potential gross profit</p>
              <p style={{ color: stock.potentialProfit >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700, fontSize: 22 }}>
                {fmtRs(stock.potentialProfit)}
              </p>
            </div>
          </div>
        </div>

        {/* Under Warranty section */}
        {underWarranty.length > 0 && (
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 22, overflow: 'hidden' }}>
            <button
              onClick={() => setWarrantyOpen((v) => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', padding: '14px 18px', cursor: 'pointer', textAlign: 'left' }}
            >
              {warrantyOpen ? <ChevronDown size={15} style={{ color: 'var(--text-3)' }} /> : <ChevronRight size={15} style={{ color: 'var(--text-3)' }} />}
              <ShieldAlert size={15} style={{ color: 'var(--warning)' }} />
              <span style={{ color: 'var(--text)', fontSize: 13, fontWeight: 600 }}>
                Under Warranty ({underWarranty.length})
              </span>
            </button>
            {warrantyOpen && (
              <div style={{ overflowX: 'auto', borderTop: '1px solid var(--border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Model', 'Supplier', 'Date Sent', 'Days Outstanding'].map((h) => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-3)', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {underWarranty.map((l) => {
                      const days = l.warranty_sent_at ? Math.floor((Date.now() - new Date(l.warranty_sent_at).getTime()) / 86_400_000) : 0
                      return (
                        <tr key={l.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 14px', color: 'var(--text)', fontSize: 13, fontWeight: 600 }}>{l.brand} {l.model}</td>
                          <td style={{ padding: '10px 14px', color: 'var(--text-2)', fontSize: 13 }}>{l.supplier_name ?? '—'}</td>
                          <td style={{ padding: '10px 14px', color: 'var(--text-2)', fontSize: 12 }}>{fmtDate(l.warranty_sent_at ?? null)}</td>
                          <td style={{ padding: '10px 14px', color: days > 14 ? 'var(--danger)' : 'var(--warning)', fontSize: 13, fontWeight: 600 }}>
                            {days} day{days !== 1 ? 's' : ''}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search serial no., brand, model, specs…"
              style={{ width: '100%', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 12px 9px 32px', color: 'var(--text)', fontSize: 13, outline: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            {(['all', 'in_stock', 'sold', 'aging'] as FilterKey[]).map((f) => {
              const labels = { all: 'All', in_stock: 'In Stock', sold: 'Sold', aging: 'Aging 60+' }
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    background: filter === f ? 'var(--accent-bg)' : 'var(--bg-2)',
                    border: `1px solid ${filter === f ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 7, padding: '7px 13px',
                    color: filter === f ? 'var(--accent-2)' : 'var(--text-2)',
                    fontWeight: filter === f ? 600 : 400, fontSize: 12, cursor: 'pointer',
                  }}
                >
                  {labels[f]}
                </button>
              )
            })}
          </div>
        </div>

        {/* Mobile cards (hidden on sm+) */}
        <div className="sm:hidden">
          {filtered.length === 0 ? (
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '48px 24px', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-3)', fontSize: 14 }}>
                {search || filter !== 'all' ? 'No laptops match your filters.' : 'No laptops in stock yet.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map((l) => {
                const days = daysInStock(l)
                const margin = profitMargin(l)
                return (
                  <div key={l.id} style={{ background: 'var(--bg-card, var(--bg-2))', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ color: 'var(--copper, var(--accent))', fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>
                          {l.brand} {l.model}
                          {l.is_bulk && (l.quantity ?? 0) > 0 && (
                            <span style={{ marginLeft: 6, background: 'var(--accent-bg)', border: '1px solid var(--accent)', color: 'var(--accent-2)', borderRadius: 5, padding: '1px 6px', fontSize: 11, fontWeight: 700, verticalAlign: 'middle' }}>
                              x{l.quantity}
                            </span>
                          )}
                        </p>
                        <p style={{ color: 'var(--text-3)', fontSize: 11, fontFamily: 'monospace', marginTop: 2 }}>{l.imei ?? 'No serial'}</p>
                      </div>
                      <StatusBadge laptop={l} />
                    </div>
                    <p style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 20, marginBottom: 4 }}>
                      {l.asking_price > 0 ? fmtRs(l.asking_price) : '—'}
                    </p>
                    <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                      {!isStaff && <span style={{ color: 'var(--text-3)', fontSize: 12 }}>Cost: {fmtRs(l.purchase_price)}</span>}
                      {margin && (
                        <span style={{ color: margin.pct >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: 12, fontWeight: 600 }}>
                          {margin.pct >= 0 ? '+' : ''}{margin.pct.toFixed(1)}%{!margin.actual && ' est'}
                        </span>
                      )}
                      {l.status === 'in_stock' && (
                        <span style={{ color: days >= AGING_DAYS ? 'var(--danger)' : days >= 30 ? 'var(--warning)' : 'var(--success)', fontSize: 12, fontWeight: 600 }}>
                          {days}d in stock
                        </span>
                      )}
                    </div>
                    {l.status === 'in_stock' && (
                      <Link
                        href={`/sales/new?laptop=${l.id}`}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 6, padding: '7px 14px', color: 'var(--success)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}
                      >
                        <ShoppingCart size={12} /> Sale
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Table (hidden on mobile) */}
        <div className="hidden sm:block">
        {/* Table */}
        {filtered.length === 0 ? (
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '64px 48px', textAlign: 'center' }}>
            {search || filter !== 'all' ? (
              <p style={{ color: 'var(--text-3)', fontSize: 14 }}>No laptops match your filters.</p>
            ) : (
              <>
                <div style={{ width: 56, height: 56, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                  <Package size={24} style={{ color: 'var(--text-3)' }} />
                </div>
                <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: 15, marginBottom: 6 }}>No laptops in stock yet.</p>
                <p style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 24 }}>Add your first laptop to start tracking inventory.</p>
                <Link
                  href="/inventory/add"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--accent)', color: 'var(--bg)', borderRadius: 8, padding: '10px 20px', fontWeight: 600, textDecoration: 'none', fontSize: 13 }}
                >
                  <Plus size={14} /> Add Laptop
                </Link>
              </>
            )}
          </div>
        ) : (
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {(isStaff
                    ? ['Serial No.', 'Brand', 'Model', 'Units', 'Specs', 'Bought', 'Days', 'Status', 'Type']
                    : ['Serial No.', 'Brand', 'Model', 'Units', 'Specs', 'Purchase', 'Bought', 'Days', 'Asking', 'Status', 'Type', 'Margin', '']
                  ).map((h) => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', color: 'var(--text-3)', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => {
                  const days = daysInStock(l)
                  const margin = profitMargin(l)
                  const tint = ageTint(l)
                  return (
                    <tr
                      key={l.id}
                      style={{ borderBottom: '1px solid var(--border)', background: tint }}
                    >
                      <td style={{ padding: '11px 14px' }}><ImeiCell imei={l.imei} /></td>
                      <td style={{ padding: '11px 14px', color: 'var(--text)', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>{l.brand}</td>
                      <td style={{ padding: '11px 14px', color: 'var(--text-2)', fontSize: 13, whiteSpace: 'nowrap' }}>
                        {l.model}
                        {l.is_bulk && (l.quantity ?? 0) > 0 && (
                          <span style={{ marginLeft: 6, background: 'var(--accent-bg)', border: '1px solid var(--accent)', color: 'var(--accent-2)', borderRadius: 5, padding: '1px 6px', fontSize: 11, fontWeight: 700 }}>
                            x{l.quantity}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 13, whiteSpace: 'nowrap' }}>
                        {l.is_bulk ? (
                          (l.quantity ?? 0) > 0 ? (
                            <span style={{ color: 'var(--text)', fontWeight: 600 }}>{l.quantity}</span>
                          ) : (
                            <span style={{ color: 'var(--danger)', fontWeight: 600 }}>0</span>
                          )
                        ) : (
                          <span style={{ color: 'var(--text-3)' }}>{l.status === 'sold' || l.status === 'traded_in' ? '—' : '1'}</span>
                        )}
                      </td>
                      <td style={{ padding: '11px 14px', color: 'var(--text-3)', fontSize: 12, maxWidth: 200 }}>
                        <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {specsLine(l.specs ?? {}) || '—'}
                        </span>
                      </td>
                      {!isStaff && <td style={{ padding: '11px 14px', color: 'var(--text)', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtRs(l.purchase_price)}</td>}
                      <td style={{ padding: '11px 14px', color: 'var(--text-3)', fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(l.purchase_date ?? l.added_at)}</td>
                      <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', color: l.status !== 'in_stock' ? 'var(--text-3)' : days >= AGING_DAYS ? 'var(--danger)' : days >= 30 ? 'var(--warning)' : 'var(--success)' }}>
                        {l.status === 'in_stock' ? `${days}d` : '—'}
                      </td>
                      {!isStaff && <td style={{ padding: '11px 14px' }}><AskingPriceCell laptop={l} onSave={handleAskingSave} /></td>}
                      <td style={{ padding: '11px 14px' }}><StatusBadge laptop={l} /></td>
                      <td style={{ padding: '11px 14px' }}><StockBadge laptop={l} /></td>
                      <td style={{ padding: '11px 14px', fontSize: 13, whiteSpace: 'nowrap' }}>
                        {margin ? (
                          <span
                            title={margin.actual ? 'Actual margin on sale' : 'Potential margin at asking price'}
                            style={{ color: margin.pct >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}
                          >
                            {margin.pct >= 0 ? '+' : ''}{margin.pct.toFixed(1)}%{!margin.actual && <span style={{ color: 'var(--text-3)', fontWeight: 400 }}> est</span>}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-3)' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {l.status === 'in_stock' ? (
                            <Link
                              href={`/sales/new?laptop=${l.id}`}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 6, padding: '5px 10px', color: 'var(--success)', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}
                            >
                              <ShoppingCart size={11} /> Sale
                            </Link>
                          ) : (
                            <button
                              onClick={() => setHistoryLaptop(l)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', color: 'var(--text-2)', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}
                            >
                              History
                            </button>
                          )}
                          {!isStaff && l.status === 'in_stock' && l.warranty_status !== 'sent' && (
                            <button
                              onClick={() => handleMarkSent(l)}
                              title="Send to supplier for warranty"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--warning-bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', color: 'var(--warning)', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                              <ShieldAlert size={11} /> Warranty
                            </button>
                          )}
                          {!isStaff && (
                            <button
                              onClick={() => setEditLaptop(l)}
                              title="Edit laptop details"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', color: 'var(--text-2)', fontSize: 11, cursor: 'pointer' }}
                            >
                              <Pencil size={11} />
                            </button>
                          )}
                          {!isStaff && (l.status === 'in_stock' || l.status === 'out_of_stock') && (
                            deleteConfirmId === l.id ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                                <span style={{ color: 'var(--text-2)', fontSize: 11 }}>Delete this laptop? This cannot be undone.</span>
                                <button
                                  onClick={() => handleDelete(l.id)}
                                  style={{ background: 'var(--danger)', border: 'none', borderRadius: 6, padding: '5px 10px', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(null)}
                                  style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', color: 'var(--text-2)', fontSize: 11, cursor: 'pointer' }}
                                >
                                  Cancel
                                </button>
                              </span>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirmId(l.id)}
                                title="Delete laptop"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--danger-bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', color: 'var(--danger)', fontSize: 11, cursor: 'pointer' }}
                              >
                                <Trash2 size={11} />
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-3)', fontSize: 12 }}>
                Showing {filtered.length} of {laptops.length} laptops
              </span>
            </div>
          </div>
        )}
        </div>
      </div>
    </>
  )
}





