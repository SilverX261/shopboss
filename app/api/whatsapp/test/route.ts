import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { whatsappNumber } = await request.json()
  if (!whatsappNumber) return NextResponse.json({ error: 'Missing whatsappNumber' }, { status: 400 })

  const { data: shop } = await supabase
    .from('shops')
    .select('wa_phone_number_id, wa_access_token')
    .eq('owner_id', user.id)
    .single()

  // If the shop has a WhatsApp API configured, use it; otherwise simulate success in dev
  if (shop?.wa_phone_number_id && shop?.wa_access_token) {
    const body = {
      messaging_product: 'whatsapp',
      to: whatsappNumber.replace(/^0/, '92'),
      type: 'text',
      text: {
        body: 'Welcome to ShopBoss! Your alerts will arrive here. — Volta Builds 🇵🇰',
      },
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
      return NextResponse.json({ error: err?.error?.message ?? 'WhatsApp API error' }, { status: 502 })
    }
  }

  // Update whatsapp_number if changed
  await supabase
    .from('shops')
    .update({ whatsapp_number: whatsappNumber })
    .eq('owner_id', user.id)

  return NextResponse.json({ success: true })
}
