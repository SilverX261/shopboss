'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useShop } from '@/hooks/useShop'
import { loadDailyAccounting, localDayISO, type DailyAccounting } from '@/lib/utils/daily-accounting'
import { DailyPnL } from '@/components/cash/DailyPnL'
import { ArrowLeft, Lock, CheckCircle, AlertTriangle, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'

const fmtRs = (n: number) => `Rs ${Math.round(n).toLocaleString('en-PK')}`

export default function CloseDayPage() {
  const { shop } = useShop()
  const [acc, setAcc] = useState<DailyAccounting | null>(null)
  const [loading, setLoading] = useState(true)
  const [actualInput, setActualInput] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!shop) return
    const supabase = createClient()
    const data = await loadDailyAccounting(supabase, shop.id)
    setAcc(data)
    if (data.record?.notes) setNotes(data.record.notes)
    setLoading(false)
  }, [shop])

  useEffect(() => { load() }, [load])

  if (loading || !acc) return <div style={{ color: 'var(--text-3)', fontSize: 14 }}>Loading…</div>

  const closed = acc.record?.is_closed
  const actual = parseFloat(actualInput)
  const hasActual = !isNaN(actual) && actualInput !== ''
  const liveDiff = hasActual ? actual - acc.expectedDrawer : null

  const closeDay = async () => {
    if (!shop) return
    if (!acc.hasOpening) { toast.error('Set today’s opening balance first'); return }
    if (!hasActual || actual < 0) { toast.error('Enter the actual counted cash'); return }
    setSaving(true)
    const supabase = createClient()
    const difference = actual - acc.expectedDrawer
    const { error } = await supabase
      .from('daily_cash_records')
      .upsert(
        {
          shop_id: shop.id,
          record_date: localDayISO(),
          opening_balance: acc.opening,
          closing_balance_expected: acc.expectedDrawer,
          closing_balance_actual: actual,
          difference,
          is_closed: true,
          notes: notes.trim() || null,
        },
        { onConflict: 'shop_id,record_date' },
      )
    setSaving(false)
    if (error) { toast.error('Something went wrong. Please try again.'); return }
    toast.success('Day closed')
    load()
  }

  return (
    <div style={{ maxWidth: 720, marginInline: 'auto' }}>
      <Link href="/cash" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-3)', fontSize: 13, textDecoration: 'none', marginBottom: 20 }}>
        <ArrowLeft size={14} /> Back to cash
      </Link>

      <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 32, marginBottom: 4 }}>
        {closed ? 'Day Closed' : 'Close Day'}
      </h1>
      <p style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 20 }}>
        {new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long' })}
      </p>

      {!acc.hasOpening && !closed && (
        <div style={{ background: 'var(--warning-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
          <AlertTriangle size={16} style={{ color: 'var(--warning)' }} />
          <p style={{ color: 'var(--warning)', fontSize: 13 }}>Set today&apos;s opening balance on the cash page before closing.</p>
        </div>
      )}

      {!closed ? (
        <>
          {/* Expected + count input */}
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '22px', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-2)', fontSize: 14 }}>Expected cash in drawer</span>
              <span style={{ color: 'var(--text)', fontWeight: 800, fontSize: 22 }}>{fmtRs(acc.expectedDrawer)}</span>
            </div>

            <label style={{ display: 'block', color: 'var(--text-2)', fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Count the physical cash and enter the actual amount
            </label>
            <input
              type="number" min={0} autoFocus
              value={actualInput}
              onChange={(e) => setActualInput(e.target.value)}
              placeholder="0"
              style={{ width: '100%', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', color: 'var(--text)', fontSize: 24, fontWeight: 700, outline: 'none', textAlign: 'center', boxSizing: 'border-box', marginBottom: 16 }}
            />

            {/* Live match/short/over */}
            {liveDiff != null && (
              <div style={{
                borderRadius: 10, padding: '14px 16px', textAlign: 'center',
                background: liveDiff === 0 ? 'var(--success-bg)' : liveDiff < 0 ? 'var(--danger-bg)' : 'var(--warning-bg)',
                border: `1px solid ${liveDiff === 0 ? 'var(--success-border)' : liveDiff < 0 ? 'var(--danger-border)' : 'var(--border)'}`,
              }}>
                {liveDiff === 0 ? (
                  <p style={{ color: 'var(--success)', fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <CheckCircle size={16} /> Match — drawer balances perfectly
                  </p>
                ) : liveDiff < 0 ? (
                  <p style={{ color: 'var(--danger)', fontWeight: 700, fontSize: 15 }}>
                    Short by {fmtRs(Math.abs(liveDiff))} — Rs {Math.abs(Math.round(liveDiff)).toLocaleString('en-PK')} unaccounted for today
                  </p>
                ) : (
                  <p style={{ color: 'var(--warning)', fontWeight: 700, fontSize: 15 }}>
                    Over by {fmtRs(liveDiff)} — extra cash, possible unrecorded sale?
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', color: 'var(--text-2)', fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Anything notable about today's cash…" style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5 }} />
          </div>

          <button
            onClick={closeDay}
            disabled={saving || !acc.hasOpening || !hasActual}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '12px 26px', color: 'var(--bg)', fontSize: 15, fontWeight: 700, cursor: saving || !acc.hasOpening || !hasActual ? 'not-allowed' : 'pointer', opacity: saving || !acc.hasOpening || !hasActual ? 0.6 : 1 }}
          >
            <Lock size={16} /> {saving ? 'Closing…' : 'Close Day'}
          </button>
        </>
      ) : (
        <>
          {/* Closed banner */}
          <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
            <CheckCircle size={16} style={{ color: 'var(--success)' }} />
            <p style={{ color: 'var(--success)', fontSize: 14, fontWeight: 600 }}>
              Day closed. Actual cash: {fmtRs(acc.record?.closing_balance_actual ?? 0)}
              {acc.record?.difference != null && acc.record.difference !== 0 && (
                <span style={{ fontWeight: 400 }}>
                  {' '}({acc.record.difference < 0 ? 'short' : 'over'} {fmtRs(Math.abs(acc.record.difference))})
                </span>
              )}
            </p>
          </div>

          {/* P&L summary */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <TrendingUp size={16} style={{ color: 'var(--accent)' }} />
            <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 16 }}>Daily summary</h2>
          </div>
          <DailyPnL acc={acc} />

          {acc.record?.notes && (
            <div style={{ marginTop: 16, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px' }}>
              <p style={{ color: 'var(--text-3)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>Notes</p>
              <p style={{ color: 'var(--text-2)', fontSize: 13 }}>{acc.record.notes}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
