'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowRight, CheckCircle, Laptop, Package, DollarSign, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Shop } from '@/lib/types'
import { localDayISO } from '@/lib/utils/daily-accounting'

// ─── Shared UI ────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-3)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '10px 14px',
  color: 'var(--text)',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

function Field({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ color: 'var(--text-2)', fontSize: 13, fontWeight: 500, display: 'block', marginBottom: sub ? 2 : 6 }}>{label}</label>
      {sub && <p style={{ color: 'var(--text-3)', fontSize: 12, marginBottom: 6 }}>{sub}</p>}
      {children}
    </div>
  )
}

function ProgressBar({ step, total }: { step: number; total: number }) {
  const pct = Math.round((step / total) * 100)
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12, color: 'var(--text-3)' }}>
        <span>Step {step} of {total}</span>
        <span>{pct}%</span>
      </div>
      <div style={{ width: '100%', height: 4, background: 'var(--bg-3)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 4, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  )
}

function StepIcon({ icon: Icon }: { icon: React.ElementType }) {
  return (
    <div style={{ width: 48, height: 48, background: 'var(--accent-bg)', border: '1px solid var(--accent-3)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
      <Icon size={22} style={{ color: 'var(--accent-2)' }} />
    </div>
  )
}

// ─── Step 0: Shop setup ───────────────────────────────────────────────────────

function StepShopSetup({ shop, onSaved }: { shop: Shop; onSaved: (name: string, ownerName: string) => void }) {
  const [shopName, setShopName] = useState(shop.name === 'My Shop' ? '' : shop.name)
  const [city, setCity] = useState('')
  const [ownerName, setOwnerName] = useState(shop.owner_name ?? '')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shopName.trim()) { toast.error('Shop name is required'); return }
    if (!city.trim()) { toast.error('City is required'); return }
    if (!ownerName.trim()) { toast.error('Owner name is required'); return }

    setLoading(true)
    const supabase = createClient()
    const fullName = city.trim() ? `${shopName.trim()}` : shopName.trim()
    const { error } = await supabase
      .from('shops')
      .update({ name: fullName, owner_name: ownerName.trim() })
      .eq('id', shop.id)
    setLoading(false)
    if (error) { toast.error('Something went wrong. Please try again.'); return }
    onSaved(fullName, ownerName.trim())
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ width: 56, height: 56, background: 'var(--accent-bg)', border: '1px solid var(--accent-3)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <Zap size={24} style={{ color: 'var(--accent-2)' }} />
        </div>
        <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 22, marginBottom: 6 }}>
          Welcome to ShopBoss!
        </h1>
        <p style={{ color: 'var(--text-2)', fontSize: 14 }}>
          Let&apos;s set up your shop.
        </p>
      </div>

      <Field label="Shop name *">
        <input
          style={inputStyle}
          placeholder="e.g. Fine Computers"
          value={shopName}
          onChange={(e) => setShopName(e.target.value)}
          required
          autoFocus
        />
      </Field>

      <Field label="City *">
        <input
          style={inputStyle}
          placeholder="e.g. Karachi"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          required
        />
      </Field>

      <Field label="Owner name *">
        <input
          style={inputStyle}
          placeholder="e.g. Ahmed Ali"
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          required
        />
      </Field>

      <button
        type="submit"
        disabled={loading}
        style={{
          background: 'var(--accent)', color: 'var(--bg)', border: 'none',
          borderRadius: 8, padding: '13px', fontWeight: 600, fontSize: 15,
          cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4,
        }}
      >
        {loading ? 'Saving…' : 'Get Started'} {!loading && <ArrowRight size={16} />}
      </button>
    </form>
  )
}

// ─── Step 1: Welcome ──────────────────────────────────────────────────────────

function StepWelcome({ shop, onNext }: { shop: Shop; onNext: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '24px 0' }}>
      <div style={{ width: 64, height: 64, background: 'var(--accent-bg)', border: '1px solid var(--accent-3)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
        <Zap size={28} style={{ color: 'var(--accent-2)' }} />
      </div>

      <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 24, marginBottom: 10, lineHeight: 1.3 }}>
        Welcome to ShopBoss,<br />
        <span style={{ color: 'var(--accent-2)' }}>{shop.owner_name}</span>!
      </h1>
      <p style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 4 }}>{shop.name}</p>

      <p style={{ color: 'var(--text-2)', fontSize: 15, lineHeight: 1.7, maxWidth: 380, margin: '16px auto 28px' }}>
        Let&apos;s set up your shop in 3 quick steps. Add your first laptop, accessories, and opening cash — then you&apos;re ready.
      </p>

      <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px', marginBottom: 28, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          { icon: Laptop, label: 'Add your first laptop to inventory' },
          { icon: Package, label: 'Add your first accessory category' },
          { icon: DollarSign, label: 'Set your opening cash balance' },
        ].map(({ icon: Icon, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span style={{ color: 'var(--text-2)', fontSize: 14 }}>{label}</span>
          </div>
        ))}
      </div>

      <button onClick={onNext} style={{ background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: 8, padding: '13px 32px', fontWeight: 600, fontSize: 15, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        Let&apos;s start <ArrowRight size={16} />
      </button>
    </div>
  )
}

// ─── Step 2: First Laptop ─────────────────────────────────────────────────────

function StepLaptop({ shopId, onNext, onSkip }: { shopId: string; onNext: () => void; onSkip: () => void }) {
  const [form, setForm] = useState({ imei: '', brand: '', model: '', purchase_price: '', asking_price: '', condition: 'Good' })
  const [loading, setLoading] = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.imei.trim().length > 0 && form.imei.trim().length < 5) { toast.error('Serial number must be at least 5 characters'); return }
    if (!form.brand.trim() || !form.model.trim()) { toast.error('Brand and model are required'); return }
    if (!form.purchase_price) { toast.error('Purchase price is required'); return }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('laptops').insert({
      shop_id: shopId,
      imei: form.imei.trim() || null,
      brand: form.brand.trim(),
      model: form.model.trim(),
      purchase_price: parseFloat(form.purchase_price),
      asking_price: form.asking_price ? parseFloat(form.asking_price) : parseFloat(form.purchase_price) * 1.1,
      condition: form.condition,
      status: 'in_stock',
    })
    setLoading(false)
    if (error) { toast.error('Something went wrong. Please try again.'); return }
    toast.success('Laptop added to inventory!')
    onNext()
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <StepIcon icon={Laptop} />
        <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 20, marginBottom: 6 }}>Add your first laptop</h2>
        <p style={{ color: 'var(--text-2)', fontSize: 14 }}>This will be the first entry in your stock system.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <Field label="Serial Number (optional)" sub="IMEI, service tag, or any serial number">
            <input style={inputStyle} placeholder="e.g. 354546112233445 or SVC-TAG" value={form.imei}
              onChange={e => setForm(p => ({ ...p, imei: e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() }))}
              maxLength={30} />
          </Field>
        </div>
        <Field label="Brand *">
          <input style={inputStyle} placeholder="e.g. Dell, HP, Lenovo" value={form.brand} onChange={set('brand')} required />
        </Field>
        <Field label="Model *">
          <input style={inputStyle} placeholder="e.g. Latitude 5420" value={form.model} onChange={set('model')} required />
        </Field>
        <Field label="Purchase price (Rs) *">
          <input type="number" style={inputStyle} placeholder="85000" value={form.purchase_price} onChange={set('purchase_price')} min="0" required />
        </Field>
        <Field label="Asking price (Rs)" sub="Leave blank to auto-set at +10%">
          <input type="number" style={inputStyle} placeholder="auto" value={form.asking_price} onChange={set('asking_price')} min="0" />
        </Field>
        <div style={{ gridColumn: '1 / -1' }}>
          <Field label="Condition">
            <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.condition} onChange={set('condition')}>
              {['New', 'Like New', 'Good', 'Fair', 'Poor'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4 }}>
        <button type="submit" disabled={loading}
          style={{ flex: 1, background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: 8, padding: '12px', fontWeight: 600, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {loading ? 'Adding…' : 'Add laptop'} {!loading && <ArrowRight size={16} />}
        </button>
        <button type="button" onClick={onSkip} style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          Skip →
        </button>
      </div>
    </form>
  )
}

// ─── Step 3: First Accessory Category ────────────────────────────────────────

function StepAccessory({ shopId, onNext, onSkip }: { shopId: string; onNext: () => void; onSkip: () => void }) {
  const [name, setName] = useState('')
  const [costPerUnit, setCostPerUnit] = useState('')
  const [displayQty, setDisplayQty] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { toast.error('Category name is required'); return }
    if (!costPerUnit || Number(costPerUnit) <= 0) { toast.error('Cost per unit must be greater than 0'); return }
    setLoading(true)
    const supabase = createClient()
    const qty = Number(displayQty) || 0
    const totalValue = qty * Number(costPerUnit)
    const { error } = await supabase.from('accessory_categories').insert({
      shop_id: shopId,
      name: name.trim(),
      cost_per_unit: parseFloat(costPerUnit),
      display_qty: qty,
      total_value_added: totalValue,
      total_value_sold: 0,
      units_restocked: qty,
      units_sold: 0,
    })
    setLoading(false)
    if (error) { toast.error('Something went wrong. Please try again.'); return }
    toast.success('Accessory category created!')
    onNext()
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <StepIcon icon={Package} />
        <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 20, marginBottom: 6 }}>Add your first accessory</h2>
        <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.6 }}>
          Add one accessory category — things like chargers, cases, bags. You can add more later.
        </p>
      </div>

      <Field label="Category name *" sub="e.g. Laptop Chargers, Mouse, Laptop Bags">
        <input style={inputStyle} placeholder="e.g. Chargers" value={name} onChange={e => setName(e.target.value)} required />
      </Field>
      <Field label="Cost per unit (Rs) *" sub="Your purchase cost for each piece">
        <input type="number" style={inputStyle} placeholder="e.g. 1500" value={costPerUnit} onChange={e => setCostPerUnit(e.target.value)} min="1" required />
      </Field>
      <Field label="Current stock (units)" sub="How many do you have right now? (optional)">
        <input type="number" style={inputStyle} placeholder="e.g. 10" value={displayQty} onChange={e => setDisplayQty(e.target.value)} min="0" />
      </Field>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4 }}>
        <button type="submit" disabled={loading}
          style={{ flex: 1, background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: 8, padding: '12px', fontWeight: 600, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {loading ? 'Creating…' : 'Add category'} {!loading && <ArrowRight size={16} />}
        </button>
        <button type="button" onClick={onSkip} style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          Skip →
        </button>
      </div>
    </form>
  )
}

// ─── Step 4: Opening Cash ─────────────────────────────────────────────────────

function StepOpeningCash({ shopId, onFinish }: { shopId: string; onFinish: () => void }) {
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const opening = parseFloat(amount) || 0
    setLoading(true)
    const supabase = createClient()
    const today = localDayISO()
    const { error } = await supabase.from('daily_cash_records').upsert({
      shop_id: shopId,
      record_date: today,
      opening_balance: opening,
      closing_balance_expected: opening,
      is_closed: false,
    }, { onConflict: 'shop_id,record_date' })
    setLoading(false)
    if (error) { toast.error('Something went wrong. Please try again.'); return }
    toast.success('Opening balance set!')
    onFinish()
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <StepIcon icon={DollarSign} />
        <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 20, marginBottom: 6 }}>Set your opening cash</h2>
        <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.6 }}>
          How much cash is in your drawer right now? This is the starting balance for today.
        </p>
      </div>

      <Field label="Opening balance (Rs)" sub="Count the cash in your drawer and enter the total">
        <input
          type="number"
          style={{ ...inputStyle, fontSize: 22, fontWeight: 700, textAlign: 'center', padding: '14px' }}
          placeholder="0"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          min="0"
          autoFocus
        />
      </Field>

      <div style={{ background: 'var(--info-bg)', border: '1px solid var(--info-border)', borderRadius: 8, padding: '12px 16px' }}>
        <p style={{ color: 'var(--info)', fontSize: 13, lineHeight: 1.6 }}>
          You can skip this for now. You can set the opening balance any time from the Cash page.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button type="submit" disabled={loading}
          style={{ flex: 1, background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: 8, padding: '13px', fontWeight: 600, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {loading ? 'Saving…' : 'Set opening balance'} {!loading && <ArrowRight size={16} />}
        </button>
        <button type="button" onClick={onFinish} style={{ background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          Skip →
        </button>
      </div>
    </form>
  )
}

// ─── Done screen ──────────────────────────────────────────────────────────────

function StepDone() {
  return (
    <div style={{ textAlign: 'center', padding: '32px 0' }}>
      <div style={{ width: 64, height: 64, background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
        <CheckCircle size={32} style={{ color: 'var(--success)' }} />
      </div>
      <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 22, marginBottom: 10 }}>ShopBoss is ready!</h2>
      <p style={{ color: 'var(--text-2)', fontSize: 15, lineHeight: 1.7 }}>
        Your shop is set up. Redirecting to dashboard…
      </p>
    </div>
  )
}

// ─── Confetti ─────────────────────────────────────────────────────────────────

function useConfetti() {
  const fired = useRef(false)
  return () => {
    if (fired.current) return
    fired.current = true
    import('canvas-confetti').then(({ default: confetti }) => {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ['#C17F3E', '#E09A52', '#F0EDE6', '#4A8C6F'] })
    }).catch(() => {})
  }
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const [shop, setShop] = useState<Shop | null>(null)
  // 0=shop-setup (new), 1=welcome, 2=laptop, 3=accessory, 4=cash, 5=done
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const fireConfetti = useConfetti()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/login'); return }
      const { data: shopData } = await supabase.from('shops').select('*').eq('owner_id', user.id).maybeSingle()
      if (!shopData) {
        setLoading(false)
        setShop(null)
        return
      }
      const s = shopData as Shop
      setShop(s)
      // Skip setup step if shop is already configured
      if (s.owner_name && s.name !== 'My Shop') setStep(1)
      else setStep(0)
      setLoading(false)
    })
  }, [router])

  const handleShopSaved = (name: string, ownerName: string) => {
    if (shop) setShop({ ...shop, name, owner_name: ownerName })
    fireConfetti()
    router.replace('/dashboard')
  }

  const handleFinish = () => {
    fireConfetti()
    setStep(5)
    toast.success('ShopBoss is ready!', { duration: 3000 })
    setTimeout(() => router.replace('/dashboard'), 2000)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ color: 'var(--text-3)', fontSize: 14 }}>Loading…</div>
      </div>
    )
  }

  if (!shop) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--danger-border)', borderRadius: 14, padding: '32px 28px', maxWidth: 420, textAlign: 'center' }}>
          <p style={{ color: 'var(--danger)', fontWeight: 600, fontSize: 16, marginBottom: 8 }}>Shop setup incomplete.</p>
          <p style={{ color: 'var(--text-2)', fontSize: 14 }}>Please contact support on WhatsApp: 03287800087</p>
        </div>
      </div>
    )
  }

  const TOTAL_STEPS = 3 // steps 2, 3, 4

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 500, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, padding: '32px 28px' }}>
        {step >= 2 && step <= 4 && <ProgressBar step={step - 1} total={TOTAL_STEPS} />}

        {step === 0 && <StepShopSetup shop={shop} onSaved={handleShopSaved} />}
        {step === 1 && <StepWelcome shop={shop} onNext={() => setStep(2)} />}
        {step === 2 && <StepLaptop shopId={shop.id} onNext={() => setStep(3)} onSkip={() => setStep(3)} />}
        {step === 3 && <StepAccessory shopId={shop.id} onNext={() => setStep(4)} onSkip={() => setStep(4)} />}
        {step === 4 && <StepOpeningCash shopId={shop.id} onFinish={handleFinish} />}
        {step === 5 && <StepDone />}
      </div>
    </div>
  )
}
