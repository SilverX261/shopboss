import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyWorkerJwt } from '@/lib/worker-session'
import { sendWhatsApp, fmtTime, fmtRs } from '@/lib/whatsapp'

export async function POST(request: Request) {
  // Authenticate worker via Bearer token
  const authHeader = request.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  const session = verifyWorkerJwt(token)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    laptop_id,
    sale_price,
    payment_type,
    customer_phone,
    customer_name,
    due_date,
    trade_in,
  } = body

  if (!laptop_id || !sale_price || !payment_type) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = await createClient()

  // Fetch laptop to confirm it's in stock and belongs to this shop
  const { data: laptop } = await supabase
    .from('laptops')
    .select('id, brand, model, purchase_price, status, imei, shop_id, specs')
    .eq('id', laptop_id)
    .single()

  if (!laptop || laptop.shop_id !== session.shop_id) {
    return NextResponse.json({ error: 'Laptop not found' }, { status: 404 })
  }
  if (laptop.status !== 'in_stock') {
    return NextResponse.json({ error: 'Laptop already sold' }, { status: 409 })
  }

  // Fetch shop settings
  const { data: shop } = await supabase
    .from('shops')
    .select('plan, whatsapp_number, wa_phone_number_id, wa_access_token, large_sale_alert_threshold, min_sale_prices')
    .eq('id', session.shop_id)
    .single()

  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

  // Price floor check
  const minPrices = (shop.min_sale_prices ?? {}) as Record<string, number>
  const modelKey = `${laptop.brand} ${laptop.model}`
  const floor = minPrices[modelKey] ?? minPrices[laptop.model] ?? 0
  if (floor > 0 && sale_price < floor) {
    return NextResponse.json({ error: `Price below floor: minimum is Rs ${floor}`, floor }, { status: 422 })
  }

  // Calculate profit
  const profit = sale_price - laptop.purchase_price

  // Insert sale record — only columns that exist in the sales table
  const { data: sale, error: saleErr } = await supabase
    .from('sales')
    .insert({
      shop_id: session.shop_id,
      laptop_id,
      sale_price,
      payment_type,
      customer_phone: customer_phone || null,
      customer_name: customer_name || null,
      profit,
      sold_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (saleErr || !sale) {
    console.error('[sales/create] sales insert error:', saleErr)
    return NextResponse.json({ error: saleErr?.message ?? 'Failed to record sale' }, { status: 500 })
  }

  // Mark laptop as sold
  await supabase.from('laptops').update({ status: 'sold' }).eq('id', laptop_id)

  // If udhaar payment → create udhaar record
  if (payment_type === 'udhaar' && customer_name) {
    await supabase.from('udhaar_records').insert({
      shop_id: session.shop_id,
      mode: 'value_based',
      customer_name,
      customer_phone: customer_phone || '',
      total_amount: sale_price,
      amount_paid: 0,
      amount_remaining: sale_price,
      items: [{ name: `${laptop.brand} ${laptop.model}`, price: sale_price }],
      description: `${laptop.brand} ${laptop.model}`,
      due_date: due_date || null,
      status: 'pending',
    })
  }

  // Trade-in: create traded-in laptop entry
  if (trade_in && shop.plan === 'boss') {
    const { imei: tiImei, model_desc, condition, credit_value } = trade_in
    await supabase.from('laptops').insert({
      shop_id: session.shop_id,
      imei: tiImei || `TRADEIN-${Date.now()}`,
      brand: 'Trade-In',
      model: model_desc || 'Unknown',
      specs: { condition },
      purchase_price: credit_value ?? 0,
      status: 'traded_in',
    })
    await supabase.from('trade_in_records').insert({
      shop_id: session.shop_id,
      sale_id: sale.id,
      imei: tiImei || null,
      model_desc: model_desc || null,
      condition: condition || 'used',
      credit_value: credit_value ?? 0,
    }) // table may not exist yet — graceful
  }

  // Log activity
  await supabase.from('activity_log').insert({
    shop_id: session.shop_id,
    worker_id: session.worker_id,
    event_type: 'sale',
    page: '/worker/sales/new',
    details: {
      sale_id: sale.id,
      laptop_id,
      sale_price,
      payment_type,
      profit,
      brand: laptop.brand,
      model: laptop.model,
    },
  })

  // WhatsApp sale alert (fire and forget)
  if (shop.wa_phone_number_id && shop.wa_access_token && shop.whatsapp_number) {
    const isLarge = shop.large_sale_alert_threshold && sale_price >= shop.large_sale_alert_threshold
    const specs = laptop.specs as Record<string, unknown>
    const specsLine = [specs.ram, specs.storage].filter(Boolean).join(' / ')
    const profitLine = shop.plan === 'boss' ? `\nProfit: ${fmtRs(profit)} (${Math.round((profit / sale_price) * 100)}%)` : ''
    const msg = [
      isLarge ? '🚨 Large sale alert!' : null,
      `⚡ Sale Alert — ${fmtTime()}`,
      `${laptop.brand} ${laptop.model}${specsLine ? ' · ' + specsLine : ''}`,
      laptop.imei ? `IMEI: ...${laptop.imei.slice(-6)}` : null,
      `Price: ${fmtRs(sale_price)}`,
      `Payment: ${payment_type.replace(/_/g, ' ')}`,
      `Worker: ${session.worker_name}${profitLine}`,
      '— ShopBoss',
    ].filter(Boolean).join('\n')

    sendWhatsApp({
      to: shop.whatsapp_number,
      message: msg,
      phoneNumberId: shop.wa_phone_number_id,
      accessToken: shop.wa_access_token,
    }).catch(() => {})
  }

  // WhatsApp receipt to customer
  if (customer_phone && shop.wa_phone_number_id && shop.wa_access_token) {
    const receiptMsg = `🧾 Receipt from ShopBoss\n${laptop.brand} ${laptop.model}\nPrice: ${fmtRs(sale_price)}\nPayment: ${payment_type.replace(/_/g, ' ')}\nThank you! 🙏`
    sendWhatsApp({
      to: customer_phone,
      message: receiptMsg,
      phoneNumberId: shop.wa_phone_number_id,
      accessToken: shop.wa_access_token,
    }).catch(() => {})
  }

  return NextResponse.json({ success: true, sale_id: sale.id })
}
