'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useShop } from '@/hooks/useShop'
import { ArrowLeft, Plus, Trash2, Link2, FileText, Check } from 'lucide-react'
import toast from 'react-hot-toast'

const fmtRs = (n: number) => `Rs ${Math.round(n).toLocaleString('en-PK')}`

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg-3)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 14,
  outline: 'none', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  display: 'block', color: 'var(--text-2)', fontSize: 12, fontWeight: 600,
  marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5,
}

function quickDate(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const quickBtnStyle: React.CSSProperties = {
  background: 'none', border: '1px solid var(--border)', borderRadius: 6,
  padding: '4px 10px', color: 'var(--text-3)', fontSize: 11, fontWeight: 500,
  cursor: 'pointer', whiteSpace: 'nowrap',
}

interface DonePayload { customerName: string; amount: number; dueDate: string }

type Mode = 'linked' | 'standalone'

interface UdhaarSale {
  id: string
  sale_price: number
  customer_name: string | null
  customer_phone: string | null
  sold_at: string
  laptop: { brand: string; model: string } | null
}

interface Item { name: string; price: string }

// ─── Mode A: linked to a sale ───────────────────────────────────────────────

function LinkedMode({ shopId, onDone }: { shopId: string; onDone: (p: DonePayload) => void }) {
  const [sales, setSales] = useState<UdhaarSale[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<UdhaarSale | null>(null)
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
    const [{ data: salesData }, { data: linked }] = await Promise.all([
      supabase
        .from('sales')
        .select('id, sale_price, customer_name, customer_phone, sold_at, laptops ( brand, model )')
        .eq('shop_id', shopId)
        .eq('payment_type', 'udhaar')
        .eq('is_voided', false)
        .gte('sold_at', since)
        .order('sold_at', { ascending: false }),
      supabase.from('udhaar_records').select('sale_id').eq('shop_id', shopId).not('sale_id', 'is', null),
    ])
    const linkedIds = new Set((linked ?? []).map((r: { sale_id: string }) => r.sale_id))
    const mapped = (salesData ?? []).map((s: Record<string, unknown>) => ({
      ...s,
      laptop: Array.isArray(s.laptops) ? s.laptops[0] ?? null : (s.laptops as UdhaarSale['laptop']),
    })) as unknown as UdhaarSale[]
    setSales(mapped.filter((s) => !linkedIds.has(s.id)))
    setLoading(false)
  }, [shopId])

  useEffect(() => { load() }, [load])

  const submit = async () => {
    if (!selected) { toast.error('Select a sale'); return }
    if (!dueDate) { toast.error('Due date is required'); return }
    if (!selected.customer_name || !selected.customer_phone) {
      toast.error('This sale has no customer details. Use Standalone mode instead.'); return
    }
    setSaving(true)
    const res = await fetch('/api/udhaar/create-owner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shop_id: shopId,
        mode: 'value_based',
        customer_name: selected.customer_name,
        customer_phone: selected.customer_phone,
        total_amount: selected.sale_price,
        amount_paid: 0,
        amount_remaining: selected.sale_price,
        due_date: dueDate,
        status: 'pending',
        approved_by_owner: true,
        sale_id: selected.id,
        description: selected.laptop ? `${selected.laptop.brand} ${selected.laptop.model}` : 'Laptop sale',
      }),
    })
    setSaving(false)
    if (!res.ok) { toast.error('Something went wrong. Please try again.'); return }
    toast.success('Udhaar linked to sale')
    onDone({ customerName: selected.customer_name!, amount: selected.sale_price, dueDate })
  }

  if (loading) return <p style={{ color: 'var(--text-3)', fontSize: 14 }}>Loading udhaar sales…</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {sales.length === 0 ? (
        <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: '24px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-3)', fontSize: 13 }}>
            No unlinked udhaar sales in the last 30 days. Udhaar sales recorded via &quot;Record Sale&quot; are already linked automatically.
          </p>
        </div>
      ) : (
        <>
          <div>
            <label style={labelStyle}>Select an udhaar sale</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sales.map((s) => {
                const active = selected?.id === s.id
                return (
                  <button key={s.id} onClick={() => setSelected(s)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: active ? 'var(--accent-bg)' : 'var(--bg-2)', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 10, padding: '12px 14px', cursor: 'pointer', textAlign: 'left' }}>
                    <div>
                      <p style={{ color: 'var(--text)', fontSize: 13, fontWeight: 600 }}>{s.laptop ? `${s.laptop.brand} ${s.laptop.model}` : 'Laptop'}</p>
                      <p style={{ color: 'var(--text-3)', fontSize: 12 }}>{s.customer_name ?? 'No name'} · {new Date(s.sold_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}</p>
                    </div>
                    <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: 14 }}>{fmtRs(s.sale_price)}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {selected && (
            <div>
              <label style={labelStyle}>Due date *</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                {[7, 14, 30].map((d) => (
                  <button key={d} type="button" onClick={() => setDueDate(quickDate(d))} style={quickBtnStyle}>{d} days</button>
                ))}
              </div>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ ...inputStyle, maxWidth: 240 }} />
            </div>
          )}

          <button onClick={submit} disabled={saving || !selected} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '12px 24px', color: 'var(--bg)', fontSize: 14, fontWeight: 600, cursor: saving || !selected ? 'not-allowed' : 'pointer', opacity: saving || !selected ? 0.6 : 1, alignSelf: 'flex-start' }}>
            {saving ? 'Saving…' : 'Create Udhaar'}
          </button>
        </>
      )}
    </div>
  )
}

// ─── Mode B: standalone ──────────────────────────────────────────────────────

function StandaloneMode({ shopId, onDone }: { shopId: string; onDone: (p: DonePayload) => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [description, setDescription] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [manualTotal, setManualTotal] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [cnic, setCnic] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const itemized = items.filter((i) => i.name.trim() && parseFloat(i.price) > 0)
  const itemsTotal = itemized.reduce((s, i) => s + parseFloat(i.price), 0)
  const hasItems = items.length > 0
  const total = hasItems ? itemsTotal : parseFloat(manualTotal) || 0

  const submit = async () => {
    if (!name.trim()) { toast.error('Customer name is required'); return }
    if (!phone.trim()) { toast.error('Phone is required'); return }
    if (!dueDate) { toast.error('Due date is required'); return }
    if (total <= 0) { toast.error('Enter a total amount (or add items)'); return }
    setSaving(true)
    const supabase = createClient()

    // Best-effort CNIC upload (storage still uses client — bucket access doesn't need service role)
    let cnic_photo_url: string | null = null
    if (cnic) {
      try {
        const path = `${shopId}/${Date.now()}.jpg`
        const { data } = await supabase.storage.from('cnic-photos').upload(path, cnic, { upsert: true, contentType: cnic.type || 'image/jpeg' })
        if (data) cnic_photo_url = supabase.storage.from('cnic-photos').getPublicUrl(path).data.publicUrl
      } catch { /* non-blocking */ }
    }

    const res = await fetch('/api/udhaar/create-owner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shop_id: shopId,
        mode: hasItems ? 'item_based' : 'value_based',
        customer_name: name.trim(),
        customer_phone: phone.replace(/\D/g, '').slice(0, 11),
        total_amount: total,
        amount_paid: 0,
        amount_remaining: total,
        description: description.trim() || null,
        notes: notes.trim() || null,
        items: itemized.map((i) => ({ name: i.name.trim(), price: parseFloat(i.price) })),
        due_date: dueDate,
        cnic_photo_url,
        status: 'pending',
        approved_by_owner: true,
      }),
    })
    setSaving(false)
    if (!res.ok) { toast.error('Something went wrong. Please try again.'); return }
    toast.success('Udhaar recorded')
    onDone({ customerName: name.trim(), amount: total, dueDate })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <label style={labelStyle}>Customer name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Phone *</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03XXXXXXXXX" style={inputStyle} />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Description — what they took</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Charger + mouse + bag" style={inputStyle} />
      </div>

      {/* Items list */}
      <div>
        <label style={labelStyle}>Items (optional)</label>
        {items.map((it, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input value={it.name} onChange={(e) => setItems((p) => p.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} placeholder="Item name" style={{ ...inputStyle, flex: 1 }} />
            <input type="number" value={it.price} onChange={(e) => setItems((p) => p.map((x, idx) => idx === i ? { ...x, price: e.target.value } : x))} placeholder="Price" style={{ ...inputStyle, width: 120 }} />
            <button onClick={() => setItems((p) => p.filter((_, idx) => idx !== i))} style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 8, padding: '0 12px', color: 'var(--danger)', cursor: 'pointer' }}><Trash2 size={14} /></button>
          </div>
        ))}
        <button onClick={() => setItems((p) => [...p, { name: '', price: '' }])} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', color: 'var(--text-2)', fontSize: 13, cursor: 'pointer' }}>
          <Plus size={13} /> Add item
        </button>
      </div>

      {/* Total */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <label style={labelStyle}>Total amount (Rs) *</label>
          {hasItems ? (
            <div style={{ ...inputStyle, fontWeight: 700, fontSize: 18, display: 'flex', alignItems: 'center' }}>{fmtRs(itemsTotal)}</div>
          ) : (
            <input type="number" value={manualTotal} onChange={(e) => setManualTotal(e.target.value)} placeholder="0" style={{ ...inputStyle, fontWeight: 700, fontSize: 18 }} />
          )}
          {hasItems && <p style={{ color: 'var(--text-3)', fontSize: 11, marginTop: 4 }}>Auto-calculated from items</p>}
        </div>
        <div>
          <label style={labelStyle}>Due date *</label>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            {[7, 14, 30].map((d) => (
              <button key={d} type="button" onClick={() => setDueDate(quickDate(d))} style={quickBtnStyle}>{d} days</button>
            ))}
          </div>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} />
        </div>
      </div>

      {/* CNIC + notes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <label style={labelStyle}>CNIC photo (optional)</label>
          <input type="file" accept="image/*" onChange={(e) => setCnic(e.target.files?.[0] ?? null)} style={{ ...inputStyle, padding: '7px 10px', fontSize: 12 }} />
          {cnic && <p style={{ color: 'var(--success)', fontSize: 12, marginTop: 4 }}>✓ {cnic.name}</p>}
        </div>
        <div>
          <label style={labelStyle}>Notes (optional)</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to remember" style={inputStyle} />
        </div>
      </div>

      <button onClick={submit} disabled={saving} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '12px 24px', color: 'var(--bg)', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, alignSelf: 'flex-start' }}>
        {saving ? 'Saving…' : 'Record Udhaar'}
      </button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewUdhaarPage() {
  const router = useRouter()
  const { shop } = useShop()
  const [mode, setMode] = useState<Mode>('standalone')
  const [success, setSuccess] = useState<DonePayload | null>(null)
  const [key, setKey] = useState(0)

  const done = (p: DonePayload) => setSuccess(p)

  const addAnother = () => {
    setSuccess(null)
    setKey((k) => k + 1)
  }

  const fmtDue = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) }
    catch { return iso }
  }

  return (
    <div style={{ maxWidth: 640, marginInline: 'auto' }}>
      <Link href="/udhaar" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-3)', fontSize: 13, textDecoration: 'none', marginBottom: 20 }}>
        <ArrowLeft size={14} /> Back to udhaar
      </Link>

      <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 32, marginBottom: 18 }}>New Customer Udhaar</h1>

      {success ? (
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14, padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Check size={28} style={{ color: 'var(--success)' }} />
          </div>
          <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 20, marginBottom: 6 }}>
            Udhaar recorded for {success.customerName}
          </h2>
          <p style={{ color: 'var(--text-3)', fontSize: 14, marginBottom: 28 }}>
            Rs {Math.round(success.amount).toLocaleString('en-PK')} due on {fmtDue(success.dueDate)}
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={addAnother} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '10px 20px', color: 'var(--bg)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
              Add Another
            </button>
            <button onClick={() => router.push('/udhaar')} style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 20px', color: 'var(--text-2)', fontWeight: 500, fontSize: 14, cursor: 'pointer' }}>
              View Udhaar
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            {([['standalone', 'Standalone', FileText], ['linked', 'Linked to a sale', Link2]] as [Mode, string, typeof FileText][]).map(([m, label, Icon]) => {
              const active = mode === m
              return (
                <button key={m} onClick={() => setMode(m)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: active ? 'var(--accent-bg)' : 'var(--bg-2)', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, padding: '9px 16px', color: active ? 'var(--accent-2)' : 'var(--text-2)', fontWeight: active ? 600 : 500, fontSize: 13, cursor: 'pointer' }}>
                  <Icon size={15} /> {label}
                </button>
              )
            })}
          </div>

          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px' }}>
            {!shop ? (
              <p style={{ color: 'var(--text-3)', fontSize: 14 }}>Loading…</p>
            ) : mode === 'linked' ? (
              <LinkedMode key={`linked-${key}`} shopId={shop.id} onDone={done} />
            ) : (
              <StandaloneMode key={`standalone-${key}`} shopId={shop.id} onDone={done} />
            )}
          </div>
        </>
      )}
    </div>
  )
}
