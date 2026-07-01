import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendWhatsApp, fmtTime, fmtRs } from '@/lib/whatsapp'

// Owner-operated sale creation. Authenticated via Supabase session
// (the owner's cookie), not a worker JWT. worker_id is left null.
export async function POST(request: Request) {
  try {
  // Use auth client just to verify session, then service client for all DB ops (bypasses RLS)
  const authClient = await createClient()
  const supabase = await createServiceClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await request.formData()
  const laptop_id = form.get('laptop_id') as string
  const sale_price = parseFloat(form.get('sale_price') as string)
  const payment_type = form.get('payment_type') as string
  const customer_name = ((form.get('customer_name') as string) || '').trim()
  const customer_phone = ((form.get('customer_phone') as string) || '').replace(/\D/g, '').slice(0, 11)
  const due_date = (form.get('due_date') as string) || null
  const bank_reference = ((form.get('bank_reference') as string) || '').trim() || null
  const notes = ((form.get('notes') as string) || '').trim() || null
  const isExchange = form.get('is_exchange') === 'true'
  const exchangeValue = isExchange ? parseFloat(form.get('exchange_value') as string) || 0 : 0
  const exchangeModel = isExchange ? ((form.get('exchange_laptop_model') as string) || '').trim() || null : null
  const exchangeCondition = isExchange ? ((form.get('exchange_laptop_condition') as string) || '').trim() || null : null

  // Parse bundle addons
  type AddonAccessory = { category_id: string; name: string; qty: number; cost_per_unit: number }
  type AddonUpgrade = { description: string; cost: number }
  type AddonDowngrade = { description: string; recovery_value: number }
  type SaleAddons = { accessories: AddonAccessory[]; upgrades: AddonUpgrade[]; downgrades: AddonDowngrade[] }
  let saleAddons: SaleAddons = { accessories: [], upgrades: [], downgrades: [] }
  const saleAddonsRaw = form.get('sale_addons') as string | null
  if (saleAddonsRaw) {
    try { saleAddons = JSON.parse(saleAddonsRaw) } catch { /* ignore malformed */ }
  }

  if (!laptop_id || !sale_price || sale_price <= 0 || !payment_type) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (!['cash', 'bank_transfer', 'udhaar'].includes(payment_type)) {
    return NextResponse.json({ error: 'Invalid payment type' }, { status: 400 })
  }
  if (payment_type === 'udhaar' && (!customer_name || !customer_phone || !due_date)) {
    return NextResponse.json({ error: 'Udhaar requires customer name, phone and due date' }, { status: 400 })
  }

  // Resolve the owner's shop
  const { data: shop } = await supabase
    .from('shops')
    .select('id, plan, whatsapp_number, wa_phone_number_id, wa_access_token, large_sale_alert_threshold')
    .eq('owner_id', user.id)
    .single()
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

  // Validate laptop is in stock and belongs to this shop
  const { data: laptop } = await supabase
    .from('laptops')
    .select('id, brand, model, imei, specs, purchase_price, status, shop_id')
    .eq('id', laptop_id)
    .single()
  if (!laptop || laptop.shop_id !== shop.id) {
    return NextResponse.json({ error: 'Laptop not found' }, { status: 404 })
  }
  if (laptop.status !== 'in_stock') {
    return NextResponse.json({ error: 'Laptop already sold' }, { status: 409 })
  }

  // True COGS: laptop purchase + accessory costs + upgrade costs - downgrade recoveries
  const accessoryCost = saleAddons.accessories.reduce((s, a) => s + a.qty * a.cost_per_unit, 0)
  const upgradeCost   = saleAddons.upgrades.reduce((s, u) => s + (u.cost || 0), 0)
  const downgradeSave = saleAddons.downgrades.reduce((s, d) => s + (d.recovery_value || 0), 0)
  const trueCOGS      = laptop.purchase_price + accessoryCost + upgradeCost - downgradeSave
  const profit = sale_price - trueCOGS
  const soldAt = new Date().toISOString()

  const hasAddons = saleAddons.accessories.length > 0 || saleAddons.upgrades.length > 0 || saleAddons.downgrades.length > 0

  // Build sale insert payload; include sale_addons only when there is content
  // (falls back without it if the column doesn't exist yet in the DB)
  const salePayload = {
    shop_id: shop.id,
    laptop_id,
    sale_price,
    payment_type,
    customer_phone: customer_phone || null,
    customer_name: customer_name || null,
    profit,
    sold_at: soldAt,
    bank_reference: bank_reference || null,
    notes: notes || null,
    ...(isExchange && {
      is_exchange: true,
      exchange_value: exchangeValue,
      exchange_laptop_model: exchangeModel,
      exchange_laptop_condition: exchangeCondition,
    }),
    ...(hasAddons && { sale_addons: saleAddons }),
  }

  let saleId: string | null = null
  let saleInsertErr: { message?: string; code?: string } | null = null

  const firstAttempt = await supabase.from('sales').insert(salePayload).select('id').single()
  if (firstAttempt.error?.code === '42703' && hasAddons) {
    // sale_addons column doesn't exist yet — retry without it so existing flow never breaks
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { sale_addons: _drop, ...fallbackPayload } = salePayload as typeof salePayload & { sale_addons?: unknown }
    const secondAttempt = await supabase.from('sales').insert(fallbackPayload).select('id').single()
    saleId = secondAttempt.data?.id ?? null
    saleInsertErr = secondAttempt.error
  } else {
    saleId = firstAttempt.data?.id ?? null
    saleInsertErr = firstAttempt.error
  }

  if (saleInsertErr || !saleId) {
    console.error('[sales/create-owner] sales insert error:', saleInsertErr)
    return NextResponse.json({ error: saleInsertErr?.message ?? 'Failed to record sale' }, { status: 500 })
  }

  const sale = { id: saleId }

  // Deduct bundled accessory stock and record transactions (best-effort after sale succeeds)
  for (const acc of saleAddons.accessories) {
    if (!acc.category_id || acc.qty <= 0) continue
    const { data: cat } = await supabase
      .from('accessory_categories')
      .select('display_qty, units_sold, total_value_sold')
      .eq('id', acc.category_id)
      .single()
    if (cat) {
      await supabase
        .from('accessory_categories')
        .update({
          display_qty: Math.max(0, (cat.display_qty ?? 0) - acc.qty),
          units_sold: (cat.units_sold ?? 0) + acc.qty,
          total_value_sold: (cat.total_value_sold ?? 0) + acc.qty * acc.cost_per_unit,
        })
        .eq('id', acc.category_id)
    }
    await supabase.from('accessory_transactions').insert({
      shop_id: shop.id,
      category_id: acc.category_id,
      worker_id: null,
      transaction_type: 'sale',
      units: acc.qty,
      value: acc.qty * acc.cost_per_unit,
      note: `Bundled with sale ${sale.id}`,
    })
  }

  // Add downgraded components back to accessories inventory
  for (const dg of saleAddons.downgrades) {
    if (!dg.description?.trim()) continue
    const name = dg.description.trim()
    const rv = dg.recovery_value || 0
    const { data: existing } = await supabase
      .from('accessory_categories')
      .select('id, display_qty, total_value_added, units_restocked')
      .eq('shop_id', shop.id)
      .ilike('name', name)
      .maybeSingle()
    if (existing) {
      await supabase
        .from('accessory_categories')
        .update({
          display_qty: (existing.display_qty ?? 0) + 1,
          total_value_added: (existing.total_value_added ?? 0) + rv,
          units_restocked: (existing.units_restocked ?? 0) + 1,
        })
        .eq('id', existing.id)
      await supabase.from('accessory_transactions').insert({
        shop_id: shop.id,
        category_id: existing.id,
        worker_id: null,
        transaction_type: 'restock',
        units: 1,
        value: rv,
        note: `Recovered (downgrade) from sale ${sale.id}`,
      })
    } else {
      const { data: newCat } = await supabase
        .from('accessory_categories')
        .insert({
          shop_id: shop.id,
          name,
          cost_per_unit: rv,
          display_qty: 1,
          total_value_added: rv,
          total_value_sold: 0,
          units_restocked: 1,
          units_sold: 0,
        })
        .select('id')
        .single()
      if (newCat) {
        await supabase.from('accessory_transactions').insert({
          shop_id: shop.id,
          category_id: newCat.id,
          worker_id: null,
          transaction_type: 'restock',
          units: 1,
          value: rv,
          note: `Recovered (downgrade) from sale ${sale.id}`,
        })
      }
    }
  }

  // Mark laptop sold + snapshot the sale onto the laptop row
  await supabase
    .from('laptops')
    .update({
      status: 'sold',
      sale_price,
      sold_at: soldAt,
      customer_name: customer_name || null,
    })
    .eq('id', laptop_id)

  // Udhaar -> create udhaar record
  if (payment_type === 'udhaar') {
    await supabase.from('udhaar_records').insert({
      shop_id: shop.id,
      mode: 'value_based',
      customer_name,
      customer_phone,
      total_amount: sale_price,
      amount_paid: 0,
      amount_remaining: sale_price,
      items: [{ name: `${laptop.brand} ${laptop.model}`, price: sale_price }],
      description: `${laptop.brand} ${laptop.model}`,
      due_date,
      status: 'pending',
    })
  }

  // WhatsApp alert to owner (best-effort)
  if (shop.wa_phone_number_id && shop.wa_access_token && shop.whatsapp_number) {
    const isLarge = shop.large_sale_alert_threshold && sale_price >= shop.large_sale_alert_threshold
    const specs = (laptop.specs ?? {}) as Record<string, unknown>
    const specsLine = [specs.ram, specs.storage].filter(Boolean).join(' / ')
    const msg = [
      isLarge ? '🚨 Large sale!' : null,
      `⚡ Sale recorded - ${fmtTime()}`,
      `${laptop.brand} ${laptop.model}${specsLine ? ' - ' + specsLine : ''}`,
      `IMEI: ...${laptop.imei.slice(-6)}`,
      `Price: ${fmtRs(sale_price)}`,
      `Payment: ${payment_type.replace(/_/g, ' ')}`,
      `Profit: ${fmtRs(profit)} (${sale_price ? Math.round((profit / sale_price) * 100) : 0}%)`,
      '- ShopBoss',
    ].filter(Boolean).join('\n')
    sendWhatsApp({
      to: shop.whatsapp_number,
      message: msg,
      phoneNumberId: shop.wa_phone_number_id,
      accessToken: shop.wa_access_token,
    }).catch(() => {})
  }

  // WhatsApp receipt to customer (best-effort)
  if (customer_phone && shop.wa_phone_number_id && shop.wa_access_token) {
    const receiptMsg = `🧾 Receipt from ShopBoss\n${laptop.brand} ${laptop.model}\nPrice: ${fmtRs(sale_price)}\nPayment: ${payment_type.replace(/_/g, ' ')}\nThank you! 🙏`
    sendWhatsApp({
      to: customer_phone,
      message: receiptMsg,
      phoneNumberId: shop.wa_phone_number_id,
      accessToken: shop.wa_access_token,
    }).catch(() => {})
  }

  return NextResponse.json({ success: true, sale_id: sale.id, profit, true_cogs: trueCOGS })
  } catch (err) {
    console.error('[sales/create-owner] unhandled exception:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 })
  }
}
