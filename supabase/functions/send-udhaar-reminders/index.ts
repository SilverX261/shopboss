// Deno Edge Function — udhaar auto-reminders at 10 AM PKT (5 AM UTC)
// Boss plan only. Sends WhatsApp to CUSTOMER (not owner).
// Schedule: SELECT cron.schedule('udhaar-reminders', '0 5 * * *', $$SELECT net.http_post(...)$$);

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

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const today = new Date().toISOString().slice(0, 10)
  const reminderTarget = new Date()
  reminderTarget.setDate(reminderTarget.getDate() + 3)
  const targetDate = reminderTarget.toISOString().slice(0, 10)
  const threeDaysAgo = new Date()
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

  // Find udhaar records due in 3 days, not recently reminded, shop on boss plan
  const { data: records } = await supabase
    .from('udhaar_records')
    .select(`
      id, customer_name, customer_phone, amount_remaining, due_date,
      shops!inner ( id, name, plan, wa_phone_number_id, wa_access_token )
    `)
    .in('status', ['pending', 'partial'])
    .eq('due_date', targetDate)
    .eq('shops.plan', 'boss')
    .in('shops.subscription_status', ['active', 'trial'])
    .or(`reminder_sent_at.is.null,reminder_sent_at.lt.${threeDaysAgo.toISOString()}`)

  if (!records?.length) return new Response('No reminders to send', { status: 200 })

  let sent = 0

  await Promise.allSettled(records.map(async (r: {
    id: string
    customer_name: string
    customer_phone: string
    amount_remaining: number
    due_date: string
    shops: { id: string; name: string; plan: string; wa_phone_number_id: string; wa_access_token: string }
  }) => {
    const shop = r.shops
    if (!shop.wa_phone_number_id || !shop.wa_access_token) return

    const dueFormatted = new Date(r.due_date).toLocaleDateString('en-PK', {
      day: 'numeric', month: 'long', year: 'numeric',
    })

    const msg = [
      `Assalamu Alaikum ${r.customer_name},`,
      ``,
      `Rs ${Math.round(r.amount_remaining).toLocaleString('en-PK')} ka payment ${shop.name} ko ${dueFormatted} tak due hai.`,
      ``,
      `Meherbani karein waqt pe payment karein.`,
      ``,
      `${shop.name} — Powered by ShopBoss`,
    ].join('\n')

    await sendWA(r.customer_phone, msg, shop.wa_phone_number_id, shop.wa_access_token)

    await supabase.from('udhaar_records').update({ reminder_sent_at: new Date().toISOString() }).eq('id', r.id)
    sent++
  }))

  return new Response(JSON.stringify({ sent }), { headers: { 'Content-Type': 'application/json' } })
})
