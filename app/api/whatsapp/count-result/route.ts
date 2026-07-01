import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendWhatsApp, sendWhatsAppImage, isWAConfigured, fmtTime } from '@/lib/whatsapp'

// Standalone route — also called internally from count/submit
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const {
    shop_id, category_name, worker_name,
    expected, declared, gap, flagged_reason,
    response_seconds, photo_url,
  } = await request.json()

  const { data: shop } = await supabase
    .from('shops')
    .select('plan, whatsapp_number, wa_phone_number_id, wa_access_token, owner_id')
    .eq('id', shop_id)
    .single()

  if (!shop || shop.owner_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!isWAConfigured(shop)) return NextResponse.json({ success: true, skipped: true })

  const mins = Math.floor((response_seconds ?? 0) / 60)
  const secs = (response_seconds ?? 0) % 60
  const gapLine = gap === 0
    ? '✓ Exact match'
    : `⚠️ ${Math.abs(gap)} ${gap > 0 ? 'missing' : 'extra'} units`

  const msg = [
    `⚡ Count Result — ${category_name}`,
    `Time: ${fmtTime()} | Response: ${mins}m ${secs}s`,
    `──────────────────`,
    `Expected: ${expected}`,
    `Declared by ${worker_name}: ${declared}`,
    `Gap: ${gapLine}`,
    `──────────────────`,
    flagged_reason ? `🚨 Flagged: ${flagged_reason}` : `✅ Count verified.`,
    `— ShopBoss`,
  ].join('\n')

  // Boss plan: send photo if available
  if (shop.plan === 'boss' && photo_url) {
    await sendWhatsAppImage({
      to: shop.whatsapp_number,
      imageUrl: photo_url,
      caption: msg,
      phoneNumberId: shop.wa_phone_number_id,
      accessToken: shop.wa_access_token,
    })
  } else {
    await sendWhatsApp({ to: shop.whatsapp_number, message: msg, phoneNumberId: shop.wa_phone_number_id, accessToken: shop.wa_access_token })
  }

  return NextResponse.json({ success: true })
}
