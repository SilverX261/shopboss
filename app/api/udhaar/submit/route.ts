import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyWorkerJwt } from '@/lib/worker-session'
import { sendWhatsApp, isWAConfigured, fmtRs } from '@/lib/whatsapp'

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  const session = verifyWorkerJwt(token)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const mode = formData.get('mode') as string
  const customer_name = formData.get('customer_name') as string
  const customer_phone = formData.get('customer_phone') as string
  const due_date = formData.get('due_date') as string | null
  const total_amount = parseFloat(formData.get('total_amount') as string)
  const items = JSON.parse(formData.get('items') as string ?? '[]') as { name: string; price: number }[]
  const note = formData.get('note') as string | null
  const category_id = formData.get('category_id') as string | null
  const deduct_from_accessories = formData.get('deduct_from_accessories') === 'true'
  const deduct_units = parseInt(formData.get('deduct_units') as string ?? '0', 10)
  const cnicFile = formData.get('cnic_photo') as File | null

  if (!customer_name || !customer_phone || !total_amount) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = await createClient()

  // Upload CNIC photo if provided
  let cnic_photo_url: string | null = null
  if (cnicFile && cnicFile.size > 0) {
    const buf = Buffer.from(await cnicFile.arrayBuffer())
    const filename = `${session.shop_id}/${Date.now()}.jpg`
    const { data: uploadData } = await supabase.storage
      .from('cnic-photos')
      .upload(filename, buf, { contentType: 'image/jpeg', upsert: true })
    if (uploadData) {
      const { data: { publicUrl } } = supabase.storage.from('cnic-photos').getPublicUrl(filename)
      cnic_photo_url = publicUrl
    }
  }

  // Insert udhaar record
  const { data: record, error } = await supabase
    .from('udhaar_records')
    .insert({
      shop_id: session.shop_id,
      worker_id: session.worker_id,
      mode,
      customer_name,
      customer_phone,
      cnic_photo_url,
      total_amount,
      amount_paid: 0,
      amount_remaining: total_amount,
      items,
      due_date: due_date || null,
      status: 'pending',
      approved_by_owner: true,
      deduct_from_accessories,
      category_id: category_id || null,
    })
    .select('id')
    .single()

  if (error || !record) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create udhaar record' }, { status: 500 })
  }

  // Deduct from accessories if applicable
  if (deduct_from_accessories && category_id && deduct_units > 0) {
    const { data: cat } = await supabase
      .from('accessory_categories')
      .select('display_qty, total_value_sold, cost_per_unit')
      .eq('id', category_id)
      .single()
    if (cat) {
      const value = deduct_units * cat.cost_per_unit
      await Promise.all([
        supabase.from('accessory_transactions').insert({
          shop_id: session.shop_id,
          category_id,
          worker_id: session.worker_id,
          transaction_type: 'udhaar',
          units: deduct_units,
          value,
          note: `Udhaar to ${customer_name}`,
        }),
        supabase.from('accessory_categories').update({
          display_qty: Math.max(0, cat.display_qty - deduct_units),
          total_value_sold: (cat.total_value_sold ?? 0) + value,
        }).eq('id', category_id),
      ])
    }
  }

  // Log activity
  await supabase.from('activity_log').insert({
    shop_id: session.shop_id,
    worker_id: session.worker_id,
    event_type: 'udhaar',
    page: '/worker/udhaar/new',
    details: { udhaar_id: record.id, total_amount, customer_name, mode },
    post_snapshot: false,
  })

  // Notify owner via WhatsApp
  const { data: shop } = await supabase
    .from('shops')
    .select('name, whatsapp_number, wa_phone_number_id, wa_access_token')
    .eq('id', session.shop_id)
    .single()

  if (shop && isWAConfigured(shop)) {
    const itemsLine = mode === 'item_based' && items.length
      ? items.map((i) => `• ${i.name} — ${fmtRs(i.price)}`).join('\n')
      : note ?? 'Value-based udhaar'

    const msg = [
      `📋 Udhaar Logged`,
      `──────────────────`,
      `Customer: ${customer_name} (${customer_phone})`,
      `Amount: ${fmtRs(total_amount)}`,
      `Due: ${due_date ?? 'Not set'}`,
      itemsLine,
      `Worker: ${session.worker_name}`,
      `──────────────────`,
      `— ShopBoss`,
    ].join('\n')

    sendWhatsApp({ to: shop.whatsapp_number, message: msg, phoneNumberId: shop.wa_phone_number_id, accessToken: shop.wa_access_token }).catch(() => {})
  }

  return NextResponse.json({ success: true, udhaar_id: record.id })
}
