import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyWorkerJwt } from '@/lib/worker-session'
import { sendWhatsApp, isWAConfigured, fmtRs, fmtTime } from '@/lib/whatsapp'

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  const session = verifyWorkerJwt(token)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { declared, expected } = await request.json()
  const gap = declared - expected

  if (Math.abs(gap) < 1) return NextResponse.json({ success: true, no_gap: true })

  const supabase = await createClient()
  const { data: shop } = await supabase
    .from('shops')
    .select('name, whatsapp_number, wa_phone_number_id, wa_access_token')
    .eq('id', session.shop_id)
    .single()

  if (!shop || !isWAConfigured(shop)) return NextResponse.json({ success: true, skipped: true })

  const msg = [
    `⚠️ Cash Gap Detected — ${fmtTime()}`,
    `──────────────────`,
    `Worker: ${session.worker_name}`,
    `Expected: ${fmtRs(expected)}`,
    `Declared: ${fmtRs(declared)}`,
    `Gap: ${fmtRs(Math.abs(gap))} ${gap < 0 ? '(short)' : '(over)'}`,
    `──────────────────`,
    `Please verify your cash drawer.`,
    `— ShopBoss`,
  ].join('\n')

  const sent = await sendWhatsApp({ to: shop.whatsapp_number, message: msg, phoneNumberId: shop.wa_phone_number_id, accessToken: shop.wa_access_token })
  return NextResponse.json({ success: true, sent })
}
