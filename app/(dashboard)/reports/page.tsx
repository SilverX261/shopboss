'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useShop } from '@/hooks/useShop'
import { loadDailyAccounting, localDayISO, dayBounds } from '@/lib/utils/daily-accounting'
import { DailyPnL } from '@/components/cash/DailyPnL'
import { Download, FileText, Calendar, TrendingUp, Package, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtRs = (n: number) => `Rs ${Math.round(n).toLocaleString('en-PK')}`
const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })
const pct = (n: number, d: number) => d > 0 ? `${Math.round((n / d) * 100)}%` : '0%'

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
}
function monthISO(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function Tab({ label, icon, active, onClick }: { label: string; icon: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '10px 20px', borderRadius: 10,
      background: active ? 'var(--accent)' : 'var(--bg-2)',
      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
      color: active ? 'var(--bg)' : 'var(--text-2)',
      fontWeight: active ? 700 : 500, fontSize: 14,
      cursor: 'pointer', transition: 'all 0.15s',
    }}>
      {icon} {label}
    </button>
  )
}

function Card({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
      <p style={{ color: 'var(--text-3)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{label}</p>
      <p style={{ color: color ?? 'var(--text)', fontWeight: 700, fontSize: 24 }}>{value}</p>
      {sub && <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 4 }}>{sub}</p>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 20 }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
        <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>{title}</p>
      </div>
      <div style={{ padding: '16px 20px' }}>{children}</div>
    </div>
  )
}

const PIE_COLORS = ['var(--accent)', 'var(--success)', 'var(--warning)', 'var(--danger)', 'var(--info)', '#8b5cf6', '#ec4899']

// ─── DAILY TAB ────────────────────────────────────────────────────────────────

function DailyReport({ shopId }: { shopId: string }) {
  const today = localDayISO()
  const [date, setDate] = useState(today)
  const [acc, setAcc] = useState<Awaited<ReturnType<typeof loadDailyAccounting>> | null>(null)
  const [udhaarGiven, setUdhaarGiven] = useState(0)
  const [udhaarRecoveredAll, setUdhaarRecoveredAll] = useState(0)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const d = new Date(date + 'T12:00:00')
    const { startISO, endISO } = dayBounds(d)
    const [result, { data: udhaarData }, { data: udhaarPayData }] = await Promise.all([
      loadDailyAccounting(supabase, shopId, d),
      supabase.from('udhaar_records').select('total_amount, created_at').eq('shop_id', shopId).gte('created_at', startISO).lte('created_at', endISO),
      supabase.from('udhaar_payments').select('amount_paid, payment_method').eq('shop_id', shopId).eq('payment_date', date),
    ])
    setAcc(result)
    setUdhaarGiven((udhaarData ?? []).reduce((s: number, u: { total_amount: number }) => s + u.total_amount, 0))
    setUdhaarRecoveredAll((udhaarPayData ?? []).reduce((s: number, p: { amount_paid: number }) => s + p.amount_paid, 0))
    setLoading(false)
  }, [shopId, date])

  useEffect(() => { load() }, [load])

  const exportPDF = async () => {
    if (!acc) return
    try {
      const { pdf } = await import('@react-pdf/renderer')
      const React = await import('react')
      const { Document, Page, Text, View, StyleSheet } = await import('@react-pdf/renderer')
      const styles = StyleSheet.create({
        page: { padding: 32, fontFamily: 'Helvetica', fontSize: 10 },
        title: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
        sub: { fontSize: 10, color: '#666', marginBottom: 20 },
        section: { marginBottom: 14 },
        sectionTitle: { fontSize: 12, fontWeight: 'bold', marginBottom: 6, color: '#333' },
        row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
        label: { color: '#555' },
        value: { fontWeight: 'bold' },
      })
      const doc = React.default.createElement(Document, null,
        React.default.createElement(Page, { size: 'A4', style: styles.page },
          React.default.createElement(Text, { style: styles.title }, 'Daily Report'),
          React.default.createElement(Text, { style: styles.sub }, `Date: ${date}`),
          React.default.createElement(View, { style: styles.section },
            React.default.createElement(Text, { style: styles.sectionTitle }, 'Profit & Loss'),
            ...[
              ['Revenue', fmtRs(acc.revenue)],
              ['Purchase Cost', fmtRs(acc.cogs)],
              ['Gross Profit', `${fmtRs(acc.grossProfit)} (${pct(acc.grossProfit, acc.revenue)})`],
              ['Expenses', fmtRs(acc.totalExpenses)],
              ['Net Profit', fmtRs(acc.netProfit)],
            ].map(([l, v]) => React.default.createElement(View, { key: l, style: styles.row },
              React.default.createElement(Text, { style: styles.label }, l),
              React.default.createElement(Text, { style: styles.value }, v),
            )),
          ),
          React.default.createElement(View, { style: styles.section },
            React.default.createElement(Text, { style: styles.sectionTitle }, 'Cash Position'),
            ...[
              ['Opening Balance', fmtRs(acc.opening)],
              ['Cash Sales', fmtRs(acc.cashSales)],
              ['Udhaar Recovered (cash)', fmtRs(acc.udhaarRecovered)],
              ['Cash Expenses', fmtRs(acc.cashExpenses)],
              ['Expected Drawer', fmtRs(acc.expectedDrawer)],
            ].map(([l, v]) => React.default.createElement(View, { key: l, style: styles.row },
              React.default.createElement(Text, { style: styles.label }, l),
              React.default.createElement(Text, { style: styles.value }, v),
            )),
          ),
        )
      )
      const blob = await pdf(doc).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `daily-report-${date}.pdf`; a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Could not export PDF. Please try again.')
    }
  }

  const grossMargin = acc && acc.revenue > 0 ? Math.round((acc.grossProfit / acc.revenue) * 100) : 0

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={14} style={{ color: 'var(--text-3)' }} />
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', color: 'var(--text)', fontSize: 13, outline: 'none' }} />
        </div>
        <button onClick={exportPDF} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--info-bg)', border: '1px solid var(--info-border)', borderRadius: 8, padding: '8px 14px', color: 'var(--info)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <FileText size={13} /> Export PDF
        </button>
      </div>

      {loading && <p style={{ color: 'var(--text-3)', fontSize: 14 }}>Loading…</p>}

      {!loading && acc && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
            <Card label="REVENUE" value={fmtRs(acc.revenue)} />
            <Card label="PURCHASE COST" value={fmtRs(acc.cogs)} sub="purchase cost" />
            <Card label="GROSS PROFIT" value={fmtRs(acc.grossProfit)} sub={`${grossMargin}% margin`} color={acc.grossProfit >= 0 ? 'var(--success)' : 'var(--danger)'} />
            <Card label="EXPENSES" value={fmtRs(acc.totalExpenses)} />
            <Card label="NET PROFIT" value={fmtRs(acc.netProfit)} color={acc.netProfit >= 0 ? 'var(--success)' : 'var(--danger)'} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <DailyPnL acc={acc} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
            <Card label="OPENING BALANCE" value={fmtRs(acc.opening)} />
            <Card label="CASH IN DRAWER" value={fmtRs(acc.expectedDrawer)} />
            <Card label="UDHAAR GIVEN TODAY" value={fmtRs(udhaarGiven)} color="var(--warning)" />
            <Card label="UDHAAR RECOVERED" value={fmtRs(udhaarRecoveredAll)} sub="all payment methods" color="var(--success)" />
            <Card label="NET CASH IMPACT" value={fmtRs(udhaarRecoveredAll - udhaarGiven)} color={udhaarRecoveredAll >= udhaarGiven ? 'var(--success)' : 'var(--danger)'} />
          </div>

          {acc.expensesList.length > 0 && (
            <Section title="Expense Breakdown">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Category', 'Description', 'Payment', 'Amount'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-3)', fontSize: 11, fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {acc.expensesList.map(e => (
                    <tr key={e.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 12px', color: 'var(--text)', fontSize: 13 }}>{e.category}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-2)', fontSize: 12 }}>{e.description}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ background: e.payment_type === 'cash' ? 'var(--success-bg)' : 'var(--info-bg)', color: e.payment_type === 'cash' ? 'var(--success)' : 'var(--info)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{e.payment_type}</span>
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--danger)', fontWeight: 600, fontSize: 13 }}>{fmtRs(e.amount)}</td>
                    </tr>
                  ))}
                  <tr style={{ background: 'var(--bg-3)' }}>
                    <td colSpan={3} style={{ padding: '8px 12px', color: 'var(--text-2)', fontWeight: 600, fontSize: 13 }}>Total</td>
                    <td style={{ padding: '8px 12px', color: 'var(--danger)', fontWeight: 700, fontSize: 14 }}>{fmtRs(acc.totalExpenses)}</td>
                  </tr>
                </tbody>
              </table>
            </Section>
          )}
        </>
      )}
    </div>
  )
}

// ─── MONTHLY TAB ──────────────────────────────────────────────────────────────

interface MonthSaleRow {
  sale_price: number; profit: number; sold_at: string
  laptops: { brand: string; model: string; purchase_price: number } | null
}
interface MonthAccRow {
  value: number; created_at: string; transaction_type: string
}
interface MonthExpRow {
  amount: number; category: string; expense_date: string
}
interface MonthUdhaarRow {
  total_amount: number; created_at: string
}
interface MonthPayRow {
  amount_paid: number; payment_date: string
}
interface BudgetRow {
  category: string; monthly_budget: number
}

function BreakEvenCard({ totalExpenses, sales }: { totalExpenses: number; sales: MonthSaleRow[] }) {
  if (sales.length === 0) return null
  const avgProfit = sales.reduce((s, r) => s + r.profit, 0) / sales.length
  if (avgProfit <= 0) return null
  const laptopsNeeded = Math.ceil(totalExpenses / avgProfit)
  const soldCount = sales.length
  const broke = soldCount >= laptopsNeeded
  const pctDone = Math.min(100, Math.round((soldCount / laptopsNeeded) * 100))

  return (
    <div style={{ background: 'var(--bg-2)', border: `1px solid ${broke ? 'var(--success-border)' : 'var(--border)'}`, borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
      <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Break-even Analysis</p>
      <p style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 16 }}>
        Avg profit per laptop: <strong style={{ color: 'var(--text)' }}>{fmtRs(Math.round(avgProfit))}</strong> ·
        Total expenses: <strong style={{ color: 'var(--text)' }}>{fmtRs(totalExpenses)}</strong> ·
        Laptops needed to break even: <strong style={{ color: 'var(--text)' }}>{laptopsNeeded}</strong>
      </p>
      {/* Progress bar */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ background: 'var(--bg-3)', borderRadius: 999, height: 14, overflow: 'hidden', position: 'relative' }}>
          <div style={{ background: broke ? 'var(--success)' : 'var(--accent)', height: '100%', width: `${pctDone}%`, borderRadius: 999, transition: 'width 0.4s ease' }} />
          {!broke && (
            <div style={{ position: 'absolute', top: 0, left: `${Math.min(pctDone, 90)}%`, height: '100%', borderLeft: '2px dashed var(--text-3)', opacity: 0.5 }} />
          )}
        </div>
        <p style={{ color: 'var(--text-3)', fontSize: 11, marginTop: 4 }}>
          {soldCount} of {laptopsNeeded} laptops sold [{Array(Math.min(soldCount, laptopsNeeded)).fill('=').join('')}{soldCount < laptopsNeeded ? '>' : ''}]
        </p>
      </div>
      <p style={{ color: broke ? 'var(--success)' : 'var(--warning)', fontWeight: 700, fontSize: 14 }}>
        {broke
          ? `✓ You broke even after ${laptopsNeeded} laptops — ${soldCount - laptopsNeeded} extra sales this month`
          : `${laptopsNeeded - soldCount} more sales needed to break even`}
      </p>
    </div>
  )
}

function BudgetVsActual({ budgets, expenses }: { budgets: BudgetRow[]; expenses: MonthExpRow[] }) {
  if (budgets.length === 0) return null

  const expByCat: Record<string, number> = {}
  expenses.forEach(e => { expByCat[e.category] = (expByCat[e.category] ?? 0) + e.amount })

  const rows = budgets.map(b => {
    const spent = expByCat[b.category] ?? 0
    const remaining = b.monthly_budget - spent
    const over = remaining < 0
    return { category: b.category, budget: b.monthly_budget, spent, remaining, over }
  })

  return (
    <Section title="Budget vs Actual">
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Category', 'Budget', 'Spent', 'Remaining', 'Status'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-3)', fontSize: 11, fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.category} style={{ borderBottom: '1px solid var(--border)', background: r.over ? 'var(--danger-bg)' : 'transparent' }}>
              <td style={{ padding: '10px 12px', color: 'var(--text)', fontWeight: 500, fontSize: 13 }}>{r.category}</td>
              <td style={{ padding: '10px 12px', color: 'var(--text-2)', fontSize: 13 }}>{fmtRs(r.budget)}</td>
              <td style={{ padding: '10px 12px', color: r.over ? 'var(--danger)' : 'var(--text)', fontWeight: 600, fontSize: 13 }}>{fmtRs(r.spent)}</td>
              <td style={{ padding: '10px 12px', color: r.over ? 'var(--danger)' : 'var(--success)', fontWeight: 700, fontSize: 13 }}>
                {r.over ? `−${fmtRs(-r.remaining)}` : fmtRs(r.remaining)}
              </td>
              <td style={{ padding: '10px 12px' }}>
                <span style={{ background: r.over ? 'var(--danger-bg)' : 'var(--success-bg)', color: r.over ? 'var(--danger)' : 'var(--success)', border: `1px solid ${r.over ? 'var(--danger-border)' : 'var(--success-border)'}`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                  {r.over ? 'Over budget' : r.spent === 0 ? 'Unspent' : 'On track'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  )
}

function MonthlyReport({ shopId }: { shopId: string }) {
  const now = new Date()
  const [month, setMonth] = useState(monthISO(now))
  const [loading, setLoading] = useState(false)
  const [sales, setSales] = useState<MonthSaleRow[]>([])
  const [accTx, setAccTx] = useState<MonthAccRow[]>([])
  const [expenses, setExpenses] = useState<MonthExpRow[]>([])
  const [udhaarGiven, setUdhaarGiven] = useState<MonthUdhaarRow[]>([])
  const [udhaarPaid, setUdhaarPaid] = useState<MonthPayRow[]>([])
  const [prevSales, setPrevSales] = useState<MonthSaleRow[]>([])
  const [prevExpenses, setPrevExpenses] = useState<MonthExpRow[]>([])
  const [budgets, setBudgets] = useState<BudgetRow[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [y, m] = month.split('-').map(Number)
    const cur = new Date(y, m - 1, 1)
    const prev = new Date(y, m - 2, 1)

    const startISO = startOfMonth(cur).toISOString()
    const endISO = endOfMonth(cur).toISOString()
    const prevStartISO = startOfMonth(prev).toISOString()
    const prevEndISO = endOfMonth(prev).toISOString()
    const startDate = startOfMonth(cur).toISOString().slice(0, 10)
    const endDate = endOfMonth(cur).toISOString().slice(0, 10)
    const prevStartDate = startOfMonth(prev).toISOString().slice(0, 10)
    const prevEndDate = endOfMonth(prev).toISOString().slice(0, 10)

    const [
      { data: salesData },
      { data: accData },
      { data: expData },
      { data: ugData },
      { data: upData },
      { data: prevSalesData },
      { data: prevExpData },
      { data: budgetData },
    ] = await Promise.all([
      supabase.from('sales').select('sale_price,profit,sold_at,laptops(brand,model,purchase_price)').eq('shop_id', shopId).eq('is_voided', false).gte('sold_at', startISO).lte('sold_at', endISO),
      supabase.from('accessory_transactions').select('value,created_at,transaction_type').eq('shop_id', shopId).eq('transaction_type', 'sale').gte('created_at', startISO).lte('created_at', endISO),
      supabase.from('expenses').select('amount,category,expense_date').eq('shop_id', shopId).gte('expense_date', startDate).lte('expense_date', endDate),
      supabase.from('udhaar_records').select('total_amount,created_at').eq('shop_id', shopId).gte('created_at', startISO).lte('created_at', endISO),
      supabase.from('udhaar_payments').select('amount_paid,payment_date').eq('shop_id', shopId).gte('payment_date', startDate).lte('payment_date', endDate),
      supabase.from('sales').select('sale_price,profit,sold_at,laptops(brand,model,purchase_price)').eq('shop_id', shopId).eq('is_voided', false).gte('sold_at', prevStartISO).lte('sold_at', prevEndISO),
      supabase.from('expenses').select('amount,category,expense_date').eq('shop_id', shopId).gte('expense_date', prevStartDate).lte('expense_date', prevEndDate),
      supabase.from('expense_budgets').select('category,monthly_budget').eq('shop_id', shopId).eq('budget_month', m).eq('budget_year', y),
    ])

    setSales((salesData ?? []) as unknown as MonthSaleRow[])
    setAccTx((accData ?? []) as MonthAccRow[])
    setExpenses((expData ?? []) as MonthExpRow[])
    setUdhaarGiven((ugData ?? []) as MonthUdhaarRow[])
    setUdhaarPaid((upData ?? []) as MonthPayRow[])
    setPrevSales((prevSalesData ?? []) as unknown as MonthSaleRow[])
    setPrevExpenses((prevExpData ?? []) as MonthExpRow[])
    setBudgets((budgetData ?? []) as BudgetRow[])
    setLoading(false)
  }, [shopId, month])

  useEffect(() => { load() }, [load])

  const laptopRevenue = sales.reduce((s, r) => s + r.sale_price, 0)
  const accRevenue = accTx.reduce((s, a) => s + a.value, 0)
  const totalRevenue = laptopRevenue + accRevenue

  const laptopCOGS = sales.reduce((s, r) => {
    const lap = Array.isArray(r.laptops) ? r.laptops[0] : r.laptops
    return s + (lap?.purchase_price ?? (r.sale_price - r.profit))
  }, 0)
  const grossProfit = totalRevenue - laptopCOGS
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const netProfit = grossProfit - totalExpenses

  const ugTotal = udhaarGiven.reduce((s, u) => s + u.total_amount, 0)
  const upTotal = udhaarPaid.reduce((s, p) => s + p.amount_paid, 0)

  const prevRevenue = prevSales.reduce((s, r) => s + r.sale_price, 0)
  const prevCOGS = prevSales.reduce((s, r) => {
    const lap = Array.isArray(r.laptops) ? r.laptops[0] : r.laptops
    return s + (lap?.purchase_price ?? (r.sale_price - r.profit))
  }, 0)
  const prevProfit = prevRevenue - prevCOGS - prevExpenses.reduce((s, e) => s + e.amount, 0)

  const weeklyData: Record<string, { week: string; revenue: number; profit: number }> = {}
  sales.forEach(s => {
    const d = new Date(s.sold_at)
    const weekNum = Math.ceil(d.getDate() / 7)
    const key = `W${weekNum}`
    if (!weeklyData[key]) weeklyData[key] = { week: key, revenue: 0, profit: 0 }
    weeklyData[key].revenue += s.sale_price
    weeklyData[key].profit += s.profit
  })
  const weekChart = Object.values(weeklyData).sort((a, b) => a.week.localeCompare(b.week))

  const expByCat: Record<string, number> = {}
  expenses.forEach(e => { expByCat[e.category] = (expByCat[e.category] ?? 0) + e.amount })
  const expPie = Object.entries(expByCat).map(([name, value]) => ({ name, value }))

  const modelCounts: Record<string, { count: number; revenue: number }> = {}
  sales.forEach(s => {
    const lap = Array.isArray(s.laptops) ? s.laptops[0] : s.laptops
    if (!lap) return
    const key = `${lap.brand} ${lap.model}`
    if (!modelCounts[key]) modelCounts[key] = { count: 0, revenue: 0 }
    modelCounts[key].count++
    modelCounts[key].revenue += s.sale_price
  })
  const topModels = Object.entries(modelCounts).map(([model, d]) => ({ model, ...d })).sort((a, b) => b.count - a.count).slice(0, 5)

  const exportExcel = () => {
    const wb = XLSX.utils.book_new()
    const summary = [
      ['ShopBoss — Monthly Report', ''],
      ['Month', month],
      ['', ''],
      ['Revenue (Laptops)', laptopRevenue],
      ['Revenue (Accessories)', accRevenue],
      ['Total Revenue', totalRevenue],
      ['Purchase Cost', laptopCOGS],
      ['Gross Profit', grossProfit],
      ['Total Expenses', totalExpenses],
      ['Net Profit', netProfit],
      ['', ''],
      ['Udhaar Given', ugTotal],
      ['Udhaar Recovered', upTotal],
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'Summary')
    const salesRows = sales.map(s => {
      const lap = Array.isArray(s.laptops) ? s.laptops[0] : s.laptops
      return { Date: s.sold_at.slice(0, 10), Brand: lap?.brand ?? '', Model: lap?.model ?? '', Revenue: s.sale_price, Profit: s.profit }
    })
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(salesRows), 'Sales')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expenses.map(e => ({ Date: e.expense_date, Category: e.category, Amount: e.amount }))), 'Expenses')
    XLSX.writeFile(wb, `monthly-report-${month}.xlsx`)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={14} style={{ color: 'var(--text-3)' }} />
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', color: 'var(--text)', fontSize: 13, outline: 'none' }} />
        </div>
        <button onClick={exportExcel} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 8, padding: '8px 14px', color: 'var(--success)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Download size={13} /> Export Excel
        </button>
      </div>

      {loading && <p style={{ color: 'var(--text-3)', fontSize: 14 }}>Loading…</p>}

      {!loading && (
        <>
          {/* Break-even analysis */}
          <BreakEvenCard totalExpenses={totalExpenses} sales={sales} />

          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
            <Card label="TOTAL REVENUE" value={fmtRs(totalRevenue)} sub={`vs ${fmtRs(prevRevenue)} last month`} />
            <Card label="NET PROFIT" value={fmtRs(netProfit)} color={netProfit >= 0 ? 'var(--success)' : 'var(--danger)'} sub={`vs ${fmtRs(prevProfit)} last month`} />
            <Card label="LAPTOPS SOLD" value={String(sales.length)} sub={fmtRs(laptopRevenue)} />
            <Card label="ACCESSORIES REV" value={fmtRs(accRevenue)} />
            <Card label="UDHAAR GIVEN" value={fmtRs(ugTotal)} color="var(--warning)" sub={`Recovered: ${fmtRs(upTotal)}`} />
            <Card label="TOTAL EXPENSES" value={fmtRs(totalExpenses)} />
          </div>

          {/* Budget vs Actual */}
          <BudgetVsActual budgets={budgets} expenses={expenses} />

          {/* Month-over-month */}
          <Section title="Month-over-Month Comparison">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              {[
                { label: 'Revenue', cur: totalRevenue, prev: prevRevenue },
                { label: 'Net Profit', cur: netProfit, prev: prevProfit },
                { label: 'Sales Count', cur: sales.length, prev: prevSales.length, fmt: (n: number) => String(n) },
              ].map(({ label, cur, prev, fmt }) => {
                const change = prev > 0 ? ((cur - prev) / prev) * 100 : 0
                const display = fmt ? fmt(cur) : fmtRs(cur)
                return (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <p style={{ color: 'var(--text-3)', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>{label}</p>
                    <p style={{ color: 'var(--text)', fontWeight: 700, fontSize: 20 }}>{display}</p>
                    <p style={{ color: change >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: 12, fontWeight: 600, marginTop: 4 }}>
                      {change >= 0 ? '▲' : '▼'} {Math.abs(Math.round(change))}% vs last month
                    </p>
                  </div>
                )
              })}
            </div>
          </Section>

          {weekChart.length > 0 && (
            <Section title="Revenue &amp; Profit by Week">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={weekChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="week" tick={{ fill: 'var(--text-3)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12 }} formatter={(v: unknown) => fmtRs(v as number)} />
                  <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-2)' }} />
                  <Bar dataKey="revenue" fill="var(--accent)" radius={[4, 4, 0, 0]} name="Revenue" />
                  <Bar dataKey="profit" fill="var(--success)" radius={[4, 4, 0, 0]} name="Profit" />
                </BarChart>
              </ResponsiveContainer>
            </Section>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: expPie.length > 0 ? '1fr 1fr' : '1fr', gap: 20, marginBottom: 20 }}>
            {topModels.length > 0 && (
              <Section title="Top 5 Laptop Models">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Model', 'Units', 'Revenue'].map(h => (
                        <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-3)', fontSize: 11, fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {topModels.map((m, i) => (
                      <tr key={m.model} style={{ borderBottom: i < topModels.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <td style={{ padding: '8px 10px', color: 'var(--text)', fontSize: 13 }}>{m.model}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--accent)', fontWeight: 700, fontSize: 13 }}>{m.count}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-2)', fontSize: 13 }}>{fmtRs(m.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            )}

            {expPie.length > 0 && (
              <Section title="Expense Breakdown">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={expPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)}%`} labelLine={false} fontSize={10}>
                      {expPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12 }} formatter={(v: unknown) => fmtRs(v as number)} />
                  </PieChart>
                </ResponsiveContainer>
              </Section>
            )}
          </div>

          {weekChart.length > 1 && (
            <Section title="Profit Trend">
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={weekChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="week" tick={{ fill: 'var(--text-3)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12 }} formatter={(v: unknown) => fmtRs(v as number)} />
                  <Line type="monotone" dataKey="profit" stroke="var(--success)" strokeWidth={2} dot={{ fill: 'var(--success)', r: 4 }} name="Profit" />
                </LineChart>
              </ResponsiveContainer>
            </Section>
          )}
        </>
      )}
    </div>
  )
}

// ─── STOCK TAB ────────────────────────────────────────────────────────────────

interface StockLaptop {
  id: string; brand: string; model: string; purchase_price: number; asking_price: number
  status: string; added_at: string; purchase_date: string | null
  quantity: number | null; is_bulk: boolean | null
  sales: { sold_at: string }[] | null
}

const lapUnits = (l: StockLaptop) => (l.is_bulk ? Math.max(0, l.quantity ?? 1) : 1)

const lapDaysInStock = (l: StockLaptop) =>
  Math.max(0, Math.floor((Date.now() - new Date(l.purchase_date ?? l.added_at).getTime()) / 86400000))
const lapSoldAt = (l: StockLaptop): string | null =>
  l.sales && l.sales.length > 0 ? l.sales[0].sold_at : null

interface SaleForProfit {
  profit: number; sale_price: number
  laptops: { brand: string; model: string; purchase_price: number } | null
}

interface ModelProfitRow {
  model: string
  unitsSold: number
  avgPurchase: number
  avgSale: number
  avgProfit: number
  avgMargin: number
  totalProfit: number
}

function StockReport({ shopId }: { shopId: string }) {
  const [laptops, setLaptops] = useState<StockLaptop[]>([])
  const [allSales, setAllSales] = useState<SaleForProfit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('laptops').select('id,brand,model,purchase_price,asking_price,status,added_at,purchase_date,quantity,is_bulk,sales(sold_at)').eq('shop_id', shopId),
      supabase.from('sales').select('profit,sale_price,laptops(brand,model,purchase_price)').eq('shop_id', shopId).eq('is_voided', false),
    ]).then(([{ data: laps }, { data: sls }]) => {
      setLaptops((laps ?? []) as StockLaptop[])
      setAllSales((sls ?? []) as unknown as SaleForProfit[])
      setLoading(false)
    })
  }, [shopId])

  const inStock = laptops.filter(l => l.status === 'in_stock')
  const sold = laptops.filter(l => l.status === 'sold')

  const inventoryValue = inStock.reduce((s, l) => s + l.purchase_price * lapUnits(l), 0)
  const potentialRevenue = inStock.reduce((s, l) => s + l.asking_price * lapUnits(l), 0)
  const potentialProfit = potentialRevenue - inventoryValue

  const agingBuckets = [
    { label: '0–30 days', min: 0, max: 30 },
    { label: '31–60 days', min: 31, max: 60 },
    { label: '61–90 days', min: 61, max: 90 },
    { label: '90+ days (dead stock)', min: 91, max: Infinity },
  ].map(b => {
    const items = inStock.filter(l => lapDaysInStock(l) >= b.min && (b.max === Infinity ? true : lapDaysInStock(l) <= b.max))
    return { ...b, count: items.reduce((s, l) => s + lapUnits(l), 0), value: items.reduce((s, l) => s + l.purchase_price * lapUnits(l), 0), items }
  })

  const soldWithDates = sold.filter(l => lapSoldAt(l) && l.added_at)
  const avgDaysToSell = soldWithDates.length > 0
    ? Math.round(soldWithDates.reduce((s, l) => {
        const ms = new Date(lapSoldAt(l)!).getTime() - new Date(l.added_at).getTime()
        return s + ms / 86400000
      }, 0) / soldWithDates.length)
    : 0

  const turnoverRate = laptops.length > 0 ? Math.round((sold.length / laptops.length) * 100) : 0

  // Profit by model from all-time sales
  const modelProfitMap: Record<string, { units: number; totalPurchase: number; totalSale: number; totalProfit: number }> = {}
  allSales.forEach(s => {
    const lap = Array.isArray(s.laptops) ? s.laptops[0] : s.laptops
    if (!lap) return
    const key = `${lap.brand} ${lap.model}`
    if (!modelProfitMap[key]) modelProfitMap[key] = { units: 0, totalPurchase: 0, totalSale: 0, totalProfit: 0 }
    modelProfitMap[key].units++
    modelProfitMap[key].totalPurchase += lap.purchase_price
    modelProfitMap[key].totalSale += s.sale_price
    modelProfitMap[key].totalProfit += s.profit
  })
  const modelProfitRows: ModelProfitRow[] = Object.entries(modelProfitMap).map(([model, d]) => ({
    model,
    unitsSold: d.units,
    avgPurchase: Math.round(d.totalPurchase / d.units),
    avgSale: Math.round(d.totalSale / d.units),
    avgProfit: Math.round(d.totalProfit / d.units),
    avgMargin: d.totalSale > 0 ? Math.round((d.totalProfit / d.totalSale) * 100) : 0,
    totalProfit: Math.round(d.totalProfit),
  }))
  const topByProfit = [...modelProfitRows].sort((a, b) => b.totalProfit - a.totalProfit)

  // Slowest models (by avg days in stock, sold laptops)
  interface ModelDays { model: string; avgDays: number; count: number }
  const modelDaysMap: Record<string, number[]> = {}
  soldWithDates.forEach(l => {
    const key = `${l.brand} ${l.model}`
    const ms = new Date(lapSoldAt(l)!).getTime() - new Date(l.added_at).getTime()
    if (!modelDaysMap[key]) modelDaysMap[key] = []
    modelDaysMap[key].push(ms / 86400000)
  })
  const modelDays: ModelDays[] = Object.entries(modelDaysMap)
    .filter(([, days]) => days.length >= 1)
    .map(([model, days]) => ({ model, avgDays: Math.round(days.reduce((a, b) => a + b, 0) / days.length), count: days.length }))

  const slowest = [...modelDays].sort((a, b) => b.avgDays - a.avgDays).slice(0, 5)
  const fastest = [...modelDays].sort((a, b) => a.avgDays - b.avgDays).slice(0, 5)

  const exportExcel = () => {
    const wb = XLSX.utils.book_new()
    const inv = inStock.map(l => ({ Brand: l.brand, Model: l.model, 'Purchase Price': l.purchase_price, 'Asking Price': l.asking_price, 'Days in Stock': lapDaysInStock(l), 'Added At': l.added_at.slice(0, 10) }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(inv), 'Inventory')
    XLSX.writeFile(wb, `inventory-${localDayISO()}.xlsx`)
  }

  if (loading) return <p style={{ color: 'var(--text-3)', fontSize: 14 }}>Loading…</p>

  const profitModelHeaders = ['Brand / Model', 'Units Sold', 'Avg Purchase', 'Avg Sale', 'Avg Profit', 'Margin %', 'Total Profit']

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button onClick={exportExcel} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 8, padding: '8px 14px', color: 'var(--success)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Download size={13} /> Export Inventory
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        <Card label="INVENTORY VALUE" value={fmtRs(inventoryValue)} sub={`${inStock.reduce((s, l) => s + lapUnits(l), 0)} units at cost`} />
        <Card label="POTENTIAL REVENUE" value={fmtRs(potentialRevenue)} sub="at asking prices" />
        <Card label="POTENTIAL PROFIT" value={fmtRs(potentialProfit)} color="var(--success)" sub={pct(potentialProfit, potentialRevenue) + ' margin'} />
        <Card label="AVG DAYS TO SELL" value={avgDaysToSell > 0 ? `${avgDaysToSell}d` : 'N/A'} sub={`${sold.length} sold total`} />
        <Card label="TURNOVER RATE" value={`${turnoverRate}%`} sub="of all stock sold" />
      </div>

      {/* Profit by model — best performers */}
      {topByProfit.length > 0 && (
        <Section title="Best Performing Models (by total profit)">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {profitModelHeaders.map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-3)', fontSize: 11, fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topByProfit.map((m, i) => (
                <tr key={m.model} style={{ borderBottom: '1px solid var(--border)', background: i === 0 ? 'var(--success-bg)' : 'transparent' }}>
                  <td style={{ padding: '8px 10px', color: 'var(--text)', fontWeight: i === 0 ? 700 : 500, fontSize: 13 }}>{m.model}</td>
                  <td style={{ padding: '8px 10px', color: 'var(--accent)', fontWeight: 700, fontSize: 13 }}>{m.unitsSold}</td>
                  <td style={{ padding: '8px 10px', color: 'var(--text-2)', fontSize: 12 }}>{fmtRs(m.avgPurchase)}</td>
                  <td style={{ padding: '8px 10px', color: 'var(--text-2)', fontSize: 12 }}>{fmtRs(m.avgSale)}</td>
                  <td style={{ padding: '8px 10px', color: 'var(--success)', fontWeight: 600, fontSize: 13 }}>{fmtRs(m.avgProfit)}</td>
                  <td style={{ padding: '8px 10px', color: m.avgMargin >= 15 ? 'var(--success)' : m.avgMargin >= 5 ? 'var(--warning)' : 'var(--danger)', fontWeight: 600, fontSize: 13 }}>{m.avgMargin}%</td>
                  <td style={{ padding: '8px 10px', color: 'var(--success)', fontWeight: 800, fontSize: 13 }}>{fmtRs(m.totalProfit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* Stock aging breakdown */}
      <Section title="Stock Aging Breakdown">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {agingBuckets.map((b, i) => (
            <div key={b.label} style={{ background: 'var(--bg-3)', borderRadius: 10, padding: '14px 16px', border: `1px solid ${i === 3 && b.count > 0 ? 'var(--danger-border)' : 'var(--border)'}` }}>
              <p style={{ color: i === 3 && b.count > 0 ? 'var(--danger)' : 'var(--text-3)', fontSize: 11, fontWeight: 600, marginBottom: 8 }}>{b.label.toUpperCase()}</p>
              <p style={{ color: i === 3 && b.count > 0 ? 'var(--danger)' : 'var(--text)', fontWeight: 700, fontSize: 22 }}>{b.count} units</p>
              <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 4 }}>{fmtRs(b.value)}</p>
              {i === 3 && b.count > 0 && (
                <p style={{ color: 'var(--danger)', fontSize: 11, fontWeight: 600, marginTop: 6 }}>⚠ Dead stock alert</p>
              )}
            </div>
          ))}
        </div>
      </Section>

      {agingBuckets[3].items.length > 0 && (
        <Section title="Dead Stock (90+ days)">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Brand / Model', 'Days in Stock', 'Purchase Price', 'Asking Price', 'Loss if unsold'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-3)', fontSize: 11, fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agingBuckets[3].items.sort((a, b) => lapDaysInStock(b) - lapDaysInStock(a)).map(l => (
                <tr key={l.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 12px', color: 'var(--text)', fontWeight: 500, fontSize: 13 }}>{l.brand} {l.model}</td>
                  <td style={{ padding: '8px 12px' }}><span style={{ color: 'var(--danger)', fontWeight: 700, fontSize: 13 }}>{lapDaysInStock(l)}d</span></td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-2)', fontSize: 13 }}>{fmtRs(l.purchase_price)}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-2)', fontSize: 13 }}>{fmtRs(l.asking_price)}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--warning)', fontSize: 13, fontWeight: 600 }}>{fmtRs(l.asking_price - l.purchase_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* Slowest & fastest models */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {slowest.length > 0 && (
          <Section title="Slowest Moving Models (dead capital)">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Model', 'Avg Days', 'Units'].map(h => <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-3)', fontSize: 11, fontWeight: 600 }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {slowest.map(m => (
                  <tr key={m.model} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '7px 10px', color: 'var(--text)', fontSize: 13 }}>{m.model}</td>
                    <td style={{ padding: '7px 10px', color: 'var(--warning)', fontWeight: 700, fontSize: 13 }}>{m.avgDays}d</td>
                    <td style={{ padding: '7px 10px', color: 'var(--text-3)', fontSize: 12 }}>{m.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}
        {fastest.length > 0 && (
          <Section title="Fastest Moving Models">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Model', 'Avg Days', 'Units'].map(h => <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-3)', fontSize: 11, fontWeight: 600 }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {fastest.map(m => (
                  <tr key={m.model} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '7px 10px', color: 'var(--text)', fontSize: 13 }}>{m.model}</td>
                    <td style={{ padding: '7px 10px', color: 'var(--success)', fontWeight: 700, fontSize: 13 }}>{m.avgDays}d</td>
                    <td style={{ padding: '7px 10px', color: 'var(--text-3)', fontSize: 12 }}>{m.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}
      </div>
    </div>
  )
}

// ─── UDHAAR TAB ───────────────────────────────────────────────────────────────

interface UdhaarRow {
  id: string; customer_name: string; customer_phone: string
  total_amount: number; amount_remaining: number; due_date: string | null
  status: string; created_at: string
}
interface SupplierCreditRow {
  id: string; supplier_name: string; amount_owed: number; amount_paid: number; due_date: string | null; status: string
}

function UdhaarReport({ shopId }: { shopId: string }) {
  const [udhaars, setUdhaars] = useState<UdhaarRow[]>([])
  const [supplierCredits, setSupplierCredits] = useState<SupplierCreditRow[]>([])
  const [monthPaid, setMonthPaid] = useState(0)
  const [monthGiven, setMonthGiven] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    const now = new Date()
    const startISO = startOfMonth(now).toISOString()
    const endISO = endOfMonth(now).toISOString()
    const startDate = startOfMonth(now).toISOString().slice(0, 10)
    const endDate = endOfMonth(now).toISOString().slice(0, 10)

    Promise.all([
      supabase.from('udhaar_records').select('id,customer_name,customer_phone,total_amount,amount_remaining,due_date,status,created_at').eq('shop_id', shopId).neq('status', 'paid').order('amount_remaining', { ascending: false }),
      supabase.from('supplier_credits').select('id,supplier_name,amount_owed,amount_paid,due_date,status').eq('shop_id', shopId).neq('status', 'paid'),
      supabase.from('udhaar_payments').select('amount_paid').eq('shop_id', shopId).gte('payment_date', startDate).lte('payment_date', endDate),
      supabase.from('udhaar_records').select('total_amount').eq('shop_id', shopId).gte('created_at', startISO).lte('created_at', endISO),
    ]).then(([{ data: u }, { data: sc }, { data: paid }, { data: given }]) => {
      setUdhaars((u ?? []) as UdhaarRow[])
      setSupplierCredits((sc ?? []) as SupplierCreditRow[])
      setMonthPaid((paid ?? []).reduce((s: number, p: { amount_paid: number }) => s + p.amount_paid, 0))
      setMonthGiven((given ?? []).reduce((s: number, g: { total_amount: number }) => s + g.total_amount, 0))
      setLoading(false)
    })
  }, [shopId])

  const totalOutstanding = udhaars.reduce((s, u) => s + u.amount_remaining, 0)
  const supplierOutstanding = supplierCredits.reduce((s, c) => s + (c.amount_owed - c.amount_paid), 0)
  const recoveryRate = monthGiven > 0 ? Math.round((monthPaid / monthGiven) * 100) : 0

  const nowMs = Date.now()
  const overdueNow = udhaars.filter(u => u.due_date && new Date(u.due_date).getTime() < nowMs)
  const agingBuckets = [
    { label: 'Not yet due', items: udhaars.filter(u => !u.due_date || new Date(u.due_date).getTime() >= nowMs) },
    { label: 'Overdue 1–7d', items: overdueNow.filter(u => nowMs - new Date(u.due_date!).getTime() <= 7 * 86400000) },
    { label: 'Overdue 8–30d', items: overdueNow.filter(u => { const d = nowMs - new Date(u.due_date!).getTime(); return d > 7 * 86400000 && d <= 30 * 86400000 }) },
    { label: 'Overdue 30d+', items: overdueNow.filter(u => nowMs - new Date(u.due_date!).getTime() > 30 * 86400000) },
  ]

  const exportExcel = () => {
    const wb = XLSX.utils.book_new()
    const rows = udhaars.map(u => ({ Customer: u.customer_name, Phone: u.customer_phone, Total: u.total_amount, Remaining: u.amount_remaining, 'Due Date': u.due_date ?? '', Status: u.status }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Outstanding Udhaar')
    const scRows = supplierCredits.map(c => ({ Supplier: c.supplier_name, Owed: c.amount_owed, Paid: c.amount_paid, Remaining: c.amount_owed - c.amount_paid, 'Due Date': c.due_date ?? '', Status: c.status }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(scRows), 'Supplier Credits')
    XLSX.writeFile(wb, `udhaar-report-${localDayISO()}.xlsx`)
  }

  if (loading) return <p style={{ color: 'var(--text-3)', fontSize: 14 }}>Loading…</p>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button onClick={exportExcel} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 8, padding: '8px 14px', color: 'var(--success)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Download size={13} /> Export Udhaar
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        <Card label="TOTAL OUTSTANDING" value={fmtRs(totalOutstanding)} sub={`${udhaars.length} records`} color="var(--warning)" />
        <Card label="RECOVERY THIS MONTH" value={`${recoveryRate}%`} sub={`${fmtRs(monthPaid)} of ${fmtRs(monthGiven)}`} color={recoveryRate >= 50 ? 'var(--success)' : 'var(--danger)'} />
        <Card label="OVERDUE COUNT" value={String(overdueNow.length)} color={overdueNow.length > 0 ? 'var(--danger)' : 'var(--text)'} sub={fmtRs(overdueNow.reduce((s, u) => s + u.amount_remaining, 0))} />
        <Card label="SUPPLIER CREDIT" value={fmtRs(supplierOutstanding)} sub={`${supplierCredits.length} outstanding`} color="var(--info)" />
      </div>

      <Section title="Outstanding by Aging Bucket">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {agingBuckets.map((b, i) => (
            <div key={b.label} style={{ background: 'var(--bg-3)', borderRadius: 10, padding: '14px 16px', border: `1px solid ${i > 0 && b.items.length > 0 ? 'var(--danger-border)' : 'var(--border)'}` }}>
              <p style={{ color: i > 0 && b.items.length > 0 ? 'var(--danger)' : 'var(--text-3)', fontSize: 11, fontWeight: 600, marginBottom: 8 }}>{b.label.toUpperCase()}</p>
              <p style={{ color: i > 0 && b.items.length > 0 ? 'var(--danger)' : 'var(--text)', fontWeight: 700, fontSize: 22 }}>{b.items.length}</p>
              <p style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 4 }}>{fmtRs(b.items.reduce((s, u) => s + u.amount_remaining, 0))}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Biggest Debtors (Top 10)">
        {udhaars.length === 0 ? (
          <p style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>No outstanding udhaar</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Customer', 'Phone', 'Total Given', 'Remaining', 'Due Date', 'Status'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-3)', fontSize: 11, fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {udhaars.slice(0, 10).map(u => {
                const isOverdue = u.due_date && new Date(u.due_date).getTime() < nowMs
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px', color: 'var(--text)', fontWeight: 600, fontSize: 13 }}>{u.customer_name}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-2)', fontSize: 12 }}>{u.customer_phone}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-2)', fontSize: 13 }}>{fmtRs(u.total_amount)}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--danger)', fontWeight: 700, fontSize: 13 }}>{fmtRs(u.amount_remaining)}</td>
                    <td style={{ padding: '8px 12px', color: isOverdue ? 'var(--danger)' : 'var(--text-2)', fontSize: 12 }}>{u.due_date ? fmtDate(u.due_date) : '—'}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ background: u.status === 'overdue' ? 'var(--danger-bg)' : 'var(--warning-bg)', color: u.status === 'overdue' ? 'var(--danger)' : 'var(--warning)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                        {u.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Section>

      {supplierCredits.length > 0 && (
        <Section title="Supplier Credit Outstanding">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Supplier', 'Total Owed', 'Paid', 'Remaining', 'Due Date', 'Status'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-3)', fontSize: 11, fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {supplierCredits.map(c => {
                const remaining = c.amount_owed - c.amount_paid
                const isDueSoon = c.due_date && new Date(c.due_date).getTime() - nowMs < 7 * 86400000 && new Date(c.due_date).getTime() > nowMs
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px', color: 'var(--text)', fontWeight: 600, fontSize: 13 }}>{c.supplier_name}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-2)', fontSize: 13 }}>{fmtRs(c.amount_owed)}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--success)', fontSize: 13 }}>{fmtRs(c.amount_paid)}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--danger)', fontWeight: 700, fontSize: 13 }}>{fmtRs(remaining)}</td>
                    <td style={{ padding: '8px 12px', color: isDueSoon ? 'var(--warning)' : 'var(--text-2)', fontSize: 12, fontWeight: isDueSoon ? 600 : 400 }}>
                      {c.due_date ? fmtDate(c.due_date) : '—'}{isDueSoon ? ' ⚠' : ''}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ background: 'var(--info-bg)', color: 'var(--info)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{c.status}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Section>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type TabId = 'daily' | 'monthly' | 'stock' | 'udhaar'

export default function ReportsPage() {
  const { shop } = useShop()
  const [tab, setTab] = useState<TabId>('daily')

  if (!shop) return <p style={{ color: 'var(--text-3)', fontSize: 14 }}>Loading…</p>

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: 32, marginBottom: 24 }}>Reports &amp; Analytics</h1>

      <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
        <Tab label="Daily" icon={<Calendar size={14} />} active={tab === 'daily'} onClick={() => setTab('daily')} />
        <Tab label="Monthly" icon={<TrendingUp size={14} />} active={tab === 'monthly'} onClick={() => setTab('monthly')} />
        <Tab label="Stock" icon={<Package size={14} />} active={tab === 'stock'} onClick={() => setTab('stock')} />
        <Tab label="Udhaar" icon={<Users size={14} />} active={tab === 'udhaar'} onClick={() => setTab('udhaar')} />
      </div>

      {tab === 'daily' && <DailyReport shopId={shop.id} />}
      {tab === 'monthly' && <MonthlyReport shopId={shop.id} />}
      {tab === 'stock' && <StockReport shopId={shop.id} />}
      {tab === 'udhaar' && <UdhaarReport shopId={shop.id} />}
    </div>
  )
}
