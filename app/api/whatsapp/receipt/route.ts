import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyWorkerJwt } from '@/lib/worker-session'
import { sendWhatsApp, isWAConfigured, fmtRs } from '@/lib/whatsapp'

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  const session = verifyWorkerJwt(token)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { customer_phone, customer_name, amount, item_description, payment_type, shop_name } = await request.json()

  if (!customer_phone || !amount) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: shop } = await supabase
    .from('shops')
    .select('name, whatsapp_number, wa_phone_number_id, wa_access_token')
    .eq('id', session.shop_id)
    .single()

  if (!shop || !isWAConfigured(shop)) {
    return NextResponse.json({ success: true, skipped: true })
  }

  const msg = [
    `🧾 Receipt — ${shop_name ?? shop.name}`,
    `──────────────────`,
    customer_name ? `Customer: ${customer_name}` : null,
    `Item: ${item_description ?? 'Purchase'}`,
    `Amount: ${fmtRs(amount)}`,
    `Payment: ${(payment_type ?? 'cash').replace(/_/g, ' ')}`,
    `──────────────────`,
    `Shukriya! 🙏`,
    `${shop.name} — Powered by ShopBoss`,
  ].filter(Boolean).join('\n')

  const sent = await sendWhatsApp({
    to: customer_phone,
    message: msg,
    phoneNumberId: shop.wa_phone_number_id,
    accessToken: shop.wa_access_token,
  })

  return NextResponse.json({ success: true, sent })
}
