import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyWorkerJwt } from '@/lib/worker-session'
import { sendWhatsApp, isWAConfigured, fmtRs } from '@/lib/whatsapp'

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  const session = verifyWorkerJwt(token)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { amount, customer_name, customer_phone, mode, items, note, category_id, deduct_units, due_date } = body

  if (!amount || !customer_name) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = await createClient()

  // Fetch shop for WA creds + max threshold
  const { data: shop } = await supabase
    .from('shops')
    .select('id, name, whatsapp_number, wa_phone_number_id, wa_access_token, max_udhaar_without_approval')
    .eq('id', session.shop_id)
    .single()

  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

  // Insert pending approval record
  const { data: approval, error } = await supabase
    .from('udhaar_approvals')
    .insert({
      shop_id: session.shop_id,
      worker_id: session.worker_id,
      status: 'pending',
      amount,
      customer_name,
      customer_phone,
      mode,
      items: items ?? null,
      note: note ?? null,
      category_id: category_id ?? null,
      deduct_units: deduct_units ?? null,
      due_date: due_date ?? null,
    })
    .select('id')
    .single()

  if (error || !approval) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create approval request' }, { status: 500 })
  }

  // Send WhatsApp to owner
  if (isWAConfigured(shop)) {
    let modeDetail = ''
    if (mode === 'item_based' && Array.isArray(items)) {
      modeDetail = `Items: ${items.map((i: { name: string; price: number }) => `${i.name} (${fmtRs(i.price)})`).join(', ')}`
    } else {
      modeDetail = `Note: ${note ?? 'none'}`
    }

    const msg = [
      `⚠️ Udhaar Approval Needed`,
      `──────────────────`,
      `Worker: ${session.worker_name}`,
      `Amount: ${fmtRs(amount)}`,
      `Customer: ${customer_name} (${customer_phone})`,
      modeDetail,
      `──────────────────`,
      `Reply *YES* to approve or *NO* to reject.`,
      `[Ref: ${approval.id.slice(0, 8)}]`,
      `— ShopBoss`,
    ].join('\n')

    await sendWhatsApp({
      to: shop.whatsapp_number,
      message: msg,
      phoneNumberId: shop.wa_phone_number_id,
      accessToken: shop.wa_access_token,
    })
  }

  return NextResponse.json({ approval_id: approval.id })
}
