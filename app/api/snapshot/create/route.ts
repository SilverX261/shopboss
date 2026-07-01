import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function fmtRs(n: number) {
  return `Rs ${Math.round(n).toLocaleString('en-PK')}`
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

async function sendWhatsApp(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  message: string
) {
  const apiUrl = process.env.WHATSAPP_API_URL ?? 'https://graph.facebook.com/v18.0'
  const res = await fetch(`${apiUrl}/${phoneNumberId}/messages`, {
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
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? 'WhatsApp send failed')
  }
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

  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)

  // 1 — Gather current state
  const [
    { count: laptopCount },
    { data: laptopValues },
    { data: cashRecords },
    { data: accessoryCategories },
    { data: udhaarRecords },
    { data: activeWorkers },
  ] = await Promise.all([
    supabase
      .from('laptops')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shop.id)
      .eq('status', 'in_stock'),
    supabase
      .from('laptops')
      .select('purchase_price')
      .eq('shop_id', shop.id)
      .eq('status', 'in_stock'),
    supabase
      .from('cash_records')
      .select('amount, record_type')
      .eq('shop_id', shop.id)
      .gte('created_at', todayStart.toISOString()),
    supabase
      .from('accessory_categories')
      .select('total_value_added, total_value_sold')
      .eq('shop_id', shop.id),
    supabase
      .from('udhaar_records')
      .select('amount_remaining')
      .eq('shop_id', shop.id)
      .in('status', ['pending', 'partial', 'overdue']),
    supabase
      .from('workers')
      .select('id, name')
      .eq('shop_id', shop.id)
      .eq('is_active', true),
  ])

  const totalLaptopValue = (laptopValues ?? []).reduce(
    (s: number, l: { purchase_price: number }) => s + l.purchase_price,
    0
  )

  const cashDeclared = (cashRecords ?? []).reduce((s: number, c: { amount: number; record_type: string }) => {
    if (c.record_type === 'opening' || c.record_type === 'deposit') return s + c.amount
    if (c.record_type === 'expense') return s - c.amount
    return s
  }, 0)

  const accessoriesValue = (accessoryCategories ?? []).reduce(
    (s: number, a: { total_value_added: number; total_value_sold: number }) =>
      s + a.total_value_added - a.total_value_sold,
    0
  )

  const udhaarPending = (udhaarRecords ?? []).reduce(
    (s: number, u: { amount_remaining: number }) => s + u.amount_remaining,
    0
  )

  // Find last active worker with most recent activity
  let workerInfo: { id: string; name: string } | null = null
  let workerLastAction: string | null = null
  let workerLoginTime: string | null = null

  if ((activeWorkers ?? []).length > 0) {
    const workerIds = (activeWorkers ?? []).map((w: { id: string }) => w.id)
    const { data: recentActivity } = await supabase
      .from('activity_log')
      .select('worker_id, event_type, logged_at')
      .eq('shop_id', shop.id)
      .in('worker_id', workerIds)
      .gte('logged_at', todayStart.toISOString())
      .order('logged_at', { ascending: false })
      .limit(1)

    if (recentActivity?.[0]) {
      const act = recentActivity[0]
      workerInfo = (activeWorkers ?? []).find((w: { id: string }) => w.id === act.worker_id) ?? null
      workerLastAction = act.event_type
      workerLoginTime = act.logged_at

      // Find login event for this worker today
      const { data: loginAct } = await supabase
        .from('activity_log')
        .select('logged_at')
        .eq('shop_id', shop.id)
        .eq('worker_id', act.worker_id)
        .eq('event_type', 'login')
        .gte('logged_at', todayStart.toISOString())
        .order('logged_at', { ascending: true })
        .limit(1)

      if (loginAct?.[0]) workerLoginTime = loginAct[0].logged_at
    } else if ((activeWorkers ?? []).length > 0) {
      workerInfo = (activeWorkers as { id: string; name: string }[])[0]
    }
  }

  // 2 — Insert snapshot record
  const { data: snapshot, error: snapError } = await supabase
    .from('snapshots')
    .insert({
      shop_id: shop.id,
      snapshot_type: 'left',
      laptop_count: laptopCount ?? 0,
      laptops_in_stock_value: totalLaptopValue,
      cash_declared: cashDeclared,
      accessories_total_value: accessoriesValue,
      udhaar_total_pending: udhaarPending,
      worker_id: workerInfo?.id ?? null,
      worker_last_action: workerLastAction,
    })
    .select()
    .single()

  if (snapError) return NextResponse.json({ error: snapError.message }, { status: 500 })

  // 3 — Mark future sales/activities as post_snapshot (done at DB level via trigger, but flag for clarity)
  // Activities after this point will have post_snapshot=true set by the application layer

  // 4 — Format and send WhatsApp message
  const timeStr = fmtTime(now.toISOString())

  const workerLine = workerInfo
    ? `👷 Worker: ${workerInfo.name}${workerLoginTime ? ` (since ${fmtTime(workerLoginTime)})` : ''}\nLast action: ${(workerLastAction ?? 'unknown').replace(/_/g, ' ')} at ${timeStr}`
    : '👷 No workers on shift'

  const message = [
    `⚡ ShopBoss Snapshot — ${timeStr}`,
    '──────────────────',
    `📦 Laptops: ${laptopCount ?? 0} units (${fmtRs(totalLaptopValue)})`,
    `💰 Cash in drawer: ${fmtRs(cashDeclared)}`,
    `🔌 Accessories: ${fmtRs(accessoriesValue)}`,
    `📋 Udhaar pending: ${fmtRs(udhaarPending)}`,
    '──────────────────',
    workerLine,
    '──────────────────',
    `Everything above is locked as of ${timeStr}.`,
    'Any changes after this are flagged.',
    '— ShopBoss by Volta Builds',
  ].join('\n')

  // Send if WA is configured
  if (shop.wa_phone_number_id && shop.wa_access_token) {
    await sendWhatsApp(
      shop.wa_phone_number_id,
      shop.wa_access_token,
      shop.whatsapp_number,
      message
    ).catch((err) => console.warn('[snapshot/create] WA send failed:', err.message))
  }

  return NextResponse.json({
    snapshot,
    stats: {
      laptopCount: laptopCount ?? 0,
      laptopValue: totalLaptopValue,
      cashDeclared,
      accessoriesValue,
      udhaarPending,
    },
  })
}
