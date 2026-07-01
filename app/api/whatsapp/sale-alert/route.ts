import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendWhatsApp, fmtRs } from '@/lib/whatsapp'

// This route is called server-side (from sales/create) — not directly by clients.
// Kept as a standalone route so it can be tested/triggered independently.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sale_id } = await request.json()
  if (!sale_id) return NextResponse.json({ error: 'Missing sale_id' }, { status: 400 })

  const { data: sale } = await supabase
    .from('sales')
    .select(`
      id, sale_price, payment_type, profit, sold_at, shop_id,
      laptops ( brand, model, imei, specs, purchase_price ),
      workers ( name )
    `)
    .eq('id', sale_id)
    .single()

  if (!sale) return NextResponse.json({ error: 'Sale not found' }, { status: 404 })

  const { data: shop } = await supabase
    .from('shops')
    .select('plan, whatsapp_number, wa_phone_number_id, wa_access_token, large_sale_alert_threshold, owner_id')
    .eq('id', sale.shop_id)
    .single()

  if (!shop || shop.owner_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!shop.wa_phone_number_id || !shop.wa_access_token || !shop.whatsapp_number) {
    return NextResponse.json({ success: true, skipped: true })
  }

  const laptop = Array.isArray(sale.laptops) ? sale.laptops[0] : sale.laptops as { brand: string; model: string; imei: string; specs: Record<string, unknown>; purchase_price: number }
  const worker = Array.isArray(sale.workers) ? sale.workers[0] : sale.workers as { name: string }

  const isLarge = shop.large_sale_alert_threshold && sale.sale_price >= shop.large_sale_alert_threshold
  const time = new Date(sale.sold_at).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })
  const profitLine = shop.plan === 'boss'
    ? `\nProfit: ${fmtRs(sale.profit)} (${Math.round((sale.profit / sale.sale_price) * 100)}%)`
    : ''

  const msg = [
    isLarge ? '🚨 Large sale alert!' : null,
    `⚡ Sale Alert — ${time}`,
    `${laptop?.brand} ${laptop?.model}`,
    `IMEI: ...${laptop?.imei?.slice(-6)}`,
    `Price: ${fmtRs(sale.sale_price)}`,
    `Payment: ${sale.payment_type.replace(/_/g, ' ')}`,
    `Worker: ${worker?.name}${profitLine}`,
    '— ShopBoss',
  ].filter(Boolean).join('\n')

  await sendWhatsApp({
    to: shop.whatsapp_number,
    message: msg,
    phoneNumberId: shop.wa_phone_number_id,
    accessToken: shop.wa_access_token,
  })

  await supabase.from('sales').update({ wa_alert_sent: true }).eq('id', sale_id)

  return NextResponse.json({ success: true })
}
