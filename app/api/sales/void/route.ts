import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import jwt from 'jsonwebtoken'

const SECRET = process.env.WORKER_JWT_SECRET ?? 'shopboss-worker-secret-change-in-prod'

interface VoidPayload {
  sale_id: string
  shop_id: string
  otp: string
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sale_id, void_token, otp } = await request.json()
  if (!sale_id || !void_token || !otp) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Verify token
  let payload: VoidPayload
  try {
    payload = jwt.verify(void_token, SECRET) as VoidPayload
  } catch {
    return NextResponse.json({ error: 'OTP expired or invalid. Request a new one.' }, { status: 401 })
  }

  if (payload.sale_id !== sale_id) {
    return NextResponse.json({ error: 'Token mismatch' }, { status: 400 })
  }

  if (payload.otp !== String(otp)) {
    return NextResponse.json({ error: 'Incorrect OTP' }, { status: 401 })
  }

  // Verify sale belongs to owner's shop
  const { data: shop } = await supabase
    .from('shops')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!shop || shop.id !== payload.shop_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch sale to get laptop_id
  const { data: sale } = await supabase
    .from('sales')
    .select('id, laptop_id, is_voided')
    .eq('id', sale_id)
    .single()

  if (!sale) return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
  if (sale.is_voided) return NextResponse.json({ error: 'Already voided' }, { status: 409 })

  // Mark sale as voided
  await supabase.from('sales').update({
    is_voided: true,
    void_approved_by: user.id,
  }).eq('id', sale_id)

  // Return laptop to in_stock (bulk items get their unit back)
  const { data: voidLaptop } = await supabase
    .from('laptops')
    .select('quantity, is_bulk')
    .eq('id', sale.laptop_id)
    .single()
  if (voidLaptop?.is_bulk) {
    await supabase.from('laptops').update({
      quantity: (voidLaptop.quantity ?? 0) + 1,
      status: 'in_stock',
    }).eq('id', sale.laptop_id)
  } else {
    await supabase.from('laptops').update({ status: 'in_stock' }).eq('id', sale.laptop_id)
  }

  // Log void activity
  await supabase.from('activity_log').insert({
    shop_id: shop.id,
    worker_id: user.id,
    event_type: 'void_attempt',
    page: '/dashboard/sales',
    details: { sale_id, voided_by: 'owner', success: true },
    post_snapshot: false,
  })

  return NextResponse.json({ success: true })
}
