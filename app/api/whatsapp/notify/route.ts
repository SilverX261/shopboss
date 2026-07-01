import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'hello@voltastudio.dev'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Admin-only endpoint
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { to, message } = await request.json()
  if (!to || !message) return NextResponse.json({ error: 'Missing to or message' }, { status: 400 })

  // Find a shop with WA credentials (use first active shop or env vars)
  const { data: shop } = await supabase
    .from('shops')
    .select('wa_phone_number_id, wa_access_token')
    .not('wa_phone_number_id', 'is', null)
    .limit(1)
    .single()

  if (!shop?.wa_phone_number_id || !shop?.wa_access_token) {
    // No WA configured — log and return success so admin flow doesn't break
    console.warn('[WhatsApp notify] No WA credentials configured, skipping send')
    return NextResponse.json({ success: true, skipped: true })
  }

  const body = {
    messaging_product: 'whatsapp',
    to: to.replace(/^0/, '92'),
    type: 'text',
    text: { body: message },
  }

  const res = await fetch(
    `${process.env.WHATSAPP_API_URL}/${shop.wa_phone_number_id}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${shop.wa_access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )

  if (!res.ok) {
    const err = await res.json()
    return NextResponse.json({ error: err?.error?.message ?? 'WhatsApp error' }, { status: 502 })
  }

  return NextResponse.json({ success: true })
}
