'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useShop } from '@/hooks/useShop'
import { ArrowLeft, CheckCircle, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

interface Category {
  id: string
  name: string
  cost_per_unit: number
  display_qty: number
  last_spot_check_at: string | null
}

const fmtRs = (n: number) => `Rs ${Math.round(n).toLocaleString('en-PK')}`

export default function OwnerVerifyPage() {
  const { shop } = useShop()
  const [categories, setCategories] = useState<Category[]>([])
  const [selected, setSelected] = useState<Category | null>(null)
  const [count, setCount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ declared: number; expected: number; drift: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!shop) return
    const supabase = createClient()
    supabase.from('accessory_categories').select('id, name, cost_per_unit, display_qty, last_spot_check_at').eq('shop_id', shop.id).order('name')
      .then(({ data }) => { setCategories((data ?? []) as Category[]); setLoading(false) })
  }, [shop])

  const handleVerify = async () => {
    if (!shop || !selected) return
    const declared = parseInt(count, 10)
    if (isNaN(declared) || declared < 0) { toast.error('Enter a valid count'); return }
    setSubmitting(true)

    const supabase = createClient()

    // Update last_spot_check_at + record drift
    await supabase.from('accessory_categories').update({
      last_spot_check_at: new Date().toISOString(),
      last_spot_check_declared: declared,
      last_spot_check_expected: selected.display_qty,
    }).eq('id', selected.id)

    // Insert as an 'adjustment' transaction if there's drift
    const drift = selected.display_qty - declared
    if (drift !== 0) {
      await supabase.from('accessory_transactions').insert({
        shop_id: shop.id,
        category_id: selected.id,
        worker_id: shop.owner_id,
        transaction_type: 'adjustment',
        units: Math.abs(drift),
        value: Math.abs(drift) * selected.cost_per_unit,
        note: `Owner verification — ${drift > 0 ? drift + ' missing' : Math.abs(drift) + ' over'}`,
      })
      // Correct display_qty to match owner count
      await supabase.from('accessory_categories').update({ display_qty: declared }).eq('id', selected.id)
    }

    setSubmitting(false)
    setResult({ declared, expected: selected.display_qty, drift })
    toast.success('Verification recorded')
  }

  const reset = () => { setSelected(null); setCount(''); setResult(null) }

  if (loading) return <div style={{ color: 'var(--text-3)', fontSize: 14 }}>Loading…</div>

  return (
    <div style={{ maxWidth: 540, marginInline: 'auto' }}>
      <Link href="/accessories" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-3)', fontSize: 13, textDecoration: 'none', marginBottom: 20 }}>
        <ArrowLeft size={14} /> Back to Accessories
      </Link>

      <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 22, marginBottom: 4 }}>Owner Verification</h1>
      <p style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 24 }}>
        Your count won&apos;t be shown to workers. Results update the system and record drift if any.
      </p>

      {result ? (
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '28px 24px', textAlign: 'center' }}>
          {result.drift === 0 ? (
            <>
              <CheckCircle size={48} style={{ color: 'var(--success)', marginBottom: 12 }} />
              <p style={{ color: 'var(--success)', fontWeight: 700, fontSize: 18, marginBottom: 8 }}>✓ Perfect match</p>
              <p style={{ color: 'var(--text-3)', fontSize: 14 }}>Your count matches the system exactly.</p>
            </>
          ) : (
            <>
              <AlertTriangle size={48} style={{ color: 'var(--warning)', marginBottom: 12 }} />
              <p style={{ color: 'var(--warning)', fontWeight: 700, fontSize: 18, marginBottom: 8 }}>
                {Math.abs(result.drift)} unit{Math.abs(result.drift) !== 1 ? 's' : ''} {result.drift > 0 ? 'missing' : 'over'}
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 16 }}>
                <div>
                  <p style={{ color: 'var(--text-3)', fontSize: 11, textTransform: 'uppercase' }}>System said</p>
                  <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: 20 }}>{result.expected}</p>
                </div>
                <div>
                  <p style={{ color: 'var(--text-3)', fontSize: 11, textTransform: 'uppercase' }}>You counted</p>
                  <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: 20 }}>{result.declared}</p>
                </div>
                <div>
                  <p style={{ color: 'var(--text-3)', fontSize: 11, textTransform: 'uppercase' }}>Drift value</p>
                  <p style={{ color: 'var(--danger)', fontWeight: 700, fontSize: 20 }}>{fmtRs(Math.abs(result.drift) * (selected?.cost_per_unit ?? 0))}</p>
                </div>
              </div>
              <p style={{ color: 'var(--text-3)', fontSize: 13 }}>System updated to your count. Adjustment logged.</p>
            </>
          )}
          <button onClick={reset} style={{ marginTop: 20, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 24px', color: 'var(--text-2)', cursor: 'pointer', fontSize: 14 }}>
            Verify another
          </button>
        </div>
      ) : (
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Category select */}
          <div>
            <label style={{ display: 'block', color: 'var(--text-2)', fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Select category *</label>
            <select
              value={selected?.id ?? ''}
              onChange={(e) => {
                const cat = categories.find((c) => c.id === e.target.value) ?? null
                setSelected(cat)
                setCount('')
                setResult(null)
              }}
              style={{ width: '100%', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px', color: 'var(--text)', fontSize: 14, outline: 'none' }}
            >
              <option value="">Choose a category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (system: {c.display_qty} units)
                </option>
              ))}
            </select>
          </div>

          {selected && (
            <>
              <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
                <p style={{ color: 'var(--text-2)', fontSize: 13 }}>System expects: <strong style={{ color: 'var(--text)' }}>{selected.display_qty} units</strong></p>
                <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 3 }}>
                  {selected.last_spot_check_at
                    ? `Last verified ${Math.floor((Date.now() - new Date(selected.last_spot_check_at).getTime()) / 86_400_000)} days ago`
                    : 'Never verified by owner'}
                </p>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text-2)', fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Your physical count *
                </label>
                <input
                  type="number"
                  min={0}
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                  placeholder="Count and enter…"
                  autoFocus
                  style={{ width: '100%', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px', color: 'var(--text)', fontSize: 28, fontWeight: 700, outline: 'none', textAlign: 'center', boxSizing: 'border-box' }}
                />
              </div>

              <button
                onClick={handleVerify}
                disabled={submitting || !count}
                style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '13px', color: 'var(--bg)', fontWeight: 600, fontSize: 15, cursor: submitting || !count ? 'not-allowed' : 'pointer', opacity: submitting || !count ? 0.7 : 1 }}
              >
                {submitting ? 'Saving…' : 'Record Verification'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
