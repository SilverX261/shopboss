'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useShop } from '@/hooks/useShop'
import { localDayISO } from '@/lib/utils/daily-accounting'
import { Plus, X, RefreshCw, ShoppingCart, ClipboardCheck, Clock, Check, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import type { AccessoryCategory } from '@/lib/types'

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmtRs = (n: number) => `Rs ${Math.round(n).toLocaleString('en-PK')}`

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
}

function unitsInStock(c: AccessoryCategory): number {
  return c.display_qty ?? 0
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg-3)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 14,
  outline: 'none', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  display: 'block', color: 'var(--text-2)', fontSize: 12, fontWeight: 600, marginBottom: 5,
}

// ─── Searchable category picker ─────────────────────────────────────────────

function CategorySelect({
  cats,
  value,
  onChange,
  renderLabel,
}: {
  cats: AccessoryCategory[]
  value: string
  onChange: (id: string) => void
  renderLabel: (c: AccessoryCategory) => string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = cats.find((c) => c.id === value)
  const filtered = cats.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))

  useEffect(() => {
    if (open) { setQuery(''); setTimeout(() => inputRef.current?.focus(), 0) }
  }, [open])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const select = (id: string) => { onChange(id); setOpen(false) }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%', background: 'var(--bg-3)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '10px 12px', color: selected ? 'var(--text)' : 'var(--text-3)',
          fontSize: 14, outline: 'none', boxSizing: 'border-box', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left',
        }}
      >
        <span>{selected ? renderLabel(selected) : 'Select category…'}</span>
        <ChevronDown size={14} style={{ flexShrink: 0, color: 'var(--text-3)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8,
          marginTop: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', overflow: 'hidden',
        }}>
          <div style={{ padding: '8px 8px 4px' }}>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filtered.length) select(filtered[0].id)
                if (e.key === 'Escape') setOpen(false)
              }}
              placeholder="Search…"
              style={{ width: '100%', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <p style={{ padding: '10px 12px', color: 'var(--text-3)', fontSize: 13 }}>No match</p>
            ) : filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => select(c.id)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '9px 12px', background: c.id === value ? 'var(--accent-bg)' : 'transparent',
                  border: 'none', color: c.id === value ? 'var(--accent-2)' : 'var(--text)',
                  fontSize: 13, cursor: 'pointer',
                }}
              >
                {renderLabel(c)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ModalShell({ title, onClose, children, maxWidth = 420 }: { title: string; onClose: () => void; children: React.ReactNode; maxWidth?: number }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }} onClick={onClose}>
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px', width: '100%', maxWidth, maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
          <h3 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 17 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── Add category modal ──────────────────────────────────────────────────────

function AddCategoryModal({ shopId, onClose, onDone }: { shopId: string; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState('')
  const [cost, setCost] = useState('')
  const [qty, setQty] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const c = parseFloat(cost), q = parseInt(qty, 10)
    if (!name.trim()) { toast.error('Enter a category name'); return }
    if (isNaN(c) || c < 0) { toast.error('Enter a valid cost per unit'); return }
    if (isNaN(q) || q < 0) { toast.error('Enter a valid initial quantity'); return }
    setSaving(true)
    const res = await fetch('/api/accessories/add-category', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shop_id: shopId,
        name: name.trim(),
        cost_per_unit: c,
        display_qty: q,
        total_value_added: q * c,
      }),
    })
    setSaving(false)
    if (!res.ok) { toast.error('Something went wrong. Please try again.'); return }
    toast.success('Category added')
    onDone(); onClose()
  }

  return (
    <ModalShell title="Add Category" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={labelStyle}>Category name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="HP 65W Chargers" style={inputStyle} autoFocus />
        </div>
        <div>
          <label style={labelStyle}>Cost per unit (Rs) *</label>
          <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="1500" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Initial quantity *</label>
          <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="20" style={inputStyle} />
        </div>
        <button onClick={save} disabled={saving} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '12px', color: 'var(--bg)', fontWeight: 600, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, marginTop: 4 }}>
          {saving ? 'Adding…' : 'Add Category'}
        </button>
      </div>
    </ModalShell>
  )
}

// ─── Record sale modal ───────────────────────────────────────────────────────

type PayType = 'cash' | 'udhaar' | 'bank'

function SaleModal({ cats, preselect, shopId, onClose, onDone }: { cats: AccessoryCategory[]; preselect: string; shopId: string; onClose: () => void; onDone: () => void }) {
  const [catId, setCatId] = useState(preselect)
  const [qty, setQty] = useState('')
  const [price, setPrice] = useState('')
  const [pay, setPay] = useState<PayType>('cash')
  const [custName, setCustName] = useState('')
  const [custPhone, setCustPhone] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)

  const cat = cats.find((c) => c.id === catId)
  const q = parseInt(qty, 10)
  const p = parseFloat(price)
  const value = !isNaN(q) && !isNaN(p) ? q * p : 0
  const profit = cat && !isNaN(q) && !isNaN(p) ? (p - cat.cost_per_unit) * q : 0

  const save = async () => {
    if (!cat) { toast.error('Pick a category'); return }
    if (isNaN(q) || q <= 0) { toast.error('Enter quantity'); return }
    if (isNaN(p) || p <= 0) { toast.error('Enter sale price per unit'); return }
    if (pay === 'udhaar' && (!custName.trim() || !custPhone.trim())) { toast.error('Udhaar needs customer name & phone'); return }
    setSaving(true)
    const supabase = createClient()

    const { error: txErr } = await supabase.from('accessory_transactions').insert({
      shop_id: shopId, category_id: cat.id, worker_id: null,
      transaction_type: 'sale', units: q, value, payment_type: pay,
      note: pay === 'udhaar' ? `Udhaar: ${custName.trim()}` : null,
    })
    if (txErr) { setSaving(false); toast.error('Something went wrong. Please try again.'); return }

    await supabase.from('accessory_categories').update({
      total_value_sold: cat.total_value_sold + value,
      display_qty: Math.max(0, cat.display_qty - q),
    }).eq('id', cat.id)

    if (pay === 'udhaar') {
      await supabase.from('udhaar_records').insert({
        shop_id: shopId,
        mode: 'value_based',
        customer_name: custName.trim(),
        customer_phone: custPhone.replace(/\D/g, '').slice(0, 11),
        total_amount: value,
        amount_paid: 0,
        amount_remaining: value,
        items: [{ name: `${cat.name} ×${q}`, price: value }],
        description: `${cat.name} ×${q}`,
        due_date: dueDate || null,
        status: 'pending',
      })
    }

    setSaving(false)
    toast.success(pay === 'cash' ? `Sale recorded — ${fmtRs(value)} added to cash` : 'Sale recorded')
    onDone(); onClose()
  }

  return (
    <ModalShell title="Record Accessory Sale" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={labelStyle}>Category *</label>
          <CategorySelect
            cats={cats}
            value={catId}
            onChange={setCatId}
            renderLabel={(c) => `${c.name} (${unitsInStock(c)} in stock)`}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Quantity *</label>
            <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="1" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Sale price / unit *</label>
            <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={cat ? String(cat.cost_per_unit) : '0'} style={inputStyle} />
          </div>
        </div>
        {value > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-3)', borderRadius: 8, padding: '10px 12px' }}>
            <span style={{ color: 'var(--text-2)', fontSize: 13 }}>Total {fmtRs(value)}</span>
            <span style={{ color: profit >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: 13, fontWeight: 600 }}>Profit {fmtRs(profit)}</span>
          </div>
        )}
        <div>
          <label style={labelStyle}>Payment *</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {(['cash', 'bank', 'udhaar'] as PayType[]).map((m) => (
              <button key={m} type="button" onClick={() => setPay(m)} style={{ background: pay === m ? 'var(--accent-bg)' : 'var(--bg-3)', border: `1px solid ${pay === m ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, padding: '9px', color: pay === m ? 'var(--accent-2)' : 'var(--text-2)', fontWeight: pay === m ? 600 : 500, fontSize: 13, cursor: 'pointer', textTransform: 'capitalize' }}>{m}</button>
            ))}
          </div>
        </div>
        {pay === 'udhaar' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg-3)', borderRadius: 10, padding: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input value={custName} onChange={(e) => setCustName(e.target.value)} placeholder="Customer name *" style={inputStyle} />
              <input value={custPhone} onChange={(e) => setCustPhone(e.target.value)} placeholder="Phone *" style={inputStyle} />
            </div>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} />
          </div>
        )}
        <button onClick={save} disabled={saving} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '12px', color: 'var(--bg)', fontWeight: 600, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving…' : 'Record Sale'}
        </button>
      </div>
    </ModalShell>
  )
}

// ─── Restock modal ───────────────────────────────────────────────────────────

function RestockModal({ cats, preselect, shopId, onClose, onDone }: { cats: AccessoryCategory[]; preselect: string; shopId: string; onClose: () => void; onDone: () => void }) {
  const [catId, setCatId] = useState(preselect)
  const cat = cats.find((c) => c.id === catId)
  const [qty, setQty] = useState('')
  const [cost, setCost] = useState(cat ? String(cat.cost_per_unit) : '')
  const [credit, setCredit] = useState(false)
  const [supplier, setSupplier] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)

  // keep cost prefilled when category changes
  useEffect(() => { if (cat) setCost(String(cat.cost_per_unit)) }, [cat])

  const q = parseInt(qty, 10)
  const c = parseFloat(cost)
  const totalCost = !isNaN(q) && !isNaN(c) ? q * c : 0

  const save = async () => {
    if (!cat) { toast.error('Pick a category'); return }
    if (isNaN(q) || q <= 0) { toast.error('Enter units to add'); return }
    if (isNaN(c) || c < 0) { toast.error('Enter cost per unit'); return }
    if (credit && !supplier.trim()) { toast.error('Supplier name required for credit'); return }
    setSaving(true)
    const supabase = createClient()

    await supabase.from('accessory_transactions').insert({
      shop_id: shopId, category_id: cat.id, worker_id: null,
      transaction_type: 'restock', units: q, value: totalCost,
      payment_type: credit ? 'credit' : 'cash',
      note: credit ? `Credit from ${supplier.trim()}` : null,
    })

    await supabase.from('accessory_categories').update({
      total_value_added: cat.total_value_added + totalCost,
      display_qty: cat.display_qty + q,
      cost_per_unit: c,
    }).eq('id', cat.id)

    if (credit) {
      await supabase.from('supplier_credits').insert({
        shop_id: shopId, laptop_id: null, supplier_name: supplier.trim(),
        amount_owed: totalCost, amount_paid: 0, due_date: dueDate || null, status: 'pending',
      })
    }

    setSaving(false)
    toast.success(`Restocked ${q} units (${fmtRs(totalCost)})${credit ? ' — supplier credit recorded' : ''}`)
    onDone(); onClose()
  }

  return (
    <ModalShell title="Restock" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={labelStyle}>Category *</label>
          <CategorySelect
            cats={cats}
            value={catId}
            onChange={setCatId}
            renderLabel={(c) => c.name}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Units added *</label>
            <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="20" style={inputStyle} autoFocus />
          </div>
          <div>
            <label style={labelStyle}>Cost per unit *</label>
            <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="1500" style={inputStyle} />
          </div>
        </div>
        {totalCost > 0 && <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Total cost: {fmtRs(totalCost)}</p>}
        <div>
          <label style={labelStyle}>Paid to supplier</label>
          <div style={{ display: 'flex', gap: 0, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: 4 }}>
            {[['cash', 'Cash'], ['credit', 'On credit']].map(([k, lbl]) => {
              const active = (k === 'credit') === credit
              return <button key={k} type="button" onClick={() => setCredit(k === 'credit')} style={{ flex: 1, background: active ? 'var(--bg-2)' : 'transparent', border: 'none', borderRadius: 6, padding: '8px 0', color: active ? 'var(--text)' : 'var(--text-3)', fontWeight: active ? 600 : 400, fontSize: 13, cursor: 'pointer' }}>{lbl}</button>
            })}
          </div>
        </div>
        {credit && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Supplier name *" style={inputStyle} />
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} />
          </div>
        )}
        <button onClick={save} disabled={saving} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '12px', color: 'var(--bg)', fontWeight: 600, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving…' : 'Confirm Restock'}
        </button>
      </div>
    </ModalShell>
  )
}

// ─── Manual count modal ──────────────────────────────────────────────────────

function CountModal({ cat, shopId, onClose, onDone }: { cat: AccessoryCategory; shopId: string; onClose: () => void; onDone: () => void }) {
  const expected = unitsInStock(cat)
  const [actual, setActual] = useState('')
  const [saving, setSaving] = useState(false)
  const a = parseInt(actual, 10)
  const gap = !isNaN(a) ? a - expected : null

  const save = async () => {
    if (isNaN(a) || a < 0) { toast.error('Enter the counted quantity'); return }
    setSaving(true)
    const supabase = createClient()
    await supabase.from('accessory_categories').update({
      last_manual_count: a,
      last_manual_count_date: localDayISO(),
      display_qty: a,
    }).eq('id', cat.id)
    if (gap !== null && gap !== 0) {
      await supabase.from('accessory_transactions').insert({
        shop_id: shopId, category_id: cat.id, worker_id: null,
        transaction_type: 'adjustment', units: gap, value: gap * cat.cost_per_unit,
        payment_type: 'cash', note: `Manual count: expected ${expected}, counted ${a}`,
      })
    }
    setSaving(false)
    toast.success('Count recorded')
    onDone(); onClose()
  }

  return (
    <ModalShell title={`Manual Count — ${cat.name}`} onClose={onClose} maxWidth={400}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-3)', borderRadius: 8, padding: '12px 14px' }}>
          <span style={{ color: 'var(--text-2)', fontSize: 13 }}>Current stock (system)</span>
          <span style={{ color: 'var(--text)', fontWeight: 700 }}>{expected} units</span>
        </div>
        <div>
          <label style={labelStyle}>Actual count *</label>
          <input type="number" value={actual} onChange={(e) => setActual(e.target.value)} placeholder="0" autoFocus style={{ ...inputStyle, fontSize: 22, fontWeight: 700, padding: '14px', textAlign: 'center' }} />
        </div>
        {gap !== null && gap !== 0 && (
          <div style={{ borderRadius: 8, padding: '12px 14px', textAlign: 'center', background: gap < 0 ? 'var(--danger-bg)' : 'var(--warning-bg)', border: `1px solid ${gap < 0 ? 'var(--danger-border)' : 'var(--border)'}` }}>
            <p style={{ color: gap < 0 ? 'var(--danger)' : 'var(--warning)', fontWeight: 700, fontSize: 14 }}>
              {gap < 0 ? `${Math.abs(gap)} item${Math.abs(gap) !== 1 ? 's' : ''} unaccounted for` : `${gap} more than expected`}
            </p>
            <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 2 }}>Value impact: {fmtRs(Math.abs(gap) * cat.cost_per_unit)}</p>
          </div>
        )}
        {gap === 0 && <p style={{ color: 'var(--success)', fontSize: 13, textAlign: 'center', fontWeight: 600 }}>✓ Matches expected</p>}
        <button onClick={save} disabled={saving} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '12px', color: 'var(--bg)', fontWeight: 600, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving…' : 'Record Count'}
        </button>
      </div>
    </ModalShell>
  )
}

// ─── Category card ───────────────────────────────────────────────────────────

function CategoryCard({ cat, onSale, onRestock, onCount }: { cat: AccessoryCategory; onSale: () => void; onRestock: () => void; onCount: () => void }) {
  const units = unitsInStock(cat)
  const countDays = daysSince(cat.last_manual_count_date)

  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: 15 }}>{cat.name}</p>
          <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 2 }}>{fmtRs(cat.cost_per_unit)}/unit</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <Clock size={11} style={{ color: 'var(--text-3)' }} />
          <span style={{ color: 'var(--text-3)', fontSize: 11 }}>{countDays !== null ? `${countDays}d ago` : 'Never counted'}</span>
        </div>
      </div>

      {/* Units in stock — big number */}
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <p style={{ color: units === 0 ? 'var(--danger)' : 'var(--text)', fontWeight: 800, fontSize: 40, lineHeight: 1 }}>{units}</p>
        <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 4 }}>units in stock</p>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onSale} style={{ flex: 1, background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 7, padding: '9px 10px', color: 'var(--success)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <ShoppingCart size={12} /> Add Sale
        </button>
        <button onClick={onRestock} style={{ flex: 1, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 7, padding: '9px 10px', color: 'var(--text-2)', fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <RefreshCw size={12} /> Restock
        </button>
        <button onClick={onCount} style={{ flexShrink: 0, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 7, padding: '9px 11px', color: 'var(--text-2)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }} title="Manual count">
          <ClipboardCheck size={13} />
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AccessoriesPage() {
  const { shop } = useShop()
  const [cats, setCats] = useState<AccessoryCategory[]>([])
  const [soldMonth, setSoldMonth] = useState(0)
  const [profitMonth, setProfitMonth] = useState(0)
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [saleFor, setSaleFor] = useState<string | null>(null)
  const [restockFor, setRestockFor] = useState<string | null>(null)
  const [countFor, setCountFor] = useState<AccessoryCategory | null>(null)

  const load = useCallback(async () => {
    if (!shop) return
    const supabase = createClient()
    const monthStart = localDayISO(new Date()).slice(0, 7) + '-01'
    const [{ data: catData }, { data: txData }] = await Promise.all([
      supabase.from('accessory_categories').select('*').eq('shop_id', shop.id).order('name'),
      supabase.from('accessory_transactions')
        .select('units, value, transaction_type, category_id, created_at')
        .eq('shop_id', shop.id).eq('transaction_type', 'sale')
        .gte('created_at', monthStart + 'T00:00:00'),
    ])
    const categories = (catData ?? []) as AccessoryCategory[]
    setCats(categories)

    const costById = new Map(categories.map((c) => [c.id, c.cost_per_unit]))
    let sold = 0, profit = 0
    ;(txData ?? []).forEach((t: { units: number; value: number; category_id: string }) => {
      sold += t.value
      profit += t.value - (t.units ?? 0) * (costById.get(t.category_id) ?? 0)
    })
    setSoldMonth(sold)
    setProfitMonth(profit)
    setLoading(false)
  }, [shop])

  useEffect(() => { load() }, [load])

  const totalUnits = useMemo(() => cats.reduce((s, c) => s + unitsInStock(c), 0), [cats])

  if (loading) return <div style={{ color: 'var(--text-3)', fontSize: 14 }}>Loading accessories…</div>

  return (
    <>
      {addOpen && shop && <AddCategoryModal shopId={shop.id} onClose={() => setAddOpen(false)} onDone={load} />}
      {saleFor !== null && shop && <SaleModal cats={cats} preselect={saleFor} shopId={shop.id} onClose={() => setSaleFor(null)} onDone={load} />}
      {restockFor !== null && shop && <RestockModal cats={cats} preselect={restockFor} shopId={shop.id} onClose={() => setRestockFor(null)} onDone={load} />}
      {countFor && shop && <CountModal cat={countFor} shopId={shop.id} onClose={() => setCountFor(null)} onDone={load} />}

      <div style={{ maxWidth: 940, marginInline: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 32, marginBottom: 2 }}>Accessories</h1>
            <p style={{ color: 'var(--text-3)', fontSize: 13 }}>{cats.length} categories · unit tracking</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {cats.length > 0 && (
              <button onClick={() => setSaleFor('')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', color: 'var(--text-2)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                <ShoppingCart size={14} /> Record Sale
              </button>
            )}
            <button onClick={() => setAddOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '9px 16px', color: 'var(--bg)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <Plus size={14} /> Add Category
            </button>
          </div>
        </div>

        {/* Summary bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 22 }}>
          {[
            { label: 'Units in stock', value: String(totalUnits), color: 'var(--text)' },
            { label: 'Sold this month (Rs)', value: fmtRs(soldMonth), color: 'var(--text)' },
            { label: 'Profit this month', value: fmtRs(profitMonth), color: profitMonth >= 0 ? 'var(--success)' : 'var(--danger)' },
          ].map((s) => (
            <div key={s.label} style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
              <p style={{ color: 'var(--text-3)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{s.label}</p>
              <p style={{ color: s.color, fontWeight: 800, fontSize: 20 }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Grid */}
        {cats.length === 0 ? (
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '56px', textAlign: 'center' }}>
            <Check size={28} style={{ color: 'var(--text-3)', marginBottom: 10 }} />
            <p style={{ color: 'var(--text-3)', fontSize: 14 }}>No accessory categories yet.</p>
            <button onClick={() => setAddOpen(true)} style={{ marginTop: 16, background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '10px 20px', color: 'var(--bg)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
              Add first category
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
            {cats.map((cat) => (
              <CategoryCard
                key={cat.id}
                cat={cat}
                onSale={() => setSaleFor(cat.id)}
                onRestock={() => setRestockFor(cat.id)}
                onCount={() => setCountFor(cat)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
