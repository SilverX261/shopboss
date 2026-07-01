import type { SupabaseClient } from '@supabase/supabase-js'
import type { DailyCashRecord, Expense } from '@/lib/types'

// ── Day-boundary helpers (local time) ──────────────────────────────────────────

export function localDayISO(d = new Date()): string {
  // YYYY-MM-DD in local time (for record_date / expense_date columns)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function dayBounds(d = new Date()): { startISO: string; endISO: string } {
  const start = new Date(d); start.setHours(0, 0, 0, 0)
  const end = new Date(d); end.setHours(23, 59, 59, 999)
  return { startISO: start.toISOString(), endISO: end.toISOString() }
}

// ── Shapes ─────────────────────────────────────────────────────────────────────

export interface CashSaleEvent {
  id: string
  at: string
  amount: number
  label: string
}

export interface DailyAccounting {
  date: string
  record: DailyCashRecord | null
  hasOpening: boolean
  opening: number
  // cash drawer movement (cash payment type only)
  cashSales: number
  udhaarRecovered: number
  cashExpenses: number
  expectedDrawer: number
  // P&L (all payment types)
  revenue: number
  cogs: number
  grossProfit: number
  totalExpenses: number
  netProfit: number
  // raw lists (for the transactions feed)
  cashSalesList: CashSaleEvent[]
  expensesList: Expense[]
}

interface SaleJoinRow {
  id: string
  sale_price: number
  profit: number
  payment_type: string
  sold_at: string
  laptops: { brand: string; model: string; purchase_price: number } | { brand: string; model: string; purchase_price: number }[] | null
}

// ── Core loader ─────────────────────────────────────────────────────────────────

export async function loadDailyAccounting(
  supabase: SupabaseClient,
  shopId: string,
  date = new Date(),
): Promise<DailyAccounting> {
  const recordDate = localDayISO(date)
  const { startISO, endISO } = dayBounds(date)

  const [{ data: recordData }, { data: salesData }, { data: expensesData }, { data: udhaarPayData }, { data: accCashData }] = await Promise.all([
    supabase
      .from('daily_cash_records')
      .select('*')
      .eq('shop_id', shopId)
      .eq('record_date', recordDate)
      .maybeSingle(),
    supabase
      .from('sales')
      .select('id, sale_price, profit, payment_type, sold_at, laptops ( brand, model, purchase_price )')
      .eq('shop_id', shopId)
      .eq('is_voided', false)
      .gte('sold_at', startISO)
      .lte('sold_at', endISO)
      .order('sold_at', { ascending: true }),
    supabase
      .from('expenses')
      .select('*')
      .eq('shop_id', shopId)
      .eq('expense_date', recordDate)
      .order('created_at', { ascending: true }),
    supabase
      .from('udhaar_payments')
      .select('amount_paid, payment_method, payment_date')
      .eq('shop_id', shopId)
      .eq('payment_date', recordDate),
    supabase
      .from('accessory_transactions')
      .select('id, value, created_at, payment_type, transaction_type, accessory_categories ( name )')
      .eq('shop_id', shopId)
      .eq('transaction_type', 'sale')
      .eq('payment_type', 'cash')
      .gte('created_at', startISO)
      .lte('created_at', endISO),
  ])

  const record = (recordData ?? null) as DailyCashRecord | null
  const sales = (salesData ?? []) as SaleJoinRow[]
  const expenses = (expensesData ?? []) as Expense[]
  const udhaarPayments = (udhaarPayData ?? []) as { amount_paid: number; payment_method: string; payment_date: string }[]
  const accessoryCashRows = (accCashData ?? []) as {
    id: string; value: number; created_at: string
    accessory_categories: { name: string } | { name: string }[] | null
  }[]

  const laptopOf = (s: SaleJoinRow) => (Array.isArray(s.laptops) ? s.laptops[0] : s.laptops)

  let revenue = 0
  let cogs = 0
  let cashSales = 0
  const cashSalesList: CashSaleEvent[] = []

  for (const s of sales) {
    revenue += s.sale_price
    const lap = laptopOf(s)
    cogs += lap?.purchase_price ?? (s.sale_price - s.profit)
    if (s.payment_type === 'cash') {
      cashSales += s.sale_price
      cashSalesList.push({
        id: s.id,
        at: s.sold_at,
        amount: s.sale_price,
        label: `Sale — ${lap ? `${lap.brand} ${lap.model}` : 'laptop'}`,
      })
    }
  }

  // Accessory cash sales also land in the drawer
  for (const a of accessoryCashRows) {
    const cat = Array.isArray(a.accessory_categories) ? a.accessory_categories[0] : a.accessory_categories
    cashSales += a.value
    cashSalesList.push({
      id: a.id,
      at: a.created_at,
      amount: a.value,
      label: `Accessory sale — ${cat?.name ?? 'item'}`,
    })
  }

  const totalExpenses = expenses.reduce((a, e) => a + e.amount, 0)
  const cashExpenses = expenses.filter((e) => e.payment_type === 'cash').reduce((a, e) => a + e.amount, 0)

  // Udhaar recovered today (cash received against credit) — feeds the drawer.
  const udhaarRecovered = udhaarPayments
    .filter((p) => p.payment_method === 'cash')
    .reduce((a, p) => a + p.amount_paid, 0)

  const opening = record?.opening_balance ?? 0
  const grossProfit = revenue - cogs
  const netProfit = grossProfit - totalExpenses
  const expectedDrawer = opening + cashSales + udhaarRecovered - cashExpenses

  return {
    date: recordDate,
    record,
    hasOpening: !!record,
    opening,
    cashSales,
    udhaarRecovered,
    cashExpenses,
    expectedDrawer,
    revenue,
    cogs,
    grossProfit,
    totalExpenses,
    netProfit,
    cashSalesList,
    expensesList: expenses,
  }
}
