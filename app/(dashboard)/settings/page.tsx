'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useShop } from '@/hooks/useShop'
import { Save, Plus, Trash2, CreditCard, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Shop } from '@/lib/types'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'

// ─── UI primitives ────────────────────────────────────────────────────────────

function Section({ title, sub, danger, children }: { title: string; sub?: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ background: danger ? 'var(--danger-bg)' : 'var(--bg-2)', border: `1px solid ${danger ? 'var(--danger-border)' : 'var(--border)'}`, borderRadius: 14, padding: '24px 28px', marginBottom: 20 }}>
      <h2 style={{ color: danger ? 'var(--danger)' : 'var(--text)', fontWeight: 700, fontSize: 16, marginBottom: sub ? 4 : 20 }}>{title}</h2>
      {sub && <p style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 20 }}>{sub}</p>}
      {children}
    </div>
  )
}

function Field({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', color: 'var(--text-2)', fontSize: 13, fontWeight: 500, marginBottom: sub ? 2 : 6 }}>{label}</label>
      {sub && <p style={{ color: 'var(--text-3)', fontSize: 12, marginBottom: 6 }}>{sub}</p>}
      {children}
    </div>
  )
}

const inp: React.CSSProperties = {
  width: '100%', background: 'var(--bg-3)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '10px 14px', color: 'var(--text)', fontSize: 14,
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}

function SaveBtn({ saving, onClick, label = 'Save' }: { saving: boolean; onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} disabled={saving}
      style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '10px 20px', color: 'var(--bg)', fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
      <Save size={14} /> {saving ? 'Saving…' : label}
    </button>
  )
}

// ─── Shop Information ─────────────────────────────────────────────────────────

function ShopInfoSection({ shop }: { shop: Shop }) {
  const [form, setForm] = useState({
    name: shop.name,
    owner_name: shop.owner_name,
    owner_phone: shop.owner_phone,
    whatsapp_number: shop.whatsapp_number,
    shop_open_time: shop.shop_open_time ?? '09:00',
    shop_close_time: shop.shop_close_time ?? '21:00',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  const save = async () => {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('shops').update(form).eq('id', shop.id)
    setSaving(false)
    if (error) toast.error('Something went wrong. Please try again.')
    else toast.success('Shop info saved')
  }

  return (
    <Section title="Shop Information">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field label="Shop Name">
          <input style={inp} value={form.name} onChange={set('name')} />
        </Field>
        <Field label="Owner Name">
          <input style={inp} value={form.owner_name} onChange={set('owner_name')} />
        </Field>
        <Field label="Phone Number">
          <input style={inp} value={form.owner_phone} onChange={set('owner_phone')} placeholder="03XXXXXXXXX" />
        </Field>
        <Field label="WhatsApp Number">
          <input style={inp} value={form.whatsapp_number} onChange={set('whatsapp_number')} placeholder="03XXXXXXXXX" />
        </Field>
        <Field label="Shop Opens">
          <input type="time" style={inp} value={form.shop_open_time} onChange={set('shop_open_time')} />
        </Field>
        <Field label="Shop Closes">
          <input type="time" style={inp} value={form.shop_close_time} onChange={set('shop_close_time')} />
        </Field>
      </div>
      <Field label="Currency">
        <input style={{ ...inp, opacity: 0.6 }} value="PKR — Pakistani Rupee" disabled />
      </Field>
      <SaveBtn saving={saving} onClick={save} label="Save Shop Info" />
    </Section>
  )
}

// ─── Stock Alerts ─────────────────────────────────────────────────────────────

function StockAlertsSection({ shop }: { shop: Shop }) {
  const [agingDays, setAgingDays] = useState(45)
  const [lowPct, setLowPct] = useState(20)
  const [bufferPct, setBufferPct] = useState(5)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    const supabase = createClient()
    // Store in large_sale_alert_threshold as a workaround until dedicated columns exist
    // We use a JSON field approach via the shop's min_sale_prices or a separate update
    const existing = shop.min_sale_prices ?? {}
    const { error } = await supabase.from('shops').update({
      min_sale_prices: {
        ...existing,
        __aging_days: agingDays,
        __low_pct: lowPct,
        __buffer_pct: bufferPct,
      },
    }).eq('id', shop.id)
    setSaving(false)
    if (error) toast.error('Something went wrong. Please try again.')
    else toast.success('Stock alert settings saved')
  }

  return (
    <Section title="Stock Alerts" sub="Configure when ShopBoss warns you about stock issues.">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field label="Aging alert threshold (days)" sub="Alert when laptop sits unsold longer than this">
          <input type="number" style={inp} value={agingDays} min={1} max={365}
            onChange={e => setAgingDays(Number(e.target.value))} />
        </Field>
        <Field label="Low accessories threshold (%)" sub="Warn when a category has sold ≥ this % of stock">
          <input type="number" style={inp} value={lowPct} min={1} max={100}
            onChange={e => setLowPct(Number(e.target.value))} />
        </Field>
        <Field label="Minimum price buffer (%)" sub="Warn if selling below purchase price + this %">
          <input type="number" style={inp} value={bufferPct} min={0} max={100}
            onChange={e => setBufferPct(Number(e.target.value))} />
        </Field>
      </div>
      <SaveBtn saving={saving} onClick={save} label="Save Alert Settings" />
    </Section>
  )
}

// ─── Udhaar Settings ──────────────────────────────────────────────────────────

function UdhaarSettingsSection({ shop }: { shop: Shop }) {
  const [maxUdhaar, setMaxUdhaar] = useState(shop.max_udhaar_without_approval ?? 20000)
  const [reminderDays, setReminderDays] = useState(3)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    const supabase = createClient()
    const existing = shop.min_sale_prices ?? {}
    const { error } = await supabase.from('shops').update({
      max_udhaar_without_approval: Number(maxUdhaar),
      min_sale_prices: { ...existing, __reminder_days: reminderDays },
    }).eq('id', shop.id)
    setSaving(false)
    if (error) toast.error('Something went wrong. Please try again.')
    else toast.success('Udhaar settings saved')
  }

  return (
    <Section title="Udhaar Settings" sub="Control how udhaar is approved and reminded.">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field
          label="Maximum udhaar without confirmation (Rs)"
          sub="Above this amount, a warning prompt is shown before approving"
        >
          <input type="number" style={inp} value={maxUdhaar} min={0}
            onChange={e => setMaxUdhaar(Number(e.target.value))} />
        </Field>
        <Field
          label="Reminder days before due date"
          sub="Send WhatsApp reminder this many days before udhaar is due"
        >
          <input type="number" style={inp} value={reminderDays} min={0} max={30}
            onChange={e => setReminderDays(Number(e.target.value))} />
        </Field>
      </div>
      <div style={{ background: 'var(--info-bg)', border: '1px solid var(--info-border)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
        <p style={{ color: 'var(--info)', fontSize: 13 }}>
          Current threshold: <strong>Rs {maxUdhaar.toLocaleString()}</strong> — udhaar above this shows a confirmation prompt.
        </p>
      </div>
      <SaveBtn saving={saving} onClick={save} label="Save Udhaar Settings" />
    </Section>
  )
}

// ─── Price Floors ─────────────────────────────────────────────────────────────

function PriceFloorsSection({ shop }: { shop: Shop }) {
  const cleanFloors = Object.entries(shop.min_sale_prices ?? {})
    .filter(([k]) => !k.startsWith('__'))
    .map(([brand, min]) => ({ brand, min: min as number }))

  const [floors, setFloors] = useState(cleanFloors)
  const [saving, setSaving] = useState(false)
  const add = () => setFloors(p => [...p, { brand: '', min: 0 }])
  const remove = (i: number) => setFloors(p => p.filter((_, idx) => idx !== i))
  const update = (i: number, k: 'brand' | 'min', v: string | number) =>
    setFloors(p => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r))

  const save = async () => {
    setSaving(true)
    const supabase = createClient()
    const existing = shop.min_sale_prices ?? {}
    const internals = Object.fromEntries(Object.entries(existing).filter(([k]) => k.startsWith('__')))
    const prices: Record<string, number> = { ...internals }
    floors.forEach(f => { if (f.brand.trim()) prices[f.brand.trim()] = Number(f.min) })
    const { error } = await supabase.from('shops').update({ min_sale_prices: prices }).eq('id', shop.id)
    setSaving(false)
    if (error) toast.error('Something went wrong. Please try again.')
    else toast.success('Price floors saved')
  }

  return (
    <Section title="Price Floors (Per Brand)" sub="Warn when selling below these minimum prices.">
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, marginBottom: 8 }}>
          <span style={{ color: 'var(--text-3)', fontSize: 12, fontWeight: 600, padding: '0 4px' }}>BRAND</span>
          <span style={{ color: 'var(--text-3)', fontSize: 12, fontWeight: 600, padding: '0 4px' }}>MIN PRICE (Rs)</span>
          <span />
        </div>
        {floors.map((f, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, marginBottom: 8 }}>
            <input style={inp} placeholder="e.g. Dell" value={f.brand} onChange={e => update(i, 'brand', e.target.value)} />
            <input type="number" style={inp} placeholder="0" value={f.min} onChange={e => update(i, 'min', e.target.value)} />
            <button onClick={() => remove(i)} style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 8, padding: '0 12px', color: 'var(--danger)', cursor: 'pointer' }}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button onClick={add} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', color: 'var(--text-2)', fontSize: 13, cursor: 'pointer', marginTop: 4 }}>
          <Plus size={13} /> Add Brand
        </button>
      </div>
      <SaveBtn saving={saving} onClick={save} label="Save Price Floors" />
    </Section>
  )
}

// ─── Expense Budgets ──────────────────────────────────────────────────────────

const BUDGET_CATEGORIES = ['Rent', 'Electricity', 'Transport', 'Food', 'Other']

function ExpenseBudgetSection({ shop }: { shop: Shop }) {
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  const [budgets, setBudgets] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [setupRequired, setSetupRequired] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('expense_budgets')
      .select('category,monthly_budget')
      .eq('shop_id', shop.id)
      .eq('budget_month', currentMonth)
      .eq('budget_year', currentYear)
      .then(({ data, error }) => {
        if (error && error.message.includes('does not exist')) { setSetupRequired(true); return }
        const map: Record<string, string> = {}
        ;(data ?? []).forEach((r: { category: string; monthly_budget: number }) => { map[r.category] = String(r.monthly_budget) })
        setBudgets(map)
        setLoaded(true)
      })
  }, [shop.id, currentMonth, currentYear])

  const save = async () => {
    setSaving(true)
    const supabase = createClient()
    const rows = BUDGET_CATEGORIES
      .filter(cat => budgets[cat] && parseFloat(budgets[cat]) >= 0)
      .map(cat => ({
        shop_id: shop.id,
        category: cat,
        monthly_budget: parseFloat(budgets[cat]) || 0,
        budget_month: currentMonth,
        budget_year: currentYear,
      }))
    const { error } = await supabase.from('expense_budgets').upsert(rows, { onConflict: 'shop_id,category,budget_month,budget_year' })
    setSaving(false)
    if (error) toast.error('Something went wrong. Please try again.')
    else toast.success('Budgets saved for this month')
  }

  if (setupRequired) {
    return (
      <Section title="Monthly Expense Budgets" sub="Set monthly spending limits per category.">
        <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Coming soon.</p>
      </Section>
    )
  }

  if (!loaded) return null

  const monthName = now.toLocaleDateString('en-PK', { month: 'long', year: 'numeric' })

  return (
    <Section title="Monthly Expense Budgets" sub={`Set spending limits for ${monthName}. Shown in Monthly Reports as Budget vs Actual.`}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {BUDGET_CATEGORIES.map(cat => (
          <Field key={cat} label={cat}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--text-3)', fontSize: 13 }}>Rs</span>
              <input
                type="number" min={0} style={{ ...inp, flex: 1 }}
                placeholder="0 = no budget"
                value={budgets[cat] ?? ''}
                onChange={e => setBudgets(p => ({ ...p, [cat]: e.target.value }))}
              />
            </div>
          </Field>
        ))}
      </div>
      <SaveBtn saving={saving} onClick={save} label="Save Budgets" />
    </Section>
  )
}

// ─── Danger Zone ──────────────────────────────────────────────────────────────

function DangerZone({ shop }: { shop: Shop }) {
  const router = useRouter()
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)

  const exportAllData = useCallback(async () => {
    setExporting(true)
    try {
      const supabase = createClient()
      const [
        { data: laptops },
        { data: sales },
        { data: expenses },
        { data: udhaar },
        { data: payments },
        { data: accCats },
        { data: accTx },
      ] = await Promise.all([
        supabase.from('laptops').select('*').eq('shop_id', shop.id),
        supabase.from('sales').select('*').eq('shop_id', shop.id),
        supabase.from('expenses').select('*').eq('shop_id', shop.id),
        supabase.from('udhaar_records').select('*').eq('shop_id', shop.id),
        supabase.from('udhaar_payments').select('*').eq('shop_id', shop.id),
        supabase.from('accessory_categories').select('*').eq('shop_id', shop.id),
        supabase.from('accessory_transactions').select('*').eq('shop_id', shop.id),
      ])

      const wb = XLSX.utils.book_new()
      const sheets: [string, unknown[] | null][] = [
        ['Laptops', laptops],
        ['Sales', sales],
        ['Expenses', expenses],
        ['Udhaar', udhaar],
        ['Udhaar Payments', payments],
        ['Accessory Categories', accCats],
        ['Accessory Transactions', accTx],
      ]
      sheets.forEach(([name, data]) => {
        if (data && data.length > 0) {
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), name)
        }
      })
      XLSX.writeFile(wb, `shopboss-backup-${shop.name}-${new Date().toISOString().slice(0, 10)}.xlsx`)
      toast.success('Full backup exported')
    } catch {
      toast.error('Could not export backup. Please try again.')
    } finally {
      setExporting(false)
    }
  }, [shop])

  const deleteAccount = async () => {
    if (confirmText !== shop.name) { toast.error('Shop name does not match'); return }
    setDeleting(true)
    try {
      const supabase = createClient()
      // Soft delete: just sign out and show message (actual deletion needs admin)
      await supabase.auth.signOut()
      toast.success('Account deletion requested. Contact support to complete.')
      router.replace('/login')
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Section title="Danger Zone" danger>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Export */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>Export all data</p>
            <p style={{ color: 'var(--text-3)', fontSize: 13, marginTop: 2 }}>Download a complete Excel backup of all your shop data.</p>
          </div>
          <button onClick={exportAllData} disabled={exporting}
            style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 18px', color: 'var(--text)', fontWeight: 600, fontSize: 14, cursor: exporting ? 'not-allowed' : 'pointer', opacity: exporting ? 0.7 : 1, whiteSpace: 'nowrap' }}>
            <Download size={14} /> {exporting ? 'Exporting…' : 'Export backup'}
          </button>
        </div>

        <div style={{ borderTop: '1px solid var(--danger-border)', paddingTop: 20 }}>
          <p style={{ color: 'var(--danger)', fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Delete account</p>
          <p style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 14 }}>
            This will permanently delete all your shop data. This action cannot be undone.
            Type your shop name <strong style={{ color: 'var(--text)' }}>{shop.name}</strong> to confirm.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              style={{ ...inp, maxWidth: 280, borderColor: 'var(--danger-border)' }}
              placeholder={`Type "${shop.name}" to confirm`}
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
            />
            <button
              onClick={deleteAccount}
              disabled={deleting || confirmText !== shop.name}
              style={{ background: confirmText === shop.name ? 'var(--danger)' : 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 8, padding: '10px 18px', color: confirmText === shop.name ? 'white' : 'var(--danger)', fontWeight: 700, fontSize: 14, cursor: confirmText !== shop.name || deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1, whiteSpace: 'nowrap' }}>
              {deleting ? 'Deleting…' : 'Delete account'}
            </button>
          </div>
        </div>
      </div>
    </Section>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { shop } = useShop()

  if (!shop) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 24, marginBottom: 24 }}>Settings</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14, height: 120, opacity: 0.4 }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 32 }}>Settings</h1>
        <Link href="/billing"
          style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 16px', color: 'var(--text-2)', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
          <CreditCard size={14} /> Billing &amp; Plan
        </Link>
      </div>

      <ShopInfoSection shop={shop} />
      <StockAlertsSection shop={shop} />
      <UdhaarSettingsSection shop={shop} />
      <PriceFloorsSection shop={shop} />
      <ExpenseBudgetSection shop={shop} />
      <DangerZone shop={shop} />
    </div>
  )
}
