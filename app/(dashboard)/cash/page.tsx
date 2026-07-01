'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useShop } from '@/hooks/useShop'
import { loadDailyAccounting, localDayISO, type DailyAccounting } from '@/lib/utils/daily-accounting'
import { Wallet, Plus, Lock, ArrowDownRight, ArrowUpRight, CheckCircle, Building2, DollarSign } from 'lucide-react'
import toast from 'react-hot-toast'

const fmtRs = (n: number) => `Rs ${Math.round(n).toLocaleString('en-PK')}`
const fmtTime = (s: string) => new Date(s).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })

interface FeedEvent {
  id: string
  at: string
  label: string
  amount: number
  sign: 1 | -1
  running: number
}

// ─── Bank Tab ─────────────────────────────────────────────────────────────────

interface BankTx {
  id: string
  transaction_type: string
  amount: number
  direction: string
  description: string | null
  reference_number: string | null
  transaction_date: string
  created_at: string
}

interface SaleTx { id: string; sale_price: number; sold_at: string; customer_name: string | null }
interface PayTx { id: string; amount_paid: number; payment_date: string }
interface ExpTx { id: string; amount: number; category: string; expense_date: string }

function BankTab({ shopId, cashInDrawer }: { shopId: string; cashInDrawer: number }) {
  const [bankTxns, setBankTxns] = useState<BankTx[]>([])
  const [bankSalesAll, setBankSalesAll] = useState(0)
  const [bankUdhaarAll, setBankUdhaarAll] = useState(0)
  const [bankExpAll, setBankExpAll] = useState(0)
  const [todayBankSales, setTodayBankSales] = useState<SaleTx[]>([])
  const [todayBankUdhaar, setTodayBankUdhaar] = useState<PayTx[]>([])
  const [todayBankExp, setTodayBankExp] = useState<ExpTx[]>([])
  const [loading, setLoading] = useState(true)
  const [setupRequired, setSetupRequired] = useState(false)

  // Manual entry form
  const [entryType, setEntryType] = useState<'deposit' | 'withdrawal'>('deposit')
  const [entryAmount, setEntryAmount] = useState('')
  const [entryDesc, setEntryDesc] = useState('')
  const [entryRef, setEntryRef] = useState('')
  const [saving, setSaving] = useState(false)

  const today = localDayISO()

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    const [
      { data: txns, error: txErr },
      { data: allSales },
      { data: allUdhaar },
      { data: allExp },
      { data: todaySales },
      { data: todayUdhaar },
      { data: todayExp },
    ] = await Promise.all([
      supabase.from('bank_transactions').select('*').eq('shop_id', shopId).order('created_at', { ascending: false }),
      supabase.from('sales').select('sale_price').eq('shop_id', shopId).eq('payment_type', 'bank_transfer').eq('is_voided', false),
      supabase.from('udhaar_payments').select('amount_paid').eq('shop_id', shopId).eq('payment_method', 'bank'),
      supabase.from('expenses').select('amount').eq('shop_id', shopId).eq('payment_type', 'bank'),
      supabase.from('sales').select('id,sale_price,sold_at,customer_name').eq('shop_id', shopId).eq('payment_type', 'bank_transfer').eq('is_voided', false).gte('sold_at', today + 'T00:00:00').lte('sold_at', today + 'T23:59:59'),
      supabase.from('udhaar_payments').select('id,amount_paid,payment_date').eq('shop_id', shopId).eq('payment_method', 'bank').eq('payment_date', today),
      supabase.from('expenses').select('id,amount,category,expense_date').eq('shop_id', shopId).eq('payment_type', 'bank').eq('expense_date', today),
    ])

    if (txErr && txErr.message.includes('does not exist')) {
      setSetupRequired(true)
      setLoading(false)
      return
    }

    setBankTxns((txns ?? []) as BankTx[])
    setBankSalesAll((allSales ?? []).reduce((s: number, r: { sale_price: number }) => s + r.sale_price, 0))
    setBankUdhaarAll((allUdhaar ?? []).reduce((s: number, r: { amount_paid: number }) => s + r.amount_paid, 0))
    setBankExpAll((allExp ?? []).reduce((s: number, r: { amount: number }) => s + r.amount, 0))
    setTodayBankSales((todaySales ?? []) as SaleTx[])
    setTodayBankUdhaar((todayUdhaar ?? []) as PayTx[])
    setTodayBankExp((todayExp ?? []) as ExpTx[])
    setLoading(false)
  }, [shopId, today])

  useEffect(() => { load() }, [load])

  const manualTxBalance = bankTxns.reduce((s, t) => s + (t.direction === 'in' ? t.amount : -t.amount), 0)
  const bankBalance = manualTxBalance + bankSalesAll + bankUdhaarAll - bankExpAll
  const totalLiquid = cashInDrawer + bankBalance

  const addEntry = async () => {
    const amount = parseFloat(entryAmount)
    if (isNaN(amount) || amount <= 0) { toast.error('Enter a valid amount'); return }
    setSaving(true)
    const res = await fetch('/api/cash/bank-entry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shop_id: shopId,
        transaction_type: entryType,
        amount,
        direction: entryType === 'deposit' ? 'in' : 'out',
        description: entryDesc.trim() || null,
        reference_number: entryRef.trim() || null,
        transaction_date: today,
      }),
    })
    setSaving(false)
    if (!res.ok) { toast.error('Something went wrong. Please try again.'); return }
    toast.success(entryType === 'deposit' ? 'Deposit recorded' : 'Withdrawal recorded')
    setEntryAmount(''); setEntryDesc(''); setEntryRef('')
    load()
  }

  if (loading) return <div style={{ color: 'var(--text-3)', fontSize: 14 }}>Loading bank…</div>

  if (setupRequired) {
    return (
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14, padding: '32px 28px', textAlign: 'center' }}>
        <Building2 size={32} style={{ color: 'var(--text-3)', marginBottom: 12 }} />
        <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Database setup required</h2>
        <p style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 16 }}>
          Run migration <code>010_bank_and_budgets.sql</code> in your Supabase dashboard to enable bank tracking.
        </p>
      </div>
    )
  }

  // Today's bank feed
  type BankFeedItem = { id: string; at: string; label: string; amount: number; sign: 1 | -1 }
  const todayFeed: BankFeedItem[] = [
    ...todayBankSales.map(s => ({ id: 'sale-' + s.id, at: s.sold_at, label: `Bank sale${s.customer_name ? ' — ' + s.customer_name : ''}`, amount: s.sale_price, sign: 1 as const })),
    ...todayBankUdhaar.map(p => ({ id: 'pay-' + p.id, at: p.payment_date + 'T12:00:00', label: 'Udhaar payment received (bank)', amount: p.amount_paid, sign: 1 as const })),
    ...todayBankExp.map(e => ({ id: 'exp-' + e.id, at: e.expense_date + 'T12:00:00', label: `Expense — ${e.category}`, amount: e.amount, sign: -1 as const })),
    ...bankTxns.filter(t => t.transaction_date === today).map(t => ({ id: t.id, at: t.created_at, label: t.description ?? (t.transaction_type === 'deposit' ? 'Deposit' : t.transaction_type === 'withdrawal' ? 'Withdrawal' : t.transaction_type), amount: t.amount, sign: (t.direction === 'in' ? 1 : -1) as 1 | -1 })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())

  return (
    <div>
      {/* Combined position */}
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>Total liquid position</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0 }}>
          {[
            { label: 'Cash in drawer', value: cashInDrawer, icon: <Wallet size={16} />, color: 'var(--text)' },
            { label: 'Bank balance', value: bankBalance, icon: <Building2 size={16} />, color: 'var(--info)' },
            { label: 'Total liquid assets', value: totalLiquid, icon: <DollarSign size={16} />, color: 'var(--accent-2)' },
          ].map((item, i) => (
            <div key={item.label} style={{ padding: '18px 20px', borderLeft: i > 0 ? '1px solid var(--border)' : 'none', background: i === 2 ? 'var(--accent-bg)' : 'transparent' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-3)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                <span style={{ color: item.color }}>{item.icon}</span>
                {item.label.toUpperCase()}
              </div>
              <p style={{ color: item.color, fontWeight: 800, fontSize: 22 }}>{fmtRs(item.value)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Current bank balance */}
      <div style={{ background: 'var(--bg-2)', border: '2px solid var(--info-border)', borderRadius: 14, padding: '24px 28px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ color: 'var(--text-3)', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>CURRENT BANK BALANCE</p>
          <p style={{ color: bankBalance >= 0 ? 'var(--info)' : 'var(--danger)', fontWeight: 800, fontSize: 32 }}>{fmtRs(bankBalance)}</p>
          <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 4 }}>
            Sales: +{fmtRs(bankSalesAll)} · Udhaar received: +{fmtRs(bankUdhaarAll)} · Expenses: −{fmtRs(bankExpAll)} · Manual: {fmtRs(manualTxBalance)}
          </p>
        </div>
        <Building2 size={40} style={{ color: 'var(--info)', opacity: 0.4 }} />
      </div>

      {/* Manual entry */}
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
        <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Record manual entry</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {(['deposit', 'withdrawal'] as const).map(t => (
            <button key={t} onClick={() => setEntryType(t)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: `1px solid ${entryType === t ? (t === 'deposit' ? 'var(--success)' : 'var(--danger)') : 'var(--border)'}`, background: entryType === t ? (t === 'deposit' ? 'var(--success-bg)' : 'var(--danger-bg)') : 'var(--bg-3)', color: entryType === t ? (t === 'deposit' ? 'var(--success)' : 'var(--danger)') : 'var(--text-2)', fontWeight: 600, fontSize: 13, cursor: 'pointer', textTransform: 'capitalize' }}>
              {t === 'deposit' ? '+ Deposit' : '− Withdrawal'}
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
          <input
            type="number" placeholder="Amount (Rs)" value={entryAmount} onChange={e => setEntryAmount(e.target.value)}
            style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
          />
          <input
            placeholder="Description" value={entryDesc} onChange={e => setEntryDesc(e.target.value)}
            style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
          />
          <input
            placeholder="Reference # (optional)" value={entryRef} onChange={e => setEntryRef(e.target.value)}
            style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <button onClick={addEntry} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, background: entryType === 'deposit' ? 'var(--success)' : 'var(--danger)', border: 'none', borderRadius: 8, padding: '10px 20px', color: '#fff', fontWeight: 600, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          <Plus size={14} /> {saving ? 'Saving…' : entryType === 'deposit' ? 'Record Deposit' : 'Record Withdrawal'}
        </button>
      </div>

      {/* Today's bank activity */}
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>Today&apos;s bank activity</p>
        </div>
        {todayFeed.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-3)', fontSize: 14 }}>No bank transactions today.</p>
          </div>
        ) : (
          todayFeed.map((e) => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid var(--border)', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span style={{ display: 'inline-flex', width: 26, height: 26, borderRadius: '50%', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: e.sign === 1 ? 'var(--success-bg)' : 'var(--danger-bg)' }}>
                  {e.sign === 1 ? <ArrowDownRight size={14} style={{ color: 'var(--success)' }} /> : <ArrowUpRight size={14} style={{ color: 'var(--danger)' }} />}
                </span>
                <p style={{ color: 'var(--text)', fontSize: 13, fontWeight: 500 }}>{e.label}</p>
              </div>
              <p style={{ color: e.sign === 1 ? 'var(--success)' : 'var(--danger)', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                {e.sign === 1 ? '+' : '−'}{fmtRs(e.amount)}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

type ActiveTab = 'cash' | 'bank'

export default function CashPage() {
  const { shop } = useShop()
  const [acc, setAcc] = useState<DailyAccounting | null>(null)
  const [loading, setLoading] = useState(true)
  const [openingInput, setOpeningInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<ActiveTab>('cash')

  const load = useCallback(async () => {
    if (!shop) return
    const supabase = createClient()
    const data = await loadDailyAccounting(supabase, shop.id)
    setAcc(data)
    setLoading(false)
  }, [shop])

  useEffect(() => { load() }, [load])

  const setOpening = async () => {
    if (!shop) return
    const amount = parseFloat(openingInput)
    if (isNaN(amount) || amount < 0) { toast.error('Enter a valid amount'); return }
    setSaving(true)
    const res = await fetch('/api/cash/set-opening', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shop_id: shop.id, record_date: localDayISO(), opening_balance: amount }),
    })
    setSaving(false)
    if (!res.ok) { toast.error('Something went wrong. Please try again.'); return }
    toast.success('Opening balance set')
    load()
  }

  if (loading || !acc || !shop) return <div style={{ color: 'var(--text-3)', fontSize: 14 }}>Loading cash…</div>

  // Build chronological cash-drawer feed
  const raw: Omit<FeedEvent, 'running'>[] = []
  if (acc.record) {
    raw.push({ id: 'opening', at: acc.record.created_at, label: 'Opening balance', amount: acc.opening, sign: 1 })
  }
  acc.cashSalesList.forEach((s) => raw.push({ id: s.id, at: s.at, label: s.label, amount: s.amount, sign: 1 }))
  acc.expensesList
    .filter((e) => e.payment_type === 'cash')
    .forEach((e) => raw.push({ id: e.id, at: e.created_at, label: `Expense — ${e.category}: ${e.description}`, amount: e.amount, sign: -1 }))
  raw.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
  let running = 0
  const feed: FeedEvent[] = raw.map((e) => { running += e.sign * e.amount; return { ...e, running } })

  const closed = acc.record?.is_closed

  const calcRows: { label: string; value: number; sign: '+' | '−' | '='; strong?: boolean }[] = [
    { label: 'Opening balance', value: acc.opening, sign: '+' },
    { label: 'Cash sales today', value: acc.cashSales, sign: '+' },
    { label: 'Udhaar recovered today', value: acc.udhaarRecovered, sign: '+' },
    { label: 'Cash expenses today', value: acc.cashExpenses, sign: '−' },
    { label: 'Expected cash in drawer', value: acc.expectedDrawer, sign: '=', strong: true },
  ]

  return (
    <div style={{ maxWidth: 780, marginInline: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 32, marginBottom: 2 }}>Cash &amp; Bank</h1>
          <p style={{ color: 'var(--text-3)', fontSize: 13 }}>{new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/cash/expense" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', color: 'var(--text-2)', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
            <Plus size={14} /> Log Expense
          </Link>
          <Link href="/cash/close" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: closed ? 'var(--bg-2)' : 'var(--accent)', border: closed ? '1px solid var(--border)' : 'none', borderRadius: 8, padding: '9px 16px', color: closed ? 'var(--text-2)' : 'var(--bg)', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            <Lock size={14} /> {closed ? 'View Closing' : 'Close Day'}
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {([['cash', 'Cash Drawer', <Wallet key="w" size={14} />], ['bank', 'Bank Account', <Building2 key="b" size={14} />]] as [ActiveTab, string, React.ReactNode][]).map(([t, label, icon]) => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 9, background: activeTab === t ? 'var(--accent)' : 'var(--bg-2)', border: `1px solid ${activeTab === t ? 'var(--accent)' : 'var(--border)'}`, color: activeTab === t ? 'var(--bg)' : 'var(--text-2)', fontWeight: activeTab === t ? 700 : 500, fontSize: 14, cursor: 'pointer' }}>
            {icon} {label}
          </button>
        ))}
      </div>

      {/* Cash Tab */}
      {activeTab === 'cash' && (
        <>
          {!acc.hasOpening ? (
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--accent)', borderRadius: 14, padding: '32px 28px', textAlign: 'center', marginBottom: 24 }}>
              <Wallet size={32} style={{ color: 'var(--accent)', marginBottom: 12 }} />
              <h2 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 19, marginBottom: 6 }}>Enter today&apos;s opening cash balance</h2>
              <p style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 20 }}>How much cash is in the drawer to start the day?</p>
              <div style={{ display: 'flex', gap: 10, maxWidth: 360, marginInline: 'auto' }}>
                <input
                  type="number" min={0} autoFocus
                  value={openingInput}
                  onChange={(e) => setOpeningInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') setOpening() }}
                  placeholder="0"
                  style={{ flex: 1, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', color: 'var(--text)', fontSize: 22, fontWeight: 700, outline: 'none', textAlign: 'center', boxSizing: 'border-box' }}
                />
                <button onClick={setOpening} disabled={saving} style={{ background: 'var(--accent)', border: 'none', borderRadius: 10, padding: '0 22px', color: 'var(--bg)', fontWeight: 700, fontSize: 15, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                  {saving ? '…' : 'Set'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircle size={16} style={{ color: 'var(--success)' }} />
              <p style={{ color: 'var(--text)', fontSize: 14 }}>
                Opening balance: <strong>{fmtRs(acc.opening)}</strong>
                <span style={{ color: 'var(--text-3)', fontSize: 12, marginLeft: 8 }}>(set at {acc.record ? fmtTime(acc.record.created_at) : ''})</span>
              </p>
            </div>
          )}

          {acc.hasOpening && (
            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>Live cash position</p>
              </div>
              {calcRows.map((r) => (
                <div key={r.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: r.strong ? '14px 18px' : '10px 18px', borderTop: r.strong ? '1px solid var(--border)' : 'none', background: r.strong ? 'var(--accent-bg)' : 'transparent' }}>
                  <span style={{ color: r.strong ? 'var(--accent-2)' : 'var(--text-2)', fontSize: r.strong ? 15 : 13, fontWeight: r.strong ? 700 : 500 }}>
                    <span style={{ display: 'inline-block', width: 16, color: 'var(--text-3)' }}>{r.sign}</span>
                    {r.label}
                  </span>
                  <span style={{ color: r.strong ? 'var(--accent-2)' : (r.sign === '−' ? 'var(--danger)' : 'var(--text)'), fontSize: r.strong ? 20 : 14, fontWeight: r.strong ? 800 : 600 }}>
                    {fmtRs(r.value)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
              <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>Today&apos;s transactions</p>
            </div>
            {feed.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-3)', fontSize: 14 }}>No cash activity today yet.</p>
              </div>
            ) : (
              feed.map((e) => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid var(--border)', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span style={{ display: 'inline-flex', width: 26, height: 26, borderRadius: '50%', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: e.sign === 1 ? 'var(--success-bg)' : 'var(--danger-bg)' }}>
                      {e.sign === 1 ? <ArrowDownRight size={14} style={{ color: 'var(--success)' }} /> : <ArrowUpRight size={14} style={{ color: 'var(--danger)' }} />}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ color: 'var(--text)', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.label}</p>
                      <p style={{ color: 'var(--text-3)', fontSize: 11 }}>{fmtTime(e.at)}</p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ color: e.sign === 1 ? 'var(--success)' : 'var(--danger)', fontWeight: 700, fontSize: 14 }}>
                      {e.sign === 1 ? '+' : '−'}{fmtRs(e.amount)}
                    </p>
                    <p style={{ color: 'var(--text-3)', fontSize: 11 }}>bal {fmtRs(e.running)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Bank Tab */}
      {activeTab === 'bank' && (
        <BankTab shopId={shop.id} cashInDrawer={acc.expectedDrawer} />
      )}
    </div>
  )
}
