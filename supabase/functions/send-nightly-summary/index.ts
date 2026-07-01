// Deno Edge Function — nightly summary at 9 PM PKT (4 PM UTC)
// Deploy: supabase functions deploy send-nightly-summary
// Schedule: SELECT cron.schedule('nightly-summary', '0 16 * * *', $$SELECT net.http_post(...)$$);

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

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const today = new Date().toISOString().slice(0, 10)
  const todayStart = `${today}T00:00:00.000Z`

  // Fetch all active/trial shops with pro or boss plan
  const { data: shops } = await supabase
    .from('shops')
    .select('id, name, plan, whatsapp_number, wa_phone_number_id, wa_access_token')
    .in('plan', ['pro', 'boss'])
    .in('subscription_status', ['active', 'trial'])
    .not('wa_phone_number_id', 'is', null)
    .not('wa_access_token', 'is', null)
    .not('whatsapp_number', 'is', null)

  if (!shops?.length) return new Response('No shops to notify', { status: 200 })

  await Promise.allSettled(shops.map(async (shop: {
    id: string; name: string; plan: string;
    whatsapp_number: string; wa_phone_number_id: string; wa_access_token: string;
  }) => {
    const [salesRes, cashRes, udhaarRes, accRes, stockRes, overdueRes] = await Promise.all([
      supabase.from('sales').select('sale_price, profit, payment_type').eq('shop_id', shop.id).eq('is_voided', false).gte('sold_at', todayStart),
      supabase.from('cash_records').select('record_type, amount').eq('shop_id', shop.id).gte('created_at', todayStart),
      supabase.from('udhaar_records').select('total_amount').eq('shop_id', shop.id).gte('created_at', todayStart),
      supabase.from('accessory_transactions').select('value, transaction_type').eq('shop_id', shop.id).gte('created_at', todayStart),
      supabase.from('laptops').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id).eq('status', 'in_stock'),
      supabase.from('udhaar_records').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id).in('status', ['pending', 'partial']).lt('due_date', today),
    ])

    const sales = salesRes.data ?? []
    const salesCount = sales.length
    const salesTotal = sales.reduce((s: number, r: { sale_price: number }) => s + r.sale_price, 0)
    const salesProfit = sales.reduce((s: number, r: { profit: number }) => s + r.profit, 0)

    const cashRecords = cashRes.data ?? []
    const cashSales = sales.filter((s: { payment_type: string }) => s.payment_type === 'cash').reduce((s: number, r: { sale_price: number }) => s + r.sale_price, 0)
    const cashExpenses = cashRecords.filter((r: { record_type: string }) => r.record_type === 'expense').reduce((s: number, r: { amount: number }) => s + r.amount, 0)
    const cashCollected = cashSales - cashExpenses

    const udhaarGiven = (udhaarRes.data ?? []).reduce((s: number, r: { total_amount: number }) => s + r.total_amount, 0)

    const accMoved = (accRes.data ?? [])
      .filter((t: { transaction_type: string }) => ['sale', 'udhaar'].includes(t.transaction_type))
      .reduce((s: number, t: { value: number }) => s + t.value, 0)

    const stockCount = stockRes.count ?? 0
    const overdueCount = overdueRes.count ?? 0

    const date = new Date().toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })

    const msg = [
      `⚡ ShopBoss — Today's Report (${date})`,
      `──────────────────`,
      `📦 Laptops sold: ${salesCount} (${fmtRs(salesTotal)})`,
      `💰 Cash collected: ${fmtRs(cashCollected)}`,
      `📋 Udhaar given: ${fmtRs(udhaarGiven)}`,
      `🔌 Accessories moved: ${fmtRs(accMoved)}`,
      shop.plan === 'boss' ? `📈 Profit today: ${fmtRs(salesProfit)}` : null,
      `──────────────────`,
      `Stock remaining: ${stockCount} laptops`,
      `Udhaar overdue: ${overdueCount} records`,
      `──────────────────`,
      `— ShopBoss by Volta Builds`,
    ].filter(Boolean).join('\n')

    await sendWA(shop.whatsapp_number, msg, shop.wa_phone_number_id, shop.wa_access_token)
  }))

  return new Response(JSON.stringify({ sent: shops.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
