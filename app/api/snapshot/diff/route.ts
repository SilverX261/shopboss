import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function fmtRs(n: number) {
  return `Rs ${Math.round(n).toLocaleString('en-PK')}`
}

function msToHM(ms: number): { hours: number; minutes: number } {
  const totalMinutes = Math.floor(ms / 60_000)
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 }
}

async function sendWhatsApp(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  message: string
) {
  const apiUrl = process.env.WHATSAPP_API_URL ?? 'https://graph.facebook.com/v18.0'
  await fetch(`${apiUrl}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to.replace(/^0/, '92'),
      type: 'text',
      text: { body: message },
    }),
  })
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: shop } = await supabase
    .from('shops')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

  // Get the last 'left' snapshot
  const { data: lastSnapshot } = await supabase
    .from('snapshots')
    .select('*')
    .eq('shop_id', shop.id)
    .eq('snapshot_type', 'left')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!lastSnapshot) {
    return NextResponse.json({ error: 'No previous snapshot found. Use "I Am Leaving" first.' }, { status: 404 })
  }

  const snapshotTime = new Date(lastSnapshot.created_at)
  const now = new Date()
  const { hours: hoursAway, minutes: minutesAway } = msToHM(now.getTime() - snapshotTime.getTime())

  // Gather current state
  const [
    { count: currentLaptopCount },
    { data: salesSince },
    { data: cashSince },
    { data: udhaarSince },
    { data: activitySince },
    { data: otpSince },
    { data: currentAccessories },
  ] = await Promise.all([
    supabase
      .from('laptops')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shop.id)
      .eq('status', 'in_stock'),
    supabase
      .from('sales')
      .select('sale_price, post_snapshot')
      .eq('shop_id', shop.id)
      .eq('is_voided', false)
      .gte('sold_at', snapshotTime.toISOString()),
    supabase
      .from('cash_records')
      .select('amount, record_type')
      .eq('shop_id', shop.id)
      .gte('created_at', snapshotTime.toISOString()),
    supabase
      .from('udhaar_records')
      .select('total_amount')
      .eq('shop_id', shop.id)
      .gte('created_at', snapshotTime.toISOString()),
    supabase
      .from('activity_log')
      .select('event_type, logged_at')
      .eq('shop_id', shop.id)
      .gte('logged_at', snapshotTime.toISOString()),
    supabase
      .from('activity_log')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shop.id)
      .eq('event_type', 'void_attempt')
      .gte('logged_at', snapshotTime.toISOString()),
    supabase
      .from('accessory_categories')
      .select('total_value_added, total_value_sold')
      .eq('shop_id', shop.id),
  ])

  // Calculate diffs
  const soldCount = salesSince?.length ?? 0
  const soldRevenue = (salesSince ?? []).reduce(
    (s: number, sl: { sale_price: number }) => s + sl.sale_price,
    0
  )

  const cashMoved = (cashSince ?? []).reduce((s: number, c: { amount: number; record_type: string }) => {
    if (c.record_type === 'deposit' || c.record_type === 'opening') return s + c.amount
    if (c.record_type === 'expense') return s - c.amount
    return s
  }, 0)

  const udhaarGiven = (udhaarSince ?? []).reduce(
    (s: number, u: { total_amount: number }) => s + u.total_amount,
    0
  )

  const currentAccessoriesValue = (currentAccessories ?? []).reduce(
    (s: number, a: { total_value_added: number; total_value_sold: number }) =>
      s + a.total_value_added - a.total_value_sold,
    0
  )
  const accessoriesDelta = currentAccessoriesValue - (lastSnapshot.accessories_total_value ?? 0)
  // Flag if accessories dropped more than expected by sales
  const accessoriesFlagged =
    accessoriesDelta < 0 && Math.abs(accessoriesDelta) > soldRevenue * 0.15

  const stockBefore = lastSnapshot.laptop_count ?? 0
  const stockAfter = currentLaptopCount ?? 0

  // Worker flagging: void attempts or unusual activity volume
  const otpRequests = (otpSince as unknown as { count: number })?.count ?? 0
  const voidAttempts = (activitySince ?? []).filter(
    (a: { event_type: string }) => a.event_type === 'void_attempt'
  ).length
  const workerFlagged = voidAttempts > 0 || otpRequests > 3

  const allGood = !workerFlagged && !accessoriesFlagged
  const summary = allGood ? 'All good. No anomalies detected.' : '⚠️ Review recommended.'

  // Insert 'returned' snapshot
  await supabase.from('snapshots').insert({
    shop_id: shop.id,
    snapshot_type: 'returned',
    laptop_count: stockAfter,
    laptops_in_stock_value: null,
    cash_declared: cashMoved,
    accessories_total_value: currentAccessoriesValue,
    udhaar_total_pending: null,
    worker_id: null,
    worker_last_action: null,
  })

  // Build WhatsApp message
  const timeRange = `${hoursAway}h ${minutesAway}m`
  const awayLine = `⚡ ShopBoss — You've Been Away ${timeRange}`

  const message = [
    awayLine,
    '──────────────────',
    `Sold: ${soldCount} laptop${soldCount !== 1 ? 's' : ''} — ${fmtRs(soldRevenue)}`,
    `Cash moved: ${fmtRs(Math.abs(cashMoved))}`,
    `Accessories: ${fmtRs(Math.abs(accessoriesDelta))} (${accessoriesFlagged ? '⚠️ flagged' : 'normal'})`,
    `Udhaar given: ${fmtRs(udhaarGiven)}`,
    `Stock change: ${stockBefore} → ${stockAfter} units`,
    '──────────────────',
    `Worker activity: ${workerFlagged ? '⚠️ flagged' : '✓ clean'}`,
    `Void attempts: ${voidAttempts}`,
    '──────────────────',
    summary,
    '— ShopBoss by Volta Builds',
  ].join('\n')

  if (shop.wa_phone_number_id && shop.wa_access_token) {
    await sendWhatsApp(
      shop.wa_phone_number_id,
      shop.wa_access_token,
      shop.whatsapp_number,
      message
    ).catch((err: Error) => console.warn('[snapshot/diff] WA send failed:', err.message))
  }

  return NextResponse.json({
    hoursAway,
    minutesAway,
    soldCount,
    soldRevenue,
    cashMoved,
    accessoriesDelta,
    accessoriesFlagged,
    udhaarGiven,
    stockBefore,
    stockAfter,
    workerFlagged,
    otpRequests: voidAttempts,
    summary,
    snapshotTime: snapshotTime.toISOString(),
    nowTime: now.toISOString(),
  })
}
