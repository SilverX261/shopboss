'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useShop } from '@/hooks/useShop'
import { ArrowLeft, Search, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const todayISO = () => new Date().toISOString().slice(0, 10)

// ─── Types ────────────────────────────────────────────────────────────────────

type SupplierPayment = 'cash' | 'credit'

type StockType = 'own' | 'market'

interface LaptopForm {
  imei: string
  brand: string
  model: string
  processor: string
  ram: string
  storage: string
  screen: string
  condition: string
  purchase_price: string
  asking_price: string
  purchase_date: string
  supplier_name: string
  supplier_payment: SupplierPayment
  amount_owed: string
  due_date: string
  notes: string
  stock_type: StockType
  source_shop_name: string
  source_shop_price: string
}

const BLANK: LaptopForm = {
  imei: '', brand: '', model: '', processor: '', ram: '', storage: '', screen: '',
  condition: 'used', purchase_price: '', asking_price: '', purchase_date: todayISO(),
  supplier_name: '', supplier_payment: 'cash', amount_owed: '', due_date: '', notes: '',
  stock_type: 'own', source_shop_name: '', source_shop_price: '',
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg-3)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 14,
  outline: 'none', boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block', color: 'var(--text-2)', fontSize: 12, fontWeight: 600,
  marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5,
}

// ─── Spec dropdown options ────────────────────────────────────────────────────

const PROCESSOR_OPTIONS = [
  'Intel Core i3 (8th Gen)', 'Intel Core i3 (10th Gen)', 'Intel Core i3 (11th Gen)', 'Intel Core i3 (12th Gen)', 'Intel Core i3 (13th Gen)',
  'Intel Core i5 (8th Gen)', 'Intel Core i5 (10th Gen)', 'Intel Core i5 (11th Gen)', 'Intel Core i5 (12th Gen)', 'Intel Core i5 (13th Gen)',
  'Intel Core i7 (8th Gen)', 'Intel Core i7 (10th Gen)', 'Intel Core i7 (11th Gen)', 'Intel Core i7 (12th Gen)', 'Intel Core i7 (13th Gen)',
  'Intel Core i9 (12th Gen)', 'Intel Core i9 (13th Gen)',
  'AMD Ryzen 3 5300U', 'AMD Ryzen 5 5500U', 'AMD Ryzen 5 5600U', 'AMD Ryzen 5 6600U',
  'AMD Ryzen 7 5700U', 'AMD Ryzen 7 5800H', 'AMD Ryzen 7 6800H', 'AMD Ryzen 9 5900HX',
  'Apple M1', 'Apple M1 Pro', 'Apple M1 Max', 'Apple M2', 'Apple M2 Pro', 'Apple M3', 'Apple M3 Pro',
]
const RAM_OPTIONS = [
  '4 GB', '8 GB', '12 GB', '16 GB', '24 GB', '32 GB', '64 GB',
]
const STORAGE_OPTIONS = [
  '128 GB SSD', '256 GB SSD', '512 GB SSD', '1 TB SSD', '2 TB SSD',
  '256 GB HDD', '512 GB HDD', '1 TB HDD', '2 TB HDD',
  '512 GB SSD + 1 TB HDD', '256 GB SSD + 1 TB HDD',
]
const SCREEN_OPTIONS = [
  '11.6 inch', '12.5 inch', '13.3 inch', '14 inch',
  '15.6 inch', '16 inch', '17.3 inch',
]

// ─── Combobox: type to filter, pick or keep custom value ─────────────────────

function Combobox({
  value, onChange, options, placeholder,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [hiIdx, setHiIdx] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = value.trim()
    ? options.filter(o => o.toLowerCase().includes(value.toLowerCase()))
    : options

  useEffect(() => { setHiIdx(0) }, [value])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const pick = (opt: string) => { onChange(opt); setOpen(false) }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setHiIdx(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHiIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (open && filtered.length > 0) pick(filtered[hiIdx] ?? value)
      else setOpen(false)
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        style={{ ...inputStyle, padding: '8px 10px', fontSize: 13 }}
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8,
          marginTop: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', maxHeight: 220, overflowY: 'auto',
        }}>
          {filtered.map((opt, i) => (
            <button
              key={opt}
              type="button"
              onMouseDown={e => { e.preventDefault(); pick(opt) }}
              onMouseEnter={() => setHiIdx(i)}
              style={{
                width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                padding: '8px 12px', fontSize: 13,
                background: i === hiIdx ? 'var(--bg-3)' : 'transparent',
                color: opt === value ? 'var(--accent-2)' : 'var(--text-2)',
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Single add form ──────────────────────────────────────────────────────────

function SingleAddForm({ plan }: { plan: string }) {
  const router = useRouter()
  const { shop } = useShop()
  const [form, setForm] = useState<LaptopForm>(BLANK)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [imeiError, setImeiError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (k: keyof LaptopForm, v: string) => setForm((p) => ({ ...p, [k]: v }))

  const handleImeiBlur = async () => {
    setImeiError('')
    const imei = form.imei.trim()
    if (imei.length > 0 && imei.length < 5) {
      setImeiError('Serial number must be at least 5 characters')
      return
    }
    if (!/^\d{15}$/.test(imei)) return // IMEI lookup only for 15-digit numeric IMEIs
    if (plan === 'standard') return // IMEI lookup is Pro/Boss only

    setLookupLoading(true)
    try {
      const res = await fetch(`/api/imei-lookup?imei=${imei}`)
      const json = await res.json()
      if (json.result) {
        const { brand, model, specs } = json.result
        setForm((p) => ({
          ...p,
          brand: brand ?? p.brand,
          model: model ?? p.model,
          processor: specs?.processor ?? p.processor,
          ram: specs?.ram ?? p.ram,
          storage: specs?.storage ?? p.storage,
          screen: specs?.screen ?? p.screen,
        }))
        toast.success('Device info auto-filled')
      }
    } catch {
      // silent
    } finally {
      setLookupLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shop) return
    if (form.imei.trim().length < 5) {
      setImeiError('Serial number must be at least 5 characters')
      return
    }
    const price = parseFloat(form.purchase_price)
    if (isNaN(price) || price < 0) { toast.error('Enter a valid purchase price'); return }
    const asking = form.asking_price ? parseFloat(form.asking_price) : 0
    if (form.asking_price && (isNaN(asking) || asking < 0)) { toast.error('Enter a valid asking price'); return }

    // Validate supplier-credit fields
    const onCredit = form.supplier_payment === 'credit'
    let owed = 0
    if (onCredit) {
      if (!form.supplier_name.trim()) { toast.error('Supplier name is required for credit purchases'); return }
      owed = form.amount_owed ? parseFloat(form.amount_owed) : price
      if (isNaN(owed) || owed <= 0) { toast.error('Enter a valid amount owed'); return }
    }

    setSaving(true)
    const supabase = createClient()

    // 1) Insert laptop, return its id
    const { data: laptop, error } = await supabase
      .from('laptops')
      .insert({
        shop_id: shop.id,
        imei: form.imei.trim(),
        brand: form.brand.trim(),
        model: form.model.trim(),
        specs: {
          processor: form.processor.trim(),
          ram: form.ram.trim(),
          storage: form.storage.trim(),
          screen: form.screen.trim(),
        },
        condition: form.condition,
        purchase_price: price,
        asking_price: asking,
        purchase_date: form.purchase_date || todayISO(),
        supplier_name: form.supplier_name.trim() || null,
        supplier_payment: form.supplier_payment,
        notes: form.notes.trim() || null,
        status: 'in_stock',
        stock_type: form.stock_type,
        source_shop_name: form.stock_type === 'market' ? (form.source_shop_name.trim() || null) : null,
        source_shop_price: form.stock_type === 'market' && form.source_shop_price ? (parseFloat(form.source_shop_price) || null) : null,
      })
      .select('id')
      .single()

    if (error || !laptop) {
      setSaving(false)
      console.error('Laptop insert error:', JSON.stringify(error, null, 2))
      if (error?.code === '23505') { toast.error('A device with this serial number already exists.'); return }
      toast.error('Something went wrong. Please try again.')
      return
    }

    // 2) If bought on credit, create a supplier_credit record
    if (onCredit) {
      const { error: scErr } = await supabase.from('supplier_credits').insert({
        shop_id: shop.id,
        laptop_id: laptop.id,
        supplier_name: form.supplier_name.trim(),
        amount_owed: owed,
        amount_paid: 0,
        due_date: form.due_date || null,
        status: 'pending',
      })
      if (scErr) {
        setSaving(false)
        toast.error('Laptop added, but supplier credit could not be saved.')
        router.push('/inventory')
        return
      }
    }

    setSaving(false)
    toast.success(onCredit ? 'Laptop added & supplier credit recorded!' : 'Laptop added!')
    router.push('/inventory')
  }

  const onCredit = form.supplier_payment === 'credit'

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Serial Number */}
      <div>
        <label style={labelStyle}>Serial Number / Service Tag *</label>
        <div style={{ position: 'relative' }}>
          <input
            value={form.imei}
            onChange={(e) => { set('imei', e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()); setImeiError('') }}
            onBlur={handleImeiBlur}
            maxLength={20}
            placeholder="e.g. 5CG1234567 or 354546112233445"
            style={{ ...inputStyle, border: `1px solid ${imeiError ? 'var(--danger)' : 'var(--border)'}`, paddingRight: 36 }}
            required
          />
          {lookupLoading && (
            <Search size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
          )}
        </div>
        {imeiError ? (
          <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertCircle size={12} /> {imeiError}
          </p>
        ) : (
          <p style={{ color: 'var(--text-3)', fontSize: 11, marginTop: 4 }}>Scan barcode or type manually. Letters and numbers accepted.</p>
        )}
        {plan === 'standard' && (
          <p style={{ color: 'var(--text-3)', fontSize: 11, marginTop: 4 }}>🔒 Auto-fill from serial number requires Pro or Boss plan</p>
        )}
      </div>

      {/* Brand / Model */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <label style={labelStyle}>Brand *</label>
          <input value={form.brand} onChange={(e) => set('brand', e.target.value)} placeholder="Dell, HP, Lenovo…" style={inputStyle} required />
        </div>
        <div>
          <label style={labelStyle}>Model *</label>
          <input value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="Latitude 5420…" style={inputStyle} required />
        </div>
      </div>

      {/* Specs */}
      <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px' }}>
        <p style={{ color: 'var(--text-2)', fontSize: 12, fontWeight: 600, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Specifications
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ ...labelStyle, textTransform: 'none', fontSize: 11 }}>Processor</label>
            <Combobox value={form.processor} onChange={v => set('processor', v)} options={PROCESSOR_OPTIONS} placeholder="Select processor…" />
          </div>
          <div>
            <label style={{ ...labelStyle, textTransform: 'none', fontSize: 11 }}>RAM</label>
            <Combobox value={form.ram} onChange={v => set('ram', v)} options={RAM_OPTIONS} placeholder="Select RAM…" />
          </div>
          <div>
            <label style={{ ...labelStyle, textTransform: 'none', fontSize: 11 }}>Storage</label>
            <Combobox value={form.storage} onChange={v => set('storage', v)} options={STORAGE_OPTIONS} placeholder="Select storage…" />
          </div>
          <div>
            <label style={{ ...labelStyle, textTransform: 'none', fontSize: 11 }}>Screen size</label>
            <Combobox value={form.screen} onChange={v => set('screen', v)} options={SCREEN_OPTIONS} placeholder="Select screen size…" />
          </div>
        </div>
      </div>

      {/* Condition / Purchase date */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <label style={labelStyle}>Condition *</label>
          <select value={form.condition} onChange={(e) => set('condition', e.target.value)} style={inputStyle}>
            <option value="new">New</option>
            <option value="used">Used</option>
            <option value="refurbished">Refurbished</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Purchase Date *</label>
          <input type="date" value={form.purchase_date} onChange={(e) => set('purchase_date', e.target.value)} style={inputStyle} required />
        </div>
      </div>

      {/* Purchase / Asking price */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <label style={labelStyle}>Purchase Price (Rs) *</label>
          <input type="number" min={0} value={form.purchase_price} onChange={(e) => set('purchase_price', e.target.value)} placeholder="45000" style={inputStyle} required />
        </div>
        <div>
          <label style={labelStyle}>Asking Price (Rs)</label>
          <input type="number" min={0} value={form.asking_price} onChange={(e) => set('asking_price', e.target.value)} placeholder="55000" style={inputStyle} />
        </div>
      </div>

      {/* Stock type */}
      <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px' }}>
        <p style={{ color: 'var(--text-2)', fontSize: 12, fontWeight: 600, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 }}>Stock Type</p>
        <div style={{ display: 'flex', gap: 0, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 4, marginBottom: 12 }}>
          {(['own', 'market'] as StockType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => set('stock_type', t)}
              style={{
                flex: 1, borderRadius: 6, padding: '9px 0', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: form.stock_type === t ? 600 : 400,
                background: form.stock_type === t ? (t === 'market' ? 'var(--warning)' : 'var(--success)') : 'transparent',
                color: form.stock_type === t ? 'var(--bg)' : 'var(--text-3)',
              }}
            >
              {t === 'own' ? 'Own Stock' : 'Market Stock (borrowed)'}
            </button>
          ))}
        </div>
        {form.stock_type === 'market' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ ...labelStyle, textTransform: 'none', fontSize: 11 }}>Neighbor shop name (optional)</label>
              <input value={form.source_shop_name} onChange={(e) => set('source_shop_name', e.target.value)} placeholder="Ahmed Computers…" style={{ ...inputStyle, padding: '8px 10px', fontSize: 13 }} />
            </div>
            <div>
              <label style={{ ...labelStyle, textTransform: 'none', fontSize: 11 }}>Their asking price — what you owe if sold (Rs)</label>
              <input type="number" min={0} value={form.source_shop_price} onChange={(e) => set('source_shop_price', e.target.value)} placeholder="70000" style={{ ...inputStyle, padding: '8px 10px', fontSize: 13 }} />
            </div>
          </div>
        )}
      </div>

      {/* Supplier block */}
      <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px' }}>
        <p style={{ color: 'var(--text-2)', fontSize: 12, fontWeight: 600, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Supplier
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ ...labelStyle, textTransform: 'none', fontSize: 11 }}>Supplier name (optional)</label>
            <input value={form.supplier_name} onChange={(e) => set('supplier_name', e.target.value)} placeholder="e.g. Hall Road Traders" style={{ ...inputStyle, padding: '8px 10px', fontSize: 13 }} />
          </div>
          <div>
            <label style={{ ...labelStyle, textTransform: 'none', fontSize: 11 }}>Payment</label>
            <div style={{ display: 'flex', gap: 0, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 4 }}>
              {(['cash', 'credit'] as SupplierPayment[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => set('supplier_payment', p)}
                  style={{
                    flex: 1, background: form.supplier_payment === p ? 'var(--bg-3)' : 'transparent',
                    border: 'none', borderRadius: 6, padding: '7px 0',
                    color: form.supplier_payment === p ? 'var(--text)' : 'var(--text-3)',
                    fontWeight: form.supplier_payment === p ? 600 : 400, fontSize: 13, cursor: 'pointer',
                  }}
                >
                  {p === 'cash' ? 'Paid (cash)' : 'On credit'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {onCredit && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ ...labelStyle, textTransform: 'none', fontSize: 11 }}>Amount owed (Rs) *</label>
              <input
                type="number" min={0}
                value={form.amount_owed}
                onChange={(e) => set('amount_owed', e.target.value)}
                placeholder={form.purchase_price || 'Defaults to purchase price'}
                style={{ ...inputStyle, padding: '8px 10px', fontSize: 13 }}
              />
            </div>
            <div>
              <label style={{ ...labelStyle, textTransform: 'none', fontSize: 11 }}>Due date</label>
              <input type="date" value={form.due_date} onChange={(e) => set('due_date', e.target.value)} style={{ ...inputStyle, padding: '8px 10px', fontSize: 13 }} />
            </div>
            <p style={{ gridColumn: '1 / -1', color: 'var(--text-3)', fontSize: 11, margin: 0 }}>
              A supplier credit record will be created and tracked as money owed.
            </p>
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <label style={labelStyle}>Notes</label>
        <textarea
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={2}
          placeholder="Any notes about this laptop…"
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        style={{
          background: 'var(--accent)', border: 'none', borderRadius: 8,
          padding: '12px 24px', color: 'var(--bg)', fontSize: 14, fontWeight: 600,
          cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, alignSelf: 'flex-start',
        }}
      >
        {saving ? 'Adding…' : 'Add Laptop'}
      </button>
    </form>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AddLaptopPage() {
  const { shop } = useShop()
  const plan = shop?.plan ?? 'standard'

  return (
    <div style={{ maxWidth: 680, marginInline: 'auto' }}>
      <Link href="/inventory" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-3)', fontSize: 13, textDecoration: 'none', marginBottom: 20 }}>
        <ArrowLeft size={14} /> Back to inventory
      </Link>

      <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 32, marginBottom: 4 }}>Add Laptop</h1>
      <p style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 24 }}>
        {plan !== 'standard' ? 'Enter serial number and let ShopBoss auto-fill device details.' : 'Enter device details manually.'}
      </p>

      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px' }}>
        <SingleAddForm plan={plan} />
      </div>
    </div>
  )
}
