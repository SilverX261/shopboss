'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  LogOut, LogIn, Package, CreditCard, DollarSign,
  ShoppingCart, X, AlertTriangle, Boxes,
  CheckCircle, Clock, TrendingUp,
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { Shop } from '@/lib/types'
import { loadDailyAccounting, localDayISO, type DailyAccounting } from '@/lib/utils/daily-accounting'
import { DailyPnL } from '@/components/cash/DailyPnL'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtRs = (n: number) => `Rs ${Math.round(n).toLocaleString('en-PK')}`

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1) }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999) }

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color, href, alert, warn }: {
  label: string; value: string; sub?: string; color?: string
  href?: string; alert?: boolean; warn?: boolean
}) {
  const inner = (
    <div
      style={{
        background: alert ? 'var(--danger-bg)' : warn ? 'var(--warning-bg)' : 'var(--bg-3)',
        border: `1px solid ${alert ? 'var(--danger-border)' : warn ? 'var(--warning-border)' : 'var(--border)'}`,
        borderRadius: 8,
        padding: '20px',
        height: '100%',
        boxSizing: 'border-box' as const,
        transition: 'border-color 0.15s, transform 0.15s, box-shadow 0.15s',
        cursor: href ? 'pointer' : 'default',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = 'var(--copper)'
        el.style.transform = 'translateY(-1px)'
        el.style.boxShadow = '0 4px 16px rgba(255,184,118,0.07)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.borderColor = alert ? 'var(--danger-border)' : warn ? 'var(--warning-border)' : 'var(--border)'
        el.style.transform = 'none'
        el.style.boxShadow = 'none'
      }}
    >
      <p style={{ color: 'var(--text-3)', fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>{label}</p>
      <p style={{ color: color ?? 'var(--accent)', fontWeight: 700, fontSize: 24, letterSpacing: '-0.025em', lineHeight: 1.1 }}>{value}</p>
      {sub && <p style={{ color: 'var(--text-3)', fontSize: 11, marginTop: 6, lineHeight: 1.4 }}>{sub}</p>}
    </div>
  )
  if (href) return <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>{inner}</Link>
  return inner
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHead({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  )
}

// ─── Opening Checklist Modal ──────────────────────────────────────────────────

function OpeningChecklistModal({
  shop, systemLaptopCount, onClose, onDone,
}: {
  shop: Shop
  systemLaptopCount: number
  onClose: () => void
  onDone: () => void
}) {
  const [step, setStep] = useState(1)
  const [cashInput, setCashInput] = useState('')
  const [physicalCount, setPhysicalCount] = useState('')
  const [saving, setSaving] = useState(false)

  const cashAmount = parseFloat(cashInput)
  const countNum = parseInt(physicalCount, 10)
  const countMismatch = !isNaN(countNum) && systemLaptopCount > 0 && Math.abs(countNum - systemLaptopCount) > 2

  const save = async () => {
    if (isNaN(cashAmount) || cashAmount < 0) { toast.error('Enter a valid opening balance'); return }
    setSaving(true)
    const supabase = createClient()
    await supabase.from('daily_cash_records').upsert(
      { shop_id: shop.id, record_date: localDayISO(), opening_balance: cashAmount },
      { onConflict: 'shop_id,record_date' },
    )
    setSaving(false)
    toast.success('Good morning! Day started.')
    onDone()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 24 }}>
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, padding: '32px 28px', width: '100%', maxWidth: 460 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 20 }}>Start Your Day</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}><X size={18} /></button>
        </div>
        <p style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 24 }}>Good morning, {shop.owner_name}!</p>

        {/* Step indicators */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
          {[1, 2, 3].map(s => (
            <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: s <= step ? 'var(--accent)' : 'var(--bg-3)' }} />
          ))}
        </div>

        {step === 1 && (
          <div>
            <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: 15, marginBottom: 6 }}>Step 1 — Opening cash balance</p>
            <p style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 16 }}>Count the cash in your drawer right now.</p>
            <input
              type="number" min={0} autoFocus value={cashInput}
              onChange={e => setCashInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !isNaN(parseFloat(cashInput))) setStep(systemLaptopCount === 0 ? 3 : 2) }}
              placeholder="Rs 0"
              style={{ width: '100%', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px', color: 'var(--text)', fontSize: 24, fontWeight: 700, outline: 'none', textAlign: 'center', boxSizing: 'border-box', marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose} style={{ flex: 1, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '11px', color: 'var(--text-2)', fontWeight: 500, fontSize: 14, cursor: 'pointer' }}>
                Skip for now
              </button>
              <button onClick={() => { if (!isNaN(parseFloat(cashInput))) setStep(systemLaptopCount === 0 ? 3 : 2); else toast.error('Enter an amount') }}
                style={{ flex: 2, background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '11px', color: 'var(--bg)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                Next →
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: 15, marginBottom: 6 }}>Step 2 — Quick stock check</p>
            <p style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 6 }}>
              System shows <strong style={{ color: 'var(--text)' }}>{systemLaptopCount} laptops</strong> in stock. How many do you physically see?
            </p>
            <input
              type="number" min={0} autoFocus value={physicalCount}
              onChange={e => setPhysicalCount(e.target.value)}
              placeholder={String(systemLaptopCount)}
              style={{ width: '100%', background: 'var(--bg-3)', border: `1px solid ${countMismatch ? 'var(--danger)' : 'var(--border)'}`, borderRadius: 10, padding: '16px', color: 'var(--text)', fontSize: 24, fontWeight: 700, outline: 'none', textAlign: 'center', boxSizing: 'border-box', marginBottom: 12 }}
            />
            {countMismatch && (
              <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
                <p style={{ color: 'var(--danger)', fontSize: 13, fontWeight: 600 }}>
                  ⚠ Mismatch: system says {systemLaptopCount}, you counted {countNum}.
                  Difference: {Math.abs(countNum - systemLaptopCount)} laptops.
                  Please investigate.
                </p>
              </div>
            )}
            {!isNaN(countNum) && !countMismatch && physicalCount !== '' && (
              <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
                <p style={{ color: 'var(--success)', fontSize: 13, fontWeight: 600 }}>✓ Count matches system. All good!</p>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setStep(1)} style={{ flex: 1, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '11px', color: 'var(--text-2)', fontWeight: 500, fontSize: 14, cursor: 'pointer' }}>
                ← Back
              </button>
              <button onClick={() => setStep(3)}
                style={{ flex: 2, background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '11px', color: 'var(--bg)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                Next →
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: 15, marginBottom: 6 }}>Ready to start!</p>
            <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px', marginBottom: 20 }}>
              {[
                { label: 'Opening cash balance', value: fmtRs(cashAmount) },
                { label: 'Laptops in system', value: `${systemLaptopCount} units` },
                { label: 'Physical count', value: physicalCount ? `${physicalCount} units` : 'Skipped' },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-2)', fontSize: 13 }}>{label}</span>
                  <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: 13 }}>{value}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setStep(systemLaptopCount === 0 ? 1 : 2)} style={{ flex: 1, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '11px', color: 'var(--text-2)', fontWeight: 500, fontSize: 14, cursor: 'pointer' }}>
                ← Back
              </button>
              <button onClick={save} disabled={saving}
                style={{ flex: 2, background: 'var(--success)', border: 'none', borderRadius: 8, padding: '11px', color: '#fff', fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Starting…' : '✓ Start Day'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Closing Checklist Modal ──────────────────────────────────────────────────

interface TodayUdhaar { id: string; customer_name: string; amount_remaining: number }
interface TodayExpense { id: string; category: string; description: string; amount: number; payment_type: string }

function ClosingChecklistModal({
  shop, acc, onClose, onDone,
}: {
  shop: Shop
  acc: DailyAccounting
  onClose: () => void
  onDone: () => void
}) {
  const [step, setStep] = useState(1)
  const [actualCash, setActualCash] = useState('')
  const [todayUdhaar, setTodayUdhaar] = useState<TodayUdhaar[]>([])
  const [todayExpenses, setTodayExpenses] = useState<TodayExpense[]>([])
  const [saving, setSaving] = useState(false)
  const [closed, setClosed] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    const today = localDayISO()
    Promise.all([
      supabase.from('udhaar_records').select('id,customer_name,amount_remaining').eq('shop_id', shop.id).in('status', ['pending', 'partial']).gte('created_at', today + 'T00:00:00'),
      supabase.from('expenses').select('id,category,description,amount,payment_type').eq('shop_id', shop.id).eq('expense_date', today),
    ]).then(([{ data: u }, { data: e }]) => {
      setTodayUdhaar((u ?? []) as TodayUdhaar[])
      setTodayExpenses((e ?? []) as TodayExpense[])
    })
  }, [shop.id])

  const actual = parseFloat(actualCash)
  const hasActual = !isNaN(actual) && actualCash !== ''
  const diff = hasActual ? actual - acc.expectedDrawer : null

  const closeDay = async () => {
    if (!hasActual || actual < 0) { toast.error('Enter actual cash count'); return }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('daily_cash_records').upsert({
      shop_id: shop.id, record_date: localDayISO(),
      opening_balance: acc.opening,
      closing_balance_expected: acc.expectedDrawer,
      closing_balance_actual: actual,
      difference: actual - acc.expectedDrawer,
      is_closed: true,
    }, { onConflict: 'shop_id,record_date' })
    setSaving(false)
    if (error) { toast.error('Something went wrong. Please try again.'); return }
    setClosed(true)
    setStep(5)
    toast.success('Day closed successfully!')
    onDone()
  }

  const summaryText = [
    `ShopBoss Daily Summary — ${new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long' })}`,
    '─────────────────────',
    `Revenue: ${fmtRs(acc.revenue)}`,
    `Cost of goods: ${fmtRs(acc.cogs)}`,
    `Gross profit: ${fmtRs(acc.grossProfit)}`,
    `Expenses: ${fmtRs(acc.totalExpenses)}`,
    `Net profit: ${fmtRs(acc.netProfit)}`,
    '─────────────────────',
    `Opening cash: ${fmtRs(acc.opening)}`,
    `Expected cash: ${fmtRs(acc.expectedDrawer)}`,
    hasActual ? `Actual cash: ${fmtRs(actual)}` : '',
    diff !== null ? `Difference: ${diff >= 0 ? '+' : ''}${fmtRs(diff)}` : '',
    '─────────────────────',
    `Today's udhaar: ${fmtRs(todayUdhaar.reduce((s, u) => s + u.amount_remaining, 0))}`,
    `Today's expenses: ${fmtRs(acc.totalExpenses)}`,
  ].filter(Boolean).join('\n')

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 24 }} onClick={step < 5 ? undefined : onClose}>
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, padding: '32px 28px', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 20 }}>Close Day</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}><X size={18} /></button>
        </div>
        <p style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 20 }}>{new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long' })}</p>

        {step < 5 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
            {[1, 2, 3, 4].map(s => (
              <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: s <= step ? 'var(--accent)' : 'var(--bg-3)' }} />
            ))}
          </div>
        )}

        {step === 1 && (
          <div>
            <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: 15, marginBottom: 6 }}>Step 1 — Count cash in drawer</p>
            <p style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 4 }}>
              Expected: <strong style={{ color: 'var(--text)' }}>{fmtRs(acc.expectedDrawer)}</strong>
            </p>
            <input
              type="number" min={0} autoFocus value={actualCash}
              onChange={e => setActualCash(e.target.value)}
              placeholder="Actual counted cash"
              style={{ width: '100%', background: 'var(--bg-3)', border: `1px solid ${diff !== null && diff < 0 ? 'var(--danger)' : diff !== null && diff > 0 ? 'var(--success)' : 'var(--border)'}`, borderRadius: 10, padding: '16px', color: 'var(--text)', fontSize: 24, fontWeight: 700, outline: 'none', textAlign: 'center', boxSizing: 'border-box', marginBottom: 12 }}
            />
            {diff !== null && (
              <div style={{ background: diff < 0 ? 'var(--danger-bg)' : 'var(--success-bg)', border: `1px solid ${diff < 0 ? 'var(--danger-border)' : 'var(--success-border)'}`, borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
                <p style={{ color: diff < 0 ? 'var(--danger)' : 'var(--success)', fontSize: 13, fontWeight: 600 }}>
                  {diff > 0 ? `+${fmtRs(diff)} surplus` : diff < 0 ? `${fmtRs(diff)} short` : 'Perfect — no difference!'}
                </p>
              </div>
            )}
            <button onClick={() => { if (hasActual) setStep(2); else toast.error('Enter actual cash first') }}
              disabled={!hasActual}
              style={{ width: '100%', background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '12px', color: 'var(--bg)', fontWeight: 700, fontSize: 14, cursor: hasActual ? 'pointer' : 'not-allowed', opacity: hasActual ? 1 : 0.5 }}>
              Next →
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: 15, marginBottom: 6 }}>Step 2 — Udhaar recovered today?</p>
            {todayUdhaar.length === 0 ? (
              <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
                <p style={{ color: 'var(--success)', fontSize: 13, fontWeight: 600 }}>✓ No udhaar outstanding from today</p>
              </div>
            ) : (
              <div style={{ marginBottom: 16 }}>
                {todayUdhaar.map(u => (
                  <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-3)', borderRadius: 8, marginBottom: 6 }}>
                    <span style={{ color: 'var(--text)', fontSize: 13 }}>{u.customer_name}</span>
                    <span style={{ color: 'var(--warning)', fontWeight: 600, fontSize: 13 }}>{fmtRs(u.amount_remaining)}</span>
                  </div>
                ))}
                <Link href="/udhaar" onClick={onClose} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--accent-2)', fontSize: 12, textDecoration: 'none', marginTop: 4 }}>
                  Record payment → /udhaar
                </Link>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setStep(1)} style={{ flex: 1, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '11px', color: 'var(--text-2)', fontWeight: 500, fontSize: 14, cursor: 'pointer' }}>← Back</button>
              <button onClick={() => setStep(3)} style={{ flex: 2, background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '11px', color: 'var(--bg)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Next →</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: 15, marginBottom: 6 }}>Step 3 — Expenses logged today?</p>
            {todayExpenses.length === 0 ? (
              <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
                <p style={{ color: 'var(--text-3)', fontSize: 13 }}>No expenses logged today.</p>
              </div>
            ) : (
              <div style={{ marginBottom: 12 }}>
                {todayExpenses.map(e => (
                  <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-3)', borderRadius: 8, marginBottom: 6 }}>
                    <span style={{ color: 'var(--text)', fontSize: 13 }}>{e.category} — {e.description}</span>
                    <span style={{ color: 'var(--danger)', fontWeight: 600, fontSize: 13 }}>{fmtRs(e.amount)}</span>
                  </div>
                ))}
              </div>
            )}
            <Link href="/cash/expense" onClick={onClose} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--accent-2)', fontSize: 12, textDecoration: 'none', marginBottom: 16 }}>
              + Add expense
            </Link>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setStep(2)} style={{ flex: 1, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '11px', color: 'var(--text-2)', fontWeight: 500, fontSize: 14, cursor: 'pointer' }}>← Back</button>
              <button onClick={() => setStep(4)} style={{ flex: 2, background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '11px', color: 'var(--bg)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Next →</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: 15, marginBottom: 16 }}>Step 4 — Final P&amp;L for today</p>
            <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
              {[
                { label: 'Revenue', value: fmtRs(acc.revenue) },
                { label: 'COGS', value: fmtRs(acc.cogs) },
                { label: 'Gross Profit', value: fmtRs(acc.grossProfit) },
                { label: 'Expenses', value: fmtRs(acc.totalExpenses) },
                { label: 'Net Profit', value: fmtRs(acc.netProfit), bold: true, color: acc.netProfit >= 0 ? 'var(--success)' : 'var(--danger)' },
                { label: 'Expected Cash', value: fmtRs(acc.expectedDrawer) },
                { label: 'Actual Cash', value: hasActual ? fmtRs(actual) : '—' },
                { label: 'Difference', value: diff !== null ? (diff >= 0 ? '+' : '') + fmtRs(diff) : '—', color: diff !== null ? (diff >= 0 ? 'var(--success)' : 'var(--danger)') : undefined },
              ].map(({ label, value, bold, color }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-2)', fontSize: 13, fontWeight: bold ? 600 : 400 }}>{label}</span>
                  <span style={{ color: color ?? 'var(--text)', fontSize: 13, fontWeight: bold ? 700 : 600 }}>{value}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setStep(3)} style={{ flex: 1, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '11px', color: 'var(--text-2)', fontWeight: 500, fontSize: 14, cursor: 'pointer' }}>← Back</button>
              <button onClick={closeDay} disabled={saving}
                style={{ flex: 2, background: 'var(--success)', border: 'none', borderRadius: 8, padding: '11px', color: '#fff', fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Closing…' : '✓ Confirm & Close Day'}
              </button>
            </div>
          </div>
        )}

        {step === 5 && closed && (
          <div style={{ textAlign: 'center' }}>
            <CheckCircle size={48} style={{ color: 'var(--success)', marginBottom: 12 }} />
            <h3 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Day Closed!</h3>
            <p style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 20 }}>
              Net profit today: <strong style={{ color: acc.netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmtRs(acc.netProfit)}</strong>
            </p>
            <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 16, textAlign: 'left', fontSize: 12, fontFamily: 'monospace', color: 'var(--text-2)', whiteSpace: 'pre-wrap' }}>
              {summaryText}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => {
                navigator.clipboard.writeText(summaryText).then(
                  () => toast.success('Summary copied!'),
                  () => {},
                )
              }} style={{ flex: 1, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px', color: 'var(--text-2)', fontWeight: 500, fontSize: 13, cursor: 'pointer' }}>
                Copy Summary
              </button>
              <button onClick={onClose} style={{ flex: 1, background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '10px', color: 'var(--bg)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Smart Alert Card ─────────────────────────────────────────────────────────

type AlertSeverity = 'urgent' | 'attention' | 'good'

interface SmartAlert {
  id: string
  severity: AlertSeverity
  message: string
  sub?: string
  href?: string
}

function AlertCard({ alert, onDismiss }: { alert: SmartAlert; onDismiss: (id: string) => void }) {
  const cfg: Record<AlertSeverity, { bg: string; border: string; color: string; dot: string }> = {
    urgent: { bg: 'var(--danger-bg)', border: 'var(--danger-border)', color: 'var(--danger)', dot: '🔴' },
    attention: { bg: 'var(--warning-bg)', border: 'var(--border)', color: 'var(--warning)', dot: '🟡' },
    good: { bg: 'var(--success-bg)', border: 'var(--success-border)', color: 'var(--success)', dot: '🟢' },
  }
  const c = cfg[alert.severity]
  const inner = (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
        <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{c.dot}</span>
        <div style={{ minWidth: 0 }}>
          <p style={{ color: c.color, fontWeight: 600, fontSize: 13 }}>{alert.message}</p>
          {alert.sub && <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 2 }}>{alert.sub}</p>}
        </div>
      </div>
      <button onClick={e => { e.preventDefault(); e.stopPropagation(); onDismiss(alert.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', flexShrink: 0 }}>
        <X size={14} />
      </button>
    </div>
  )
  return alert.href ? <Link href={alert.href} style={{ textDecoration: 'none' }}>{inner}</Link> : inner
}

// ─── Snapshot Modal (I Am Leaving) ────────────────────────────────────────────

interface SnapshotData {
  laptopsInStock: number
  laptopStockValue: number
  cashInDrawer: number
  bankBalance: number
  accessoriesValue: number
  udhaarOutstanding: number
  supplierOwed: number
  todayRevenue: number
  todayProfit: number
  todaySalesCount: number
  timestamp: string
  shopName: string
}

function SnapshotModal({ data, onSave, onClose }: { data: SnapshotData; onSave: () => Promise<void>; onClose: () => void }) {
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  const timeStr = new Date(data.timestamp).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })

  const snapshotText = [
    `Shop Status — ${timeStr}`,
    `${data.shopName}`,
    '─────────────────────',
    `Laptops in stock: ${data.laptopsInStock} units`,
    `Stock value: ${fmtRs(data.laptopStockValue)}`,
    '─────────────────────',
    `Cash in drawer: ${fmtRs(data.cashInDrawer)}`,
    `Bank balance: ${fmtRs(data.bankBalance)}`,
    `Total liquid: ${fmtRs(data.cashInDrawer + data.bankBalance)}`,
    '─────────────────────',
    `Today's sales: ${data.todaySalesCount} laptops — ${fmtRs(data.todayRevenue)}`,
    `Today's profit so far: ${fmtRs(data.todayProfit)}`,
    '─────────────────────',
    `Udhaar outstanding: ${fmtRs(data.udhaarOutstanding)}`,
    `Supplier owed: ${fmtRs(data.supplierOwed)}`,
  ].join('\n')

  const handleSave = async () => {
    setSaving(true)
    await onSave()
    setSaving(false)
    setSaved(true)
  }

  const copy = () => {
    navigator.clipboard.writeText(snapshotText).then(
      () => toast.success('Copied! Paste into WhatsApp saved messages.'),
      () => toast.error('Could not copy. Please try again.'),
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }} onClick={onClose}>
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14, padding: '28px 24px', width: '100%', maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h3 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 17 }}>Shop Status — {timeStr}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex' }}><X size={18} /></button>
        </div>
        <p style={{ color: 'var(--text-3)', fontSize: 12, marginBottom: 20 }}>{data.shopName}</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, background: 'var(--bg-3)', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
          {[
            { group: true, label: 'Laptops in stock', value: `${data.laptopsInStock} units`, sub: fmtRs(data.laptopStockValue) },
            { divider: true },
            { label: 'Cash in drawer', value: fmtRs(data.cashInDrawer) },
            { label: 'Bank balance', value: fmtRs(data.bankBalance), color: 'var(--info)' },
            { label: 'Total liquid', value: fmtRs(data.cashInDrawer + data.bankBalance), bold: true, color: 'var(--accent-2)' },
            { divider: true },
            { label: "Today's sales", value: `${data.todaySalesCount} laptops — ${fmtRs(data.todayRevenue)}` },
            { label: "Today's profit", value: fmtRs(data.todayProfit), color: data.todayProfit >= 0 ? 'var(--success)' : 'var(--danger)' },
            { divider: true },
            { label: 'Udhaar outstanding', value: fmtRs(data.udhaarOutstanding), color: 'var(--warning)' },
            { label: 'Supplier owed', value: fmtRs(data.supplierOwed), color: 'var(--info)' },
          ].map((r, i) => {
            if ('divider' in r && r.divider) return <div key={i} style={{ height: 1, background: 'var(--border)' }} />
            if ('label' in r) return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px' }}>
                <span style={{ color: 'var(--text-2)', fontSize: 13 }}>{r.label}</span>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: r.color ?? 'var(--text)', fontSize: 13, fontWeight: r.bold ? 700 : 600 }}>{r.value}</span>
                  {'sub' in r && r.sub && <p style={{ color: 'var(--text-3)', fontSize: 11 }}>{r.sub}</p>}
                </div>
              </div>
            )
            return null
          })}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={copy} style={{ flex: 1, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px', color: 'var(--text-2)', fontWeight: 500, fontSize: 13, cursor: 'pointer' }}>
            Copy to WhatsApp
          </button>
          <button onClick={handleSave} disabled={saving || saved}
            style={{ flex: 1, background: saved ? 'var(--success-bg)' : 'var(--accent)', border: saved ? '1px solid var(--success-border)' : 'none', borderRadius: 8, padding: '10px', color: saved ? 'var(--success)' : 'var(--bg)', fontWeight: 700, fontSize: 13, cursor: saving || saved ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Snapshot'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Diff modal (I Am Back) ───────────────────────────────────────────────────

interface DiffData {
  timeAwayMinutes: number
  soldCount: number
  soldRevenue: number
  stockBefore: number
  stockAfter: number
  udhaarBefore: number
  udhaarAfter: number
  cashBefore: number
  cashAfter: number
  newExpenses: number
  snapshotTime: string
}

function DiffModal({ data, onClose }: { data: DiffData; onClose: () => void }) {
  const hours = Math.floor(data.timeAwayMinutes / 60)
  const mins = data.timeAwayMinutes % 60
  const awayStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }} onClick={onClose}>
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14, padding: '28px 24px', width: '100%', maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h3 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 17 }}>What Changed</h3>
            <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 2 }}>You were away for {awayStr}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex' }}><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { label: 'Laptops sold', value: `${data.soldCount} units`, sub: data.soldCount > 0 ? fmtRs(data.soldRevenue) : undefined, flag: false },
            { label: 'Stock', value: `${data.stockBefore} → ${data.stockAfter}`, flag: data.stockBefore - data.stockAfter !== data.soldCount },
            { label: 'Cash in drawer', value: `${fmtRs(data.cashBefore)} → ${fmtRs(data.cashAfter)}`, flag: false },
            { label: 'Udhaar outstanding', value: `${fmtRs(data.udhaarBefore)} → ${fmtRs(data.udhaarAfter)}`, flag: data.udhaarAfter > data.udhaarBefore },
            { label: 'Expenses added', value: fmtRs(data.newExpenses), flag: false },
          ].map(({ label, value, sub, flag }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: flag ? 'var(--warning-bg)' : 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8 }}>
              <span style={{ color: 'var(--text-2)', fontSize: 13 }}>{label}</span>
              <div style={{ textAlign: 'right' }}>
                <span style={{ color: flag ? 'var(--warning)' : 'var(--text)', fontSize: 13, fontWeight: 600 }}>{value}</span>
                {sub && <p style={{ color: 'var(--text-3)', fontSize: 11, marginTop: 1 }}>{sub}</p>}
              </div>
            </div>
          ))}
        </div>
        <p style={{ color: 'var(--text-3)', fontSize: 12, textAlign: 'center', marginTop: 16 }}>
          Snapshot taken at {new Date(data.snapshotTime).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

interface MonthStats {
  revenue: number
  profit: number
  stockValue: number
  udhaarOutstanding: number
}

interface AlertCounts {
  laptops60Plus: number
  laptops90Plus: number
  udhaarOverdueCount: number
  udhaarOverdueAmount: number
  supplierDueThisWeek: number
  lowAccessories: string[]
  unclosedYesterday: boolean
  todayProfit: number
  maxDayProfitThisMonth: number
  udhaarRecoveredToday: number
}

const DISMISS_KEY_PREFIX = 'shopboss_dismissed_'

function getDismissedToday(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  const key = DISMISS_KEY_PREFIX + localDayISO()
  try { return new Set(JSON.parse(localStorage.getItem(key) ?? '[]')) } catch { return new Set() }
}

function dismissAlert(id: string) {
  if (typeof window === 'undefined') return
  const key = DISMISS_KEY_PREFIX + localDayISO()
  try {
    const cur = new Set(JSON.parse(localStorage.getItem(key) ?? '[]'))
    cur.add(id)
    localStorage.setItem(key, JSON.stringify(Array.from(cur)))
  } catch { /* ignore */ }
}

// ─── Setup banner ─────────────────────────────────────────────────────────────

function SetupBanner() {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  return (
    <div
      style={{
        background: 'var(--warning-bg)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '12px 16px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <AlertTriangle size={15} style={{ color: 'var(--warning)', flexShrink: 0 }} />
        <span style={{ color: 'var(--text-2)', fontSize: 13 }}>
          Complete your shop setup to get started{' '}
          <a href="/onboarding" style={{ color: 'var(--accent-2)', fontWeight: 600, textDecoration: 'none' }}>→</a>
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', padding: 0 }}
      >
        <X size={15} />
      </button>
    </div>
  )
}

export default function DashboardPage() {
  const [shop, setShop] = useState<Shop | null>(null)
  const [acc, setAcc] = useState<DailyAccounting | null>(null)
  const [todayRevenue, setTodayRevenue] = useState(0)
  const [monthStats, setMonthStats] = useState<MonthStats | null>(null)
  const [alertCounts, setAlertCounts] = useState<AlertCounts | null>(null)
  const [systemLaptopCount, setSystemLaptopCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [shopError, setShopError] = useState<string | null>(null)

  // Modals
  const [showOpening, setShowOpening] = useState(false)
  const [showClosing, setShowClosing] = useState(false)
  const [snapshotData, setSnapshotData] = useState<SnapshotData | null>(null)
  const [diffData, setDiffData] = useState<DiffData | null>(null)
  const [snapshotLoading, setSnapshotLoading] = useState(false)
  const [diffLoading, setDiffLoading] = useState(false)
  const [lastSnapshot, setLastSnapshot] = useState<{ id: string; created_at: string; laptops_in_stock_value: number | null; cash_declared: number | null; accessories_total_value: number | null; udhaar_total_pending: number | null; laptop_count: number | null } | null>(null)

  // Dismissible alerts
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  useEffect(() => { setDismissed(getDismissedToday()) }, [])

  const modalShownRef = useRef(false)

  const handleDismiss = (id: string) => {
    dismissAlert(id)
    setDismissed(getDismissedToday())
  }

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: shopData, error: shopErr } = await supabase.from('shops').select('*').eq('owner_id', user.id).maybeSingle()
    if (shopErr) {
      setShopError(`Failed to load shop: ${shopErr.message}`)
      setLoading(false)
      return
    }
    if (!shopData) {
      setShopError('No shop found for your account. Please complete onboarding.')
      setLoading(false)
      return
    }
    const shop = shopData as Shop
    setShop(shop)

    const today = localDayISO()
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    const now = new Date()
    const monthStart = startOfMonth(now).toISOString()
    const monthEnd = endOfMonth(now).toISOString()
    const monthStartDate = startOfMonth(now).toISOString().slice(0, 10)
    const monthEndDate = endOfMonth(now).toISOString().slice(0, 10)
    const weekFromNow = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10)

    const [accResult, monthData, alertData] = await Promise.all([
      loadDailyAccounting(supabase, shop.id),
      Promise.all([
        supabase.from('sales').select('sale_price,profit,laptops(purchase_price)').eq('shop_id', shop.id).eq('is_voided', false).gte('sold_at', monthStart).lte('sold_at', monthEnd),
        supabase.from('accessory_transactions').select('value').eq('shop_id', shop.id).eq('transaction_type', 'sale').gte('created_at', monthStart).lte('created_at', monthEnd),
        supabase.from('expenses').select('amount').eq('shop_id', shop.id).gte('expense_date', monthStartDate).lte('expense_date', monthEndDate),
        supabase.from('laptops').select('purchase_price, quantity').eq('shop_id', shop.id).eq('status', 'in_stock'),
        supabase.from('udhaar_records').select('amount_remaining').eq('shop_id', shop.id).in('status', ['pending', 'partial', 'overdue']),
      ]),
      Promise.all([
        supabase.from('laptops').select('quantity').eq('shop_id', shop.id).eq('status', 'in_stock').gte('days_in_stock', 60),
        supabase.from('laptops').select('quantity').eq('shop_id', shop.id).eq('status', 'in_stock').gte('days_in_stock', 90),
        supabase.from('udhaar_records').select('amount_remaining').eq('shop_id', shop.id).eq('status', 'overdue'),
        supabase.from('supplier_credits').select('amount_owed,amount_paid').eq('shop_id', shop.id).neq('status', 'paid').lte('due_date', weekFromNow).gte('due_date', today),
        supabase.from('accessory_categories').select('name,units_restocked,units_sold').eq('shop_id', shop.id).gt('units_restocked', 0),
        supabase.from('daily_cash_records').select('is_closed').eq('shop_id', shop.id).eq('record_date', yesterday).maybeSingle(),
        supabase.from('udhaar_payments').select('amount_paid').eq('shop_id', shop.id).eq('payment_date', today),
        supabase.from('laptops').select('quantity').eq('shop_id', shop.id).eq('status', 'in_stock'),
      ]),
    ])

    setAcc(accResult)

    const [salesRes, accRes, expRes, stockRes, udhaarRes] = monthData
    const monthSales = (salesRes.data ?? []) as unknown as { sale_price: number; profit: number; laptops: { purchase_price: number } | null }[]
    const monthAccSales = (accRes.data ?? []) as { value: number }[]
    const monthExp = (expRes.data ?? []) as { amount: number }[]
    const stockLaps = (stockRes.data ?? []) as { purchase_price: number; quantity: number | null }[]
    const udhaarRows = (udhaarRes.data ?? []) as { amount_remaining: number }[]

    const monthLapRevenue = monthSales.reduce((s, r) => s + r.sale_price, 0)
    const monthAccRevenue = monthAccSales.reduce((s, a) => s + a.value, 0)
    const monthRevenue = monthLapRevenue + monthAccRevenue
    const monthCOGS = monthSales.reduce((s, r) => {
      const lap = Array.isArray(r.laptops) ? r.laptops[0] : r.laptops
      return s + (lap?.purchase_price ?? 0)
    }, 0)
    const monthExp_ = monthExp.reduce((s, e) => s + e.amount, 0)
    const monthProfit = monthRevenue - monthCOGS - monthExp_
    const stockValue = stockLaps.reduce((s, l) => s + l.purchase_price * (l.quantity ?? 1), 0)
    const udhaarOut = udhaarRows.reduce((s, u) => s + u.amount_remaining, 0)

    setTodayRevenue(accResult.revenue)
    setMonthStats({ revenue: monthRevenue, profit: monthProfit, stockValue, udhaarOutstanding: udhaarOut })

    const [lap60Res, lap90Res, udhaarOvRes, supCreditRes, accCatRes, yesterdayCloseRes, udhaarRecovRes, laptopCountRes] = alertData
    const udhaarOvRows = (udhaarOvRes.data ?? []) as { amount_remaining: number }[]
    const supRows = (supCreditRes.data ?? []) as { amount_owed: number; amount_paid: number }[]
    const accCats = (accCatRes.data ?? []) as { name: string; units_restocked: number; units_sold: number }[]
    const yesterdayRecord = yesterdayCloseRes.data as { is_closed: boolean } | null

    const supplierDue = supRows.reduce((s, c) => s + (c.amount_owed - c.amount_paid), 0)
    const lowAcc = accCats.filter(c => c.units_restocked > 0 && c.units_sold / c.units_restocked >= 0.8).map(c => c.name)
    const udhaarRecovToday = (udhaarRecovRes.data ?? []).reduce((s: number, p: { amount_paid: number }) => s + p.amount_paid, 0)
    const laptopCountNum = ((laptopCountRes.data ?? []) as { quantity: number | null }[]).reduce((s, l) => s + (l.quantity ?? 1), 0)

    setSystemLaptopCount(laptopCountNum)

    // Best day this month: compare today's profit to max seen
    const avgProfit = monthSales.length > 0 ? monthSales.reduce((s, r) => s + r.profit, 0) / monthSales.length : 0

    const sumQty = (rows: unknown) => ((rows ?? []) as { quantity: number | null }[]).reduce((s, l) => s + (l.quantity ?? 1), 0)
    setAlertCounts({
      laptops60Plus: sumQty(lap60Res.data),
      laptops90Plus: sumQty(lap90Res.data),
      udhaarOverdueCount: udhaarOvRows.length,
      udhaarOverdueAmount: udhaarOvRows.reduce((s, u) => s + u.amount_remaining, 0),
      supplierDueThisWeek: supplierDue,
      lowAccessories: lowAcc,
      unclosedYesterday: yesterdayRecord ? !yesterdayRecord.is_closed : false,
      todayProfit: accResult.netProfit,
      maxDayProfitThisMonth: avgProfit * 1.5,
      udhaarRecoveredToday: udhaarRecovToday,
    })

    const { data: snapData } = await supabase.from('snapshots').select('id,created_at,laptops_in_stock_value,cash_declared,accessories_total_value,udhaar_total_pending,laptop_count').eq('shop_id', shop.id).eq('snapshot_type', 'left').order('created_at', { ascending: false }).limit(1).maybeSingle()
    setLastSnapshot(snapData as typeof lastSnapshot ?? null)

    setLoading(false)

    // Auto-show opening checklist once per day, before 2 PM, if no opening balance
    if (!modalShownRef.current) {
      const hour = now.getHours()
      const dayKey = 'shopboss_day_started_' + localDayISO()
      const alreadyStarted = typeof window !== 'undefined' ? localStorage.getItem(dayKey) : 'true'
      if (!alreadyStarted && !accResult.hasOpening && hour < 14) {
        modalShownRef.current = true
        setShowOpening(true)
      }
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Build smart alerts
  const smartAlerts: SmartAlert[] = []
  if (alertCounts) {
    if (alertCounts.unclosedYesterday) {
      smartAlerts.push({ id: 'unclosed_yesterday', severity: 'urgent', message: "Yesterday's accounts were not closed", sub: 'Go to Cash → Close Day to review' })
    }
    if (alertCounts.udhaarOverdueCount > 0) {
      smartAlerts.push({ id: 'overdue_udhaar', severity: 'urgent', message: `${alertCounts.udhaarOverdueCount} customers overdue for payment — ${fmtRs(alertCounts.udhaarOverdueAmount)} outstanding`, href: '/udhaar' })
    }
    if (alertCounts.laptops90Plus > 0) {
      smartAlerts.push({ id: 'dead_stock_90', severity: 'urgent', message: `${alertCounts.laptops90Plus} laptops unsold for 90+ days`, sub: 'Dead stock — consider discounting', href: '/reports' })
    }
    if (alertCounts.laptops60Plus - alertCounts.laptops90Plus > 0) {
      smartAlerts.push({ id: 'aging_60', severity: 'attention', message: `${alertCounts.laptops60Plus - alertCounts.laptops90Plus} laptops unsold for 60+ days`, href: '/inventory' })
    }
    if (alertCounts.supplierDueThisWeek > 0) {
      smartAlerts.push({ id: 'supplier_due', severity: 'attention', message: `Supplier payment due this week: ${fmtRs(alertCounts.supplierDueThisWeek)}`, href: '/udhaar' })
    }
    if (alertCounts.lowAccessories.length > 0) {
      smartAlerts.push({ id: 'low_accessories', severity: 'attention', message: `${alertCounts.lowAccessories.length} accessory categories running low`, sub: alertCounts.lowAccessories.slice(0, 3).join(', '), href: '/accessories' })
    }
    if (alertCounts.todayProfit > 0 && alertCounts.todayProfit > alertCounts.maxDayProfitThisMonth) {
      smartAlerts.push({ id: 'best_day', severity: 'good', message: `Best day this month! ${fmtRs(alertCounts.todayProfit)} profit today` })
    }
    if (alertCounts.udhaarRecoveredToday > 0) {
      smartAlerts.push({ id: 'udhaar_recovered', severity: 'good', message: `${fmtRs(alertCounts.udhaarRecoveredToday)} udhaar recovered today`, href: '/udhaar' })
    }
  }
  const visibleAlerts = smartAlerts.filter(a => !dismissed.has(a.id))

  // ── I Am Leaving ──────────────────────────────────────────────────────────────
  const handleLeave = async () => {
    if (!shop || !acc) return
    setSnapshotLoading(true)
    try {
      const supabase = createClient()
      const [{ data: stockData }, { data: udhaarData }, { data: accCatData }, { data: allSalesData }, { data: supData }] = await Promise.all([
        supabase.from('laptops').select('purchase_price, quantity').eq('shop_id', shop.id).eq('status', 'in_stock'),
        supabase.from('udhaar_records').select('amount_remaining').eq('shop_id', shop.id).in('status', ['pending', 'partial', 'overdue']),
        supabase.from('accessory_categories').select('total_value_added,total_value_sold').eq('shop_id', shop.id),
        supabase.from('sales').select('id').eq('shop_id', shop.id).eq('is_voided', false).gte('sold_at', localDayISO() + 'T00:00:00'),
        supabase.from('supplier_credits').select('amount_owed,amount_paid').eq('shop_id', shop.id).neq('status', 'paid'),
      ])
      // Bank balance
      const [{ data: bankTxns }, { data: bankSales }, { data: bankUdhaar }, { data: bankExp }] = await Promise.all([
        supabase.from('bank_transactions').select('amount,direction').eq('shop_id', shop.id),
        supabase.from('sales').select('sale_price').eq('shop_id', shop.id).eq('payment_type', 'bank_transfer').eq('is_voided', false),
        supabase.from('udhaar_payments').select('amount_paid').eq('shop_id', shop.id).eq('payment_method', 'bank'),
        supabase.from('expenses').select('amount').eq('shop_id', shop.id).eq('payment_type', 'bank'),
      ])

      const stockValue = (stockData ?? []).reduce((s: number, l: { purchase_price: number; quantity: number | null }) => s + l.purchase_price * (l.quantity ?? 1), 0)
      const laptopCount = (stockData ?? []).reduce((s: number, l: { quantity: number | null }) => s + (l.quantity ?? 1), 0)
      const udhaarOut = (udhaarData ?? []).reduce((s: number, u: { amount_remaining: number }) => s + u.amount_remaining, 0)
      const accValue = (accCatData ?? []).reduce((s: number, c: { total_value_added: number; total_value_sold: number }) => s + (c.total_value_added - c.total_value_sold), 0)
      const supplierOwed = (supData ?? []).reduce((s: number, c: { amount_owed: number; amount_paid: number }) => s + (c.amount_owed - c.amount_paid), 0)
      const bankBalance = (bankTxns ?? []).reduce((s: number, t: { amount: number; direction: string }) => s + (t.direction === 'in' ? t.amount : -t.amount), 0)
        + (bankSales ?? []).reduce((s: number, r: { sale_price: number }) => s + r.sale_price, 0)
        + (bankUdhaar ?? []).reduce((s: number, p: { amount_paid: number }) => s + p.amount_paid, 0)
        - (bankExp ?? []).reduce((s: number, e: { amount: number }) => s + e.amount, 0)

      setSnapshotData({
        laptopsInStock: laptopCount,
        laptopStockValue: stockValue,
        cashInDrawer: acc.expectedDrawer,
        bankBalance,
        accessoriesValue: accValue,
        udhaarOutstanding: udhaarOut,
        supplierOwed,
        todayRevenue: acc.revenue,
        todayProfit: acc.netProfit,
        todaySalesCount: (allSalesData ?? []).length,
        timestamp: new Date().toISOString(),
        shopName: shop.name,
      })
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setSnapshotLoading(false)
    }
  }

  const saveSnapshot = async () => {
    if (!shop || !acc || !snapshotData) return
    const supabase = createClient()
    await supabase.from('snapshots').insert({
      shop_id: shop.id,
      snapshot_type: 'left',
      laptop_count: snapshotData.laptopsInStock,
      laptops_in_stock_value: snapshotData.laptopStockValue,
      cash_declared: snapshotData.cashInDrawer,
      accessories_total_value: snapshotData.accessoriesValue,
      udhaar_total_pending: snapshotData.udhaarOutstanding,
      worker_id: null, worker_last_action: null,
    })
    await load()
  }

  // ── I Am Back ─────────────────────────────────────────────────────────────────
  const handleReturn = async () => {
    if (!shop || !lastSnapshot) { toast.error('No departure snapshot found. Press "I Am Leaving" first.'); return }
    setDiffLoading(true)
    try {
      const supabase = createClient()
      const snapTime = lastSnapshot.created_at
      const [{ data: stockNow }, { data: udhaarNow }, { data: soldSince }, { data: expSince }] = await Promise.all([
        supabase.from('laptops').select('quantity').eq('shop_id', shop.id).eq('status', 'in_stock'),
        supabase.from('udhaar_records').select('amount_remaining').eq('shop_id', shop.id).in('status', ['pending', 'partial', 'overdue']),
        supabase.from('sales').select('sale_price').eq('shop_id', shop.id).eq('is_voided', false).gte('sold_at', snapTime),
        supabase.from('expenses').select('amount').eq('shop_id', shop.id).gte('created_at', snapTime),
      ])
      const accResult = await loadDailyAccounting(supabase, shop.id)
      const stockAfterCount = (stockNow ?? []).reduce((s: number, l: { quantity: number | null }) => s + (l.quantity ?? 1), 0)
      const udhaarAfter = (udhaarNow ?? []).reduce((s: number, u: { amount_remaining: number }) => s + u.amount_remaining, 0)
      const soldSinceData = soldSince ?? []
      const soldRevenue = soldSinceData.reduce((s: number, sl: { sale_price: number }) => s + sl.sale_price, 0)
      const newExpenses = (expSince ?? []).reduce((s: number, e: { amount: number }) => s + e.amount, 0)
      const minutesAway = Math.round((Date.now() - new Date(snapTime).getTime()) / 60000)
      setDiffData({
        timeAwayMinutes: minutesAway, soldCount: soldSinceData.length, soldRevenue,
        stockBefore: lastSnapshot.laptop_count ?? 0, stockAfter: stockAfterCount,
        udhaarBefore: lastSnapshot.udhaar_total_pending ?? 0, udhaarAfter,
        cashBefore: lastSnapshot.cash_declared ?? 0, cashAfter: accResult.expectedDrawer,
        newExpenses, snapshotTime: snapTime,
      })
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setDiffLoading(false)
    }
  }

  const isOperational = shop?.subscription_status === 'active' || shop?.subscription_status === 'trial'
  const hour = new Date().getHours()

  if (loading) {
    return <div style={{ padding: 32, color: 'var(--text-3)', fontSize: 14 }}>Loading dashboard…</div>
  }

  if (shopError || !shop) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 10, padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <AlertTriangle size={18} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ color: 'var(--danger)', fontWeight: 600, fontSize: 14 }}>{shopError ?? 'Shop not found'}</p>
            <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 4 }}>
              <a href="/onboarding" style={{ color: 'var(--accent-2)' }}>Complete shop setup →</a>
            </p>
            <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 6 }}>
              <a href="/api/auth/signout" style={{ color: 'var(--text-2)' }}>Sign in to a different account →</a>
            </p>
          </div>
        </div>
      </div>
    )
  }

  const today = new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long' })

  // Shared bar button style
  const barBtn = (primary = false): React.CSSProperties => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
    padding: primary ? '8px 18px' : '8px 13px',
    borderRadius: 999,
    cursor: 'pointer',
    textDecoration: 'none',
    border: 'none',
    background: primary ? 'var(--accent)' : 'transparent',
    fontFamily: 'inherit',
  })

  return (
    <>
      {showOpening && acc && (
        <OpeningChecklistModal
          shop={shop} systemLaptopCount={systemLaptopCount}
          onClose={() => {
            if (typeof window !== 'undefined') localStorage.setItem('shopboss_day_started_' + localDayISO(), 'true')
            setShowOpening(false)
          }}
          onDone={() => {
            if (typeof window !== 'undefined') localStorage.setItem('shopboss_day_started_' + localDayISO(), 'true')
            setShowOpening(false)
            load()
          }}
        />
      )}
      {showClosing && acc && (
        <ClosingChecklistModal
          shop={shop} acc={acc}
          onClose={() => setShowClosing(false)}
          onDone={() => { setShowClosing(false); load() }}
        />
      )}
      {snapshotData && (
        <SnapshotModal
          data={snapshotData}
          onSave={saveSnapshot}
          onClose={() => setSnapshotData(null)}
        />
      )}
      {diffData && <DiffModal data={diffData} onClose={() => setDiffData(null)} />}

      <div style={{ maxWidth: 1120, marginInline: 'auto' }}>

        {/* Setup banner */}
        {shop && (!shop.owner_name || shop.name === 'My Shop') && <SetupBanner />}

        {/* ── Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 32, letterSpacing: '-0.02em', lineHeight: '40px' }}>Dashboard</h1>
            <p style={{ color: 'var(--text-3)', fontSize: 13, marginTop: 5 }}>{today}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
            {!acc?.hasOpening && (
              <button onClick={() => setShowOpening(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--bg-3)', border: '1px solid var(--accent)', borderRadius: 8, padding: '9px 18px', color: 'var(--accent)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                <Clock size={14} /> Start Day
              </button>
            )}
            {hour >= 18 && acc?.hasOpening && !acc?.record?.is_closed && (
              <button onClick={() => setShowClosing(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 8, padding: '9px 18px', color: 'var(--success)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                <CheckCircle size={14} /> Close Day
              </button>
            )}
          </div>
        </div>

        {/* ── Presence buttons */}
        {isOperational && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 32 }}>
            <button onClick={handleLeave} disabled={snapshotLoading} style={{ height: 'auto', minHeight: 54, background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#4b2800', fontWeight: 700, fontSize: 15, cursor: snapshotLoading ? 'not-allowed' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '10px 18px', letterSpacing: '-0.01em', opacity: snapshotLoading ? 0.7 : 1, fontFamily: 'inherit' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}><LogOut size={17} /> {snapshotLoading ? 'Preparing…' : 'I Am Leaving'}</span>
              <span style={{ fontSize: 10, fontWeight: 400, color: '#7a4010', letterSpacing: 0 }}>Tap when stepping out — saves a snapshot of your shop</span>
            </button>
            <button onClick={handleReturn} disabled={diffLoading} style={{ height: 'auto', minHeight: 54, background: 'transparent', border: '1px solid var(--border-2)', borderRadius: 8, color: 'var(--text-2)', fontWeight: 600, fontSize: 15, cursor: diffLoading ? 'not-allowed' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '10px 18px', letterSpacing: '-0.01em', opacity: diffLoading ? 0.7 : 1, fontFamily: 'inherit' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}><LogIn size={17} /> {diffLoading ? 'Loading…' : 'I Am Back'}</span>
              <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-3)', letterSpacing: 0 }}>Tap when you return — see what changed</span>
            </button>
          </div>
        )}

        {/* Smart alerts */}
        {visibleAlerts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
            {visibleAlerts.map(alert => (
              <AlertCard key={alert.id} alert={alert} onDismiss={handleDismiss} />
            ))}
          </div>
        )}

        {/* ── TODAY */}
        <SectionHead label="Today" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 28 }}>
          <StatCard label="Revenue" value={fmtRs(todayRevenue)} sub="laptops + accessories" href="/sales" />
          <StatCard label="Net Profit" value={acc ? fmtRs(acc.netProfit) : '—'} color={acc && acc.netProfit >= 0 ? 'var(--success)' : 'var(--danger)'} href="/sales" />
          <StatCard label="Cash in Drawer" value={acc ? fmtRs(acc.expectedDrawer) : '—'} sub="expected balance" href="/cash" color="var(--text)" />
          <StatCard label="Udhaar Recovered" value={fmtRs(alertCounts?.udhaarRecoveredToday ?? 0)} sub="received today" href="/udhaar" color={alertCounts && alertCounts.udhaarRecoveredToday > 0 ? 'var(--success)' : 'var(--text-3)'} />
        </div>

        {/* ── THIS MONTH */}
        <SectionHead label="This Month" />
        <p style={{ color: 'var(--text-3)', fontSize: 11, marginTop: -8, marginBottom: 12 }}>Based on all recorded sales this month</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 28 }}>
          <StatCard label="Month Revenue" value={monthStats ? fmtRs(monthStats.revenue) : '—'} href="/sales" />
          <StatCard label="Month Profit" value={monthStats ? fmtRs(monthStats.profit) : '—'} color={monthStats && monthStats.profit >= 0 ? 'var(--success)' : 'var(--danger)'} href="/sales" />
          <StatCard label="Stock Value" value={monthStats ? fmtRs(monthStats.stockValue) : '—'} sub="at purchase cost" href="/inventory" color="var(--text)" />
          <StatCard label="Udhaar Outstanding" value={monthStats ? fmtRs(monthStats.udhaarOutstanding) : '—'} color="var(--warning)" href="/udhaar" />
        </div>

        {/* ── ALERTS */}
        {alertCounts && (
          <>
            <SectionHead label="Alerts" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 28 }}>
              <StatCard label="Laptops 60+ Days" value={String(alertCounts.laptops60Plus)} color={alertCounts.laptops60Plus > 0 ? 'var(--danger)' : 'var(--text-3)'} alert={alertCounts.laptops60Plus > 0} sub={alertCounts.laptops60Plus > 0 ? 'Dead stock — reduce prices' : 'All good'} href="/reports" />
              <StatCard label="Udhaar Overdue" value={alertCounts.udhaarOverdueCount > 0 ? `${alertCounts.udhaarOverdueCount} records` : '0'} sub={alertCounts.udhaarOverdueCount > 0 ? fmtRs(alertCounts.udhaarOverdueAmount) : 'All on time'} color={alertCounts.udhaarOverdueCount > 0 ? 'var(--danger)' : 'var(--text-3)'} alert={alertCounts.udhaarOverdueCount > 0} href="/udhaar" />
              <StatCard label="Supplier Due" value={alertCounts.supplierDueThisWeek > 0 ? fmtRs(alertCounts.supplierDueThisWeek) : 'None'} sub="due this week" color={alertCounts.supplierDueThisWeek > 0 ? 'var(--warning)' : 'var(--text-3)'} warn={alertCounts.supplierDueThisWeek > 0} href="/udhaar" />
              <StatCard label="Low Accessories" value={alertCounts.lowAccessories.length === 0 ? 'All stocked' : `${alertCounts.lowAccessories.length} categories`} sub={alertCounts.lowAccessories.length > 0 ? alertCounts.lowAccessories.slice(0, 2).join(', ') + (alertCounts.lowAccessories.length > 2 ? ` +${alertCounts.lowAccessories.length - 2}` : '') : 'No restocking needed'} color={alertCounts.lowAccessories.length > 0 ? 'var(--warning)' : 'var(--text-3)'} warn={alertCounts.lowAccessories.length > 0} href="/accessories" />
            </div>
          </>
        )}

        {/* ── P&L + Cash side by side */}
        {acc && (
          <div style={{ marginBottom: 32 }}>
            <DailyPnL acc={acc} />
          </div>
        )}

        {/* Expired notice */}
        {!isOperational && (
          <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 8, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <AlertTriangle size={18} style={{ color: 'var(--danger)', flexShrink: 0 }} />
            <div>
              <p style={{ color: 'var(--danger)', fontWeight: 600, fontSize: 14 }}>Subscription expired</p>
              <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 2 }}>
                Your shop is read-only.{' '}
                <Link href="/billing" style={{ color: 'var(--accent)' }}>Renew now →</Link>
              </p>
            </div>
          </div>
        )}

      </div>

      {/* ── Floating bottom action bar */}
      <div style={{ position: 'fixed', bottom: 20, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 100 }} className="left-0 md:left-[240px]">
        <div style={{ background: 'var(--bg-5)', border: '1px solid var(--border-2)', borderRadius: 999, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 2, pointerEvents: 'all', boxShadow: '0 8px 40px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.35)' }}>

          <Link href="/inventory/add" style={barBtn(true)}>
            <Package size={17} style={{ color: '#4b2800' }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: '#4b2800', whiteSpace: 'nowrap', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Add Laptop</span>
          </Link>

          <div style={{ width: 1, height: 26, background: 'var(--border-2)', margin: '0 4px' }} />

          <Link href="/sales/new" style={barBtn()}>
            <ShoppingCart size={17} style={{ color: 'var(--text-3)' }} />
            <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-3)', whiteSpace: 'nowrap', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Record Sale</span>
          </Link>

          <Link href="/udhaar/new" style={barBtn()}>
            <CreditCard size={17} style={{ color: 'var(--text-3)' }} />
            <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-3)', whiteSpace: 'nowrap', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Log Udhaar</span>
          </Link>

          <Link href="/cash/expense" style={barBtn()}>
            <DollarSign size={17} style={{ color: 'var(--text-3)' }} />
            <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-3)', whiteSpace: 'nowrap', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Log Expense</span>
          </Link>

          <div style={{ width: 1, height: 26, background: 'var(--border-2)', margin: '0 4px' }} />

          <Link href="/reports" style={barBtn()}>
            <TrendingUp size={17} style={{ color: 'var(--text-3)' }} />
            <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-3)', whiteSpace: 'nowrap', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Reports</span>
          </Link>

          <Link href="/inventory" style={barBtn()}>
            <Boxes size={17} style={{ color: 'var(--text-3)' }} />
            <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-3)', whiteSpace: 'nowrap', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Inventory</span>
          </Link>

        </div>
      </div>
    </>
  )
}
