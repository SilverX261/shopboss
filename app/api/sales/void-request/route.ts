import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendWhatsApp, fmtRs } from '@/lib/whatsapp'
import jwt from 'jsonwebtoken'

const SECRET = process.env.WORKER_JWT_SECRET ?? 'shopboss-worker-secret-change-in-prod'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sale_id } = await request.json()
  if (!sale_id) return NextResponse.json({ error: 'Missing sale_id' }, { status: 400 })

  // Fetch sale + laptop + shop in one go
  const { data: sale } = await supabase
    .from('sales')
    .select(`
      id, sale_price, is_voided, shop_id,
      laptops ( brand, model, imei ),
      workers ( name )
    `)
    .eq('id', sale_id)
    .single()

  if (!sale) return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
  if (sale.is_voided) return NextResponse.json({ error: 'Already voided' }, { status: 409 })

  // Verify this sale belongs to the owner's shop
  const { data: shop } = await supabase
    .from('shops')
    .select('id, whatsapp_number, wa_phone_number_id, wa_access_token, owner_id')
    .eq('owner_id', user.id)
    .single()

  if (!shop || shop.id !== sale.shop_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Generate 6-digit OTP
  const otp = String(Math.floor(100000 + Math.random() * 900000))

  // Sign a short-lived JWT containing sale_id + OTP
  const voidToken = jwt.sign(
    { sale_id, shop_id: shop.id, otp },
    SECRET,
    { expiresIn: '5m' }
  )

  // Send OTP via WhatsApp
  const laptop = Array.isArray(sale.laptops) ? sale.laptops[0] : sale.laptops as { brand: string; model: string; imei: string }
  const worker = Array.isArray(sale.workers) ? sale.workers[0] : sale.workers as { name: string }

  if (shop.wa_phone_number_id && shop.wa_access_token && shop.whatsapp_number) {
    const msg = [
      `🔐 ShopBoss OTP: *${otp}*`,
      `Use to void sale of:`,
      `${laptop?.brand ?? ''} ${laptop?.model ?? ''}`,
      `${fmtRs(sale.sale_price)} by ${worker?.name ?? 'worker'}`,
      `Valid for 5 minutes.`,
      `— ShopBoss`,
    ].join('\n')

    await sendWhatsApp({
      to: shop.whatsapp_number,
      message: msg,
      phoneNumberId: shop.wa_phone_number_id,
      accessToken: shop.wa_access_token,
    })
  }

  return NextResponse.json({ void_token: voidToken })
}
