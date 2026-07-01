'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useShop } from '@/hooks/useShop'
import { localDayISO } from '@/lib/utils/daily-accounting'
import { ArrowLeft, Banknote, Landmark } from 'lucide-react'
import toast from 'react-hot-toast'

const CATEGORIES = ['Rent', 'Electricity', 'Stock purchase', 'Transport', 'Food', 'Salary', 'Other'] as const
type PayType = 'cash' | 'bank'

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg-3)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 14,
  outline: 'none', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  display: 'block', color: 'var(--text-2)', fontSize: 12, fontWeight: 600,
  marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5,
}

export default function ExpensePage() {
  const router = useRouter()
  const { shop } = useShop()
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<string>('Other')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(localDayISO())
  const [paymentType, setPaymentType] = useState<PayType>('cash')
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shop) return
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) { toast.error('Enter a valid amount'); return }
    if (!description.trim()) { toast.error('Description is required'); return }

    setSaving(true)
    const res = await fetch('/api/expenses/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shop_id: shop.id,
        amount: amt,
        category,
        description: description.trim(),
        payment_type: paymentType,
        expense_date: date || localDayISO(),
      }),
    })
    setSaving(false)
    if (!res.ok) { toast.error('Something went wrong. Please try again.'); return }
    toast.success('Expense logged')
    router.push('/cash')
  }

  return (
    <div style={{ maxWidth: 540, marginInline: 'auto' }}>
      <Link href="/cash" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-3)', fontSize: 13, textDecoration: 'none', marginBottom: 20 }}>
        <ArrowLeft size={14} /> Back to cash
      </Link>

      <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 32, marginBottom: 18 }}>Log an Expense</h1>

      <form onSubmit={submit} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Amount */}
        <div>
          <label style={labelStyle}>Amount (Rs) *</label>
          <input type="number" min={0} autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" style={{ ...inputStyle, fontSize: 22, fontWeight: 700, padding: '14px 16px' }} required />
        </div>

        {/* Category */}
        <div>
          <label style={labelStyle}>Category *</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIES.map((c) => {
              const active = category === c
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  style={{
                    background: active ? 'var(--accent-bg)' : 'var(--bg-3)',
                    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 8, padding: '8px 14px',
                    color: active ? 'var(--accent-2)' : 'var(--text-2)',
                    fontSize: 13, fontWeight: active ? 600 : 500, cursor: 'pointer',
                  }}
                >
                  {c}
                </button>
              )
            })}
          </div>
        </div>

        {/* Description */}
        <div>
          <label style={labelStyle}>Description *</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What was this expense for?" style={inputStyle} required />
        </div>

        {/* Date + payment */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={labelStyle}>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Payment</label>
            <div style={{ display: 'flex', gap: 0, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: 4 }}>
              {([['cash', 'Cash', Banknote], ['bank', 'Bank', Landmark]] as [PayType, string, typeof Banknote][]).map(([k, label, Icon]) => {
                const active = paymentType === k
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setPaymentType(k)}
                    style={{
                      flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      background: active ? 'var(--bg-2)' : 'transparent', border: 'none', borderRadius: 6, padding: '8px 0',
                      color: active ? 'var(--text)' : 'var(--text-3)', fontWeight: active ? 600 : 400, fontSize: 13, cursor: 'pointer',
                    }}
                  >
                    <Icon size={14} /> {label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {paymentType === 'bank' && (
          <p style={{ color: 'var(--text-3)', fontSize: 12, margin: 0 }}>
            Bank expenses count toward profit but don&apos;t reduce your cash drawer.
          </p>
        )}

        <button type="submit" disabled={saving} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '12px 24px', color: 'var(--bg)', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, alignSelf: 'flex-start' }}>
          {saving ? 'Saving…' : 'Log Expense'}
        </button>      </form>
    </div>
  )
}

