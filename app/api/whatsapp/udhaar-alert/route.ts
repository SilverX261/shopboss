import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyWorkerJwt } from '@/lib/worker-session'
import { sendWhatsApp, isWAConfigured, fmtRs, fmtTime } from '@/lib/whatsapp'

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  const session = verifyWorkerJwt(token)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { udhaar_id } = await request.json()
  if (!udhaar_id) return NextResponse.json({ error: 'Missing udhaar_id' }, { status: 400 })

  const supabase = await createClient()
  const [{ data: record }, { data: shop }] = await Promise.all([
    supabase.from('udhaar_records').select('customer_name, customer_phone, total_amount, mode, items, due_date').eq('id', udhaar_id).single(),
    supabase.from('shops').select('name, whatsapp_number, wa_phone_number_id, wa_access_token').eq('id', session.shop_id).single(),
  ])

  if (!record || !shop || !isWAConfigured(shop)) {
    return NextResponse.json({ success: true, skipped: true })
  }

  const itemsLine = record.mode === 'item_based' && Array.isArray(record.items)
    ? record.items.map((i: { name: string; price: number }) => `• ${i.name} — ${fmtRs(i.price)}`).join('\n')
    : `Value-based udhaar`

  const msg = [
    `📋 Udhaar Logged — ${fmtTime()}`,
    `──────────────────`,
    `Customer: ${record.customer_name} (${record.customer_phone})`,
    `Amount: ${fmtRs(record.total_amount)}`,
    `Due: ${record.due_date ?? 'Not set'}`,
    itemsLine,
    `Worker: ${session.worker_name}`,
    `──────────────────`,
    `— ShopBoss`,
  ].join('\n')

  const sent = await sendWhatsApp({ to: shop.whatsapp_number, message: msg, phoneNumberId: shop.wa_phone_number_id, accessToken: shop.wa_access_token })
  return NextResponse.json({ success: true, sent })
}
