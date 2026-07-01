import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import webpush from 'web-push'

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:hello@voltastudio.dev',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { category_id } = await request.json()
  if (!category_id) return NextResponse.json({ error: 'Missing category_id' }, { status: 400 })

  const { data: shop } = await supabase
    .from('shops')
    .select('id, plan')
    .eq('owner_id', user.id)
    .single()
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

  const { data: cat } = await supabase
    .from('accessory_categories')
    .select('id, name, cost_per_unit, display_qty')
    .eq('id', category_id)
    .eq('shop_id', shop.id)
    .single()
  if (!cat) return NextResponse.json({ error: 'Category not found' }, { status: 404 })

  const expected_count = cat.display_qty ?? 0

  const { data: req, error: reqErr } = await supabase
    .from('count_requests')
    .insert({
      shop_id: shop.id,
      category_id,
      status: 'pending',
      expected_count,
      fired_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (reqErr || !req) {
    return NextResponse.json({ error: reqErr?.message ?? 'Failed to create count request' }, { status: 500 })
  }

  // Broadcast realtime event to workers
  await supabase.channel(`shop-${shop.id}`).send({
    type: 'broadcast',
    event: 'COUNT_REQUEST',
    payload: {
      request_id: req.id,
      category_id: cat.id,
      category_name: cat.name,
      expected_count,
    },
  })

  // Web push notification to all workers (Boss plan)
  if (shop.plan === 'boss' && process.env.VAPID_PUBLIC_KEY) {
    const { data: workers } = await supabase
      .from('workers')
      .select('push_token')
      .eq('shop_id', shop.id)
      .eq('is_active', true)
      .not('push_token', 'is', null)

    const payload = JSON.stringify({
      title: '⚠️ COUNT CHECK',
      body: `Owner needs you to count ${cat.name} NOW. Open ShopBoss.`,
      tag: 'count-check',
    })

    await Promise.allSettled(
      (workers ?? []).map(async (w) => {
        try {
          const sub = JSON.parse(w.push_token!)
          await webpush.sendNotification(sub, payload)
        } catch { /* non-fatal */ }
      })
    )
  }

  return NextResponse.json({ success: true, request_id: req.id, expected_count })
}
