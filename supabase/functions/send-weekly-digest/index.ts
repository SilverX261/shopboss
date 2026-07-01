// Deno Edge Function — weekly digest at 9 AM PKT Monday (4 AM UTC Monday)
// Schedule: SELECT cron.schedule('weekly-digest', '0 4 * * 1', $$SELECT net.http_post(...)$$);

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const WHATSAPP_API_URL = Deno.env.get('WHATSAPP_API_URL') ?? 'https://graph.facebook.com/v18.0'

async function sendWA(to: string, message: string, phoneNumberId: string, accessToken: string) {
  try {
    await fetch(`${WHATSAPP_API_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to.replace(/^0/, '92'),
        type: 'text',
        text: { body: message },
      }),
    })
  } catch (e) {
    console.warn('WA send error:', e)
  }
}

function fmtRs(n: number) {
  return `Rs ${Math.round(n).toLocaleString('en-PK')}`
}

function arrow(curr: number, prev: number): string {
  if (curr > prev) return '↑'
  if (curr < prev) return '↓'
  return '→'
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const now = new Date()
  const thisWeekStart = new Date(now)
  thisWeekStart.setDate(now.getDate() - 7)
  const prevWeekStart = new Date(now)
  prevWeekStart.setDate(now.getDate() - 14)

  const tw = thisWeekStart.toISOString()
  const pw = prevWeekStart.toISOString()
  const tweStr = thisWeekStart.toISOString().slice(0, 10)
  const pweStr = prevWeekStart.toISOString().slice(0, 10)

  // Boss plan only for weekly digest
  const { data: shops } = await supabase
    .from('shops')
    .select('id, name, plan, whatsapp_number, wa_phone_number_id, wa_access_token')
    .eq('plan', 'boss')
    .in('subscription_status', ['active', 'trial'])
    .not('wa_phone_number_id', 'is', null)
    .not('wa_access_token', 'is', null)

  if (!shops?.length) return new Response('No boss shops', { status: 200 })

  await Promise.allSettled(shops.map(async (shop: {
    id: string; name: string; plan: string;
    whatsapp_number: string; wa_phone_number_id: string; wa_access_token: string;
  }) => {
    const fetchWeekSales = (start: string, end: string) =>
      supabase.from('sales').select('sale_price, profit, laptops(brand, model)').eq('shop_id', shop.id).eq('is_voided', false).gte('sold_at', start).lt('sold_at', end)

    const fetchWeekUdhaar = (start: string, end: string) =>
      supabase.from('udhaar_records').select('total_amount, amount_paid, status').eq('shop_id', shop.id).gte('created_at', start).lt('created_at', end)

    const [thisWeekSales, prevWeekSales, thisWeekUdhaar, prevWeekUdhaar] = await Promise.all([
      fetchWeekSales(tw, now.toISOString()),
      fetchWeekSales(pw, tw),
      fetchWeekUdhaar(tw, now.toISOString()),
      fetchWeekUdhaar(pw, tw),
    ])

    const tw_sales = thisWeekSales.data ?? []
    const pw_sales = prevWeekSales.data ?? []
    const tw_udhaar = thisWeekUdhaar.data ?? []
    const pw_udhaar = prevWeekUdhaar.data ?? []

    const tw_count = tw_sales.length
    const pw_count = pw_sales.length
    const tw_revenue = tw_sales.reduce((s: number, r: { sale_price: number }) => s + r.sale_price, 0)
    const pw_revenue = pw_sales.reduce((s: number, r: { sale_price: number }) => s + r.sale_price, 0)
    const tw_profit = tw_sales.reduce((s: number, r: { profit: number }) => s + r.profit, 0)
    const pw_profit = pw_sales.reduce((s: number, r: { profit: number }) => s + r.profit, 0)

    // Best-selling model
    const modelCounts: Record<string, number> = {}
    tw_sales.forEach((s: { laptops: { brand: string; model: string } | { brand: string; model: string }[] | null }) => {
      const l = Array.isArray(s.laptops) ? s.laptops[0] : s.laptops
      if (l) {
        const key = `${l.brand} ${l.model}`
        modelCounts[key] = (modelCounts[key] ?? 0) + 1
      }
    })
    const bestModel = Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'N/A'

    // Udhaar recovered this week
    const tw_recovered = tw_udhaar.filter((r: { status: string }) => r.status === 'paid').reduce((s: number, r: { amount_paid: number }) => s + r.amount_paid, 0)
    const tw_new_udhaar = tw_udhaar.reduce((s: number, r: { total_amount: number }) => s + r.total_amount, 0)
    const pw_new_udhaar = pw_udhaar.reduce((s: number, r: { total_amount: number }) => s + r.total_amount, 0)

    // Worst mover (longest in stock)
    const { data: worstMover } = await supabase
      .from('laptops')
      .select('brand, model, days_in_stock')
      .eq('shop_id', shop.id)
      .eq('status', 'in_stock')
      .order('days_in_stock', { ascending: false })
      .limit(1)
      .single()

    const weekOf = thisWeekStart.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })

    const msg = [
      `⚡ ShopBoss — Weekly Digest`,
      `Week of ${weekOf}`,
      `──────────────────`,
      `📦 Laptops sold: ${tw_count} ${arrow(tw_count, pw_count)} (prev: ${pw_count})`,
      `💰 Revenue: ${fmtRs(tw_revenue)} ${arrow(tw_revenue, pw_revenue)}`,
      `📈 Profit: ${fmtRs(tw_profit)} ${arrow(tw_profit, pw_profit)}`,
      `──────────────────`,
      `🏆 Best seller: ${bestModel}`,
      worstMover ? `🐌 Worst mover: ${worstMover.brand} ${worstMover.model} (${worstMover.days_in_stock}d)` : null,
      `──────────────────`,
      `📋 New udhaar: ${fmtRs(tw_new_udhaar)} ${arrow(tw_new_udhaar, pw_new_udhaar)}`,
      `✅ Udhaar recovered: ${fmtRs(tw_recovered)}`,
      `──────────────────`,
      `— ShopBoss by Volta Builds`,
    ].filter(Boolean).join('\n')

    await sendWA(shop.whatsapp_number, msg, shop.wa_phone_number_id, shop.wa_access_token)
  }))

  return new Response(JSON.stringify({ sent: shops.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
