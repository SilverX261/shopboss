import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyWorkerJwt } from '@/lib/worker-session'
import { sendWhatsApp, fmtRs } from '@/lib/whatsapp'

export async function POST(request: Request) {
  // Accept both worker JWT and owner session
  const authHeader = request.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  const workerSession = token ? verifyWorkerJwt(token) : null

  const supabase = await createClient()

  // Determine shop_id and submitter
  let shop_id: string
  let worker_name: string

  if (workerSession) {
    shop_id = workerSession.shop_id
    worker_name = workerSession.worker_name
  } else {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: shop } = await supabase.from('shops').select('id').eq('owner_id', user.id).single()
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    shop_id = shop.id
    worker_name = 'Owner'
  }

  const formData = await request.formData()
  const request_id = formData.get('request_id') as string
  const declared_count = parseInt(formData.get('declared_count') as string, 10)
  const photo = formData.get('photo') as File | null

  if (!request_id || isNaN(declared_count)) {
    return NextResponse.json({ error: 'Missing request_id or declared_count' }, { status: 400 })
  }

  // Fetch count request
  const { data: countReq } = await supabase
    .from('count_requests')
    .select('id, status, expected_count, fired_at, category_id, shop_id')
    .eq('id', request_id)
    .single()

  if (!countReq) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  if (countReq.shop_id !== shop_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (countReq.status !== 'pending') return NextResponse.json({ error: 'Already submitted' }, { status: 409 })

  const now = new Date()
  const firedAt = new Date(countReq.fired_at)
  const response_seconds = Math.floor((now.getTime() - firedAt.getTime()) / 1000)

  // Upload photo if provided
  let photo_url: string | null = null
  if (photo && photo.size > 0) {
    const buf = Buffer.from(await photo.arrayBuffer())
    const { data: uploadData } = await supabase.storage
      .from('count-photos')
      .upload(`${request_id}.jpg`, buf, { contentType: 'image/jpeg', upsert: true })
    if (uploadData) {
      const { data: { publicUrl } } = supabase.storage.from('count-photos').getPublicUrl(`${request_id}.jpg`)
      photo_url = publicUrl
    }
  }

  // Determine gap and flags
  const expected = countReq.expected_count ?? 0
  const gap = expected - declared_count

  let flagged_reason: string | null = null
  if (response_seconds < 60) flagged_reason = `Too fast — possible guess (under 60 sec)`
  else if (response_seconds > 900) flagged_reason = `Too slow — 15+ min delay`
  else if (gap !== 0) flagged_reason = `Count mismatch — gap of ${Math.abs(gap)} unit${Math.abs(gap) !== 1 ? 's' : ''}`

  const status = flagged_reason ? 'flagged' : 'verified'

  // Update count_request
  await supabase.from('count_requests').update({
    status,
    declared_count,
    submitted_at: now.toISOString(),
    photo_url,
    response_seconds,
    gap,
    flagged_reason,
    submitted_by: workerSession?.worker_id ?? null,
  }).eq('id', request_id)

  // Fetch category + shop for WA message
  const { data: cat } = await supabase
    .from('accessory_categories')
    .select('name, cost_per_unit')
    .eq('id', countReq.category_id)
    .single()

  const { data: shopData } = await supabase
    .from('shops')
    .select('whatsapp_number, wa_phone_number_id, wa_access_token, plan')
    .eq('id', shop_id)
    .single()

  // Send WhatsApp count result
  if (shopData?.wa_phone_number_id && shopData?.wa_access_token && shopData?.whatsapp_number) {
    const mins = Math.floor(response_seconds / 60)
    const secs = response_seconds % 60
    const gapLine = gap === 0
      ? '✓ Exact match'
      : `⚠️ ${Math.abs(gap)} ${gap > 0 ? 'missing' : 'extra'} (${fmtRs(Math.abs(gap) * (cat?.cost_per_unit ?? 0))})`

    const msg = [
      `⚡ Count Result — ${cat?.name ?? 'Category'}`,
      `Time: ${now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })} | Response: ${mins}m ${secs}s`,
      `──────────────────`,
      `Expected: ${expected}`,
      `Declared by ${worker_name}: ${declared_count}`,
      `Gap: ${gapLine}`,
      `──────────────────`,
      flagged_reason ? `🚨 Flagged: ${flagged_reason}` : `✅ Count verified.`,
      `— ShopBoss`,
    ].join('\n')

    sendWhatsApp({
      to: shopData.whatsapp_number,
      message: msg,
      phoneNumberId: shopData.wa_phone_number_id,
      accessToken: shopData.wa_access_token,
    }).catch(() => {})
  }

  // Broadcast COUNT_COMPLETE to release lock on worker + owner screens
  await supabase.channel(`shop-${shop_id}`).send({
    type: 'broadcast',
    event: 'COUNT_COMPLETE',
    payload: { request_id, declared_count, gap, status },
  })

  return NextResponse.json({ success: true, status, gap, flagged_reason, response_seconds })
}
