import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const authClient = await createClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const {
      shop_id, mode, customer_name, customer_phone,
      total_amount, amount_paid, amount_remaining,
      description, items, due_date,
      notes, cnic_photo_url, approved_by_owner, sale_id,
    } = body

    if (!shop_id || !customer_name || !customer_phone || !total_amount || !due_date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await createServiceClient()

    const { data: shop } = await supabase
      .from('shops').select('id').eq('id', shop_id).eq('owner_id', user.id).single()
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const record: Record<string, unknown> = {
      shop_id,
      mode: mode ?? 'value_based',
      customer_name: customer_name.trim(),
      customer_phone: String(customer_phone).replace(/\D/g, '').slice(0, 11),
      total_amount,
      amount_paid: amount_paid ?? 0,
      amount_remaining: amount_remaining ?? total_amount,
      items: items ?? [],
      due_date,
      status: 'pending',
    }
    if (description?.trim()) record.description = description.trim()
    if (notes?.trim()) record.notes = notes.trim()
    if (cnic_photo_url) record.cnic_photo_url = cnic_photo_url
    if (approved_by_owner !== undefined) record.approved_by_owner = approved_by_owner
    if (sale_id) record.sale_id = sale_id

    const { data: udhaarData, error: udhaarErr } = await supabase
      .from('udhaar_records')
      .insert(record)
      .select('id')
      .single()

    if (udhaarErr) {
      console.error('[udhaar/create-owner]', udhaarErr)
      return NextResponse.json({ error: udhaarErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: udhaarData?.id })
  } catch (err) {
    console.error('[udhaar/create-owner] unhandled:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
