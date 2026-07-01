import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: shop } = await supabase
    .from('shops').select('id').eq('owner_id', user.id).single()
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

  // Fetch all laptops with their sale record if sold
  const { data: laptops } = await supabase
    .from('laptops')
    .select(`
      imei, brand, model, specs, purchase_price, asking_price, purchase_date,
      supplier_name, status, added_at, days_in_stock,
      sales ( sale_price, profit, sold_at )
    `)
    .eq('shop_id', shop.id)
    .order('added_at', { ascending: false })

  const DAY_MS = 86_400_000
  const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-PK') : '')

  const rows = (laptops ?? []).map((l: {
    imei: string; brand: string; model: string; specs: Record<string, unknown>;
    purchase_price: number; asking_price: number | null; purchase_date: string | null;
    supplier_name: string | null; status: string; added_at: string; days_in_stock: number;
    sales: { sale_price: number; profit: number; sold_at: string }[]
  }) => {
    const sale = Array.isArray(l.sales) ? l.sales[0] : null
    const specs = (l.specs ?? {}) as Record<string, unknown>
    const asking = l.asking_price ?? 0
    const base = l.purchase_date ? new Date(l.purchase_date) : new Date(l.added_at)
    const daysInStock = Math.max(0, Math.floor((Date.now() - base.getTime()) / DAY_MS))
    return {
      IMEI: l.imei,
      Brand: l.brand,
      Model: l.model,
      Processor: specs.processor ?? '',
      RAM: specs.ram ?? '',
      Storage: specs.storage ?? '',
      Screen: specs.screen ?? '',
      'Purchase Price': l.purchase_price,
      'Asking Price': asking || '',
      'Potential Profit': asking ? asking - l.purchase_price : '',
      Supplier: l.supplier_name ?? '',
      'Purchase Date': fmtDate(l.purchase_date),
      Status: l.status,
      'Days in Stock': l.status === 'in_stock' ? daysInStock : '',
      'Sale Price': sale?.sale_price ?? '',
      Profit: sale?.profit ?? '',
      'Sold At': sale?.sold_at ? fmtDate(sale.sold_at) : '',
    }
  })

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)

  // Column widths
  ws['!cols'] = [
    { wch: 18 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 8 }, { wch: 12 }, { wch: 10 },
    { wch: 14 }, { wch: 13 }, { wch: 14 }, { wch: 18 }, { wch: 13 }, { wch: 10 },
    { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Inventory')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="shopboss-inventory-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  })
}
