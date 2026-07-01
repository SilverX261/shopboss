import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendWhatsApp, isWAConfigured } from '@/lib/whatsapp'

// Called by a cron or after each sale to check inventory thresholds
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { shop_id } = await request.json().catch(() => ({}))

  const { data: shop } = await supabase
    .from('shops')
    .select('id, name, whatsapp_number, wa_phone_number_id, wa_access_token, owner_id')
    .eq(shop_id ? 'id' : 'owner_id', shop_id ?? user.id)
    .single()

  if (!shop || shop.owner_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!isWAConfigured(shop)) return NextResponse.json({ success: true, skipped: true })

  const THRESHOLD = 3
  const { data: laptops } = await supabase
    .from('laptops')
    .select('brand')
    .eq('shop_id', shop.id)
    .eq('status', 'in_stock')

  const byBrand: Record<string, number> = {}
  ;(laptops ?? []).forEach((l: { brand: string }) => { byBrand[l.brand] = (byBrand[l.brand] ?? 0) + 1 })
  const low = Object.entries(byBrand).filter(([, c]) => c <= THRESHOLD)

  if (!low.length) return NextResponse.json({ success: true, no_alert: true })

  const msg = [
    `⚠️ Low Stock Alert — ${shop.name}`,
    `──────────────────`,
    ...low.map(([brand, count]) => `• ${brand}: only ${count} left`),
    `──────────────────`,
    `Consider restocking soon.`,
    `— ShopBoss`,
  ].join('\n')

  const sent = await sendWhatsApp({ to: shop.whatsapp_number, message: msg, phoneNumberId: shop.wa_phone_number_id, accessToken: shop.wa_access_token })
  return NextResponse.json({ success: true, sent, low_brands: low.map(([b]) => b) })
}
