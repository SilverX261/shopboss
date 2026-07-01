import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const WHATSAPP_API_URL = Deno.env.get('WHATSAPP_API_URL') ?? 'https://graph.facebook.com/v18.0'

const CHECKLIST_MESSAGE = `⚡ ShopBoss Daily Checklist
──────────────────
✅ Open cash balance logged?
✅ Accessories display tray restocked?
✅ Yesterday's udhaar followed up?
✅ Stock count matches system?
✅ Worker PINs are active?
──────────────────
Reply DONE when complete.
— ShopBoss by Volta Builds`

async function sendWhatsApp(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  message: string
): Promise<void> {
  const res = await fetch(`${WHATSAPP_API_URL}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to.replace(/^0/, '92'),
      type: 'text',
      text: { body: message },
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `WA send failed: ${res.status}`)
  }
}

serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const today = new Date().toISOString().split('T')[0]

  // 1 — Fetch all shops due for a reminder today
  const { data: shops, error } = await supabase
    .from('shops')
    .select('id, name, whatsapp_number, wa_phone_number_id, wa_access_token')
    .eq('next_reminder_date', today)
    .in('subscription_status', ['trial', 'active'])

  if (error) {
    console.error('[checklist] fetch error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  const results: { shop_id: string; status: string; error?: string }[] = []

  for (const shop of shops ?? []) {
    try {
      // 2 — Send WhatsApp
      if (shop.wa_phone_number_id && shop.wa_access_token) {
        await sendWhatsApp(
          shop.wa_phone_number_id,
          shop.wa_access_token,
          shop.whatsapp_number,
          CHECKLIST_MESSAGE
        )
      } else {
        console.warn(`[checklist] shop ${shop.id} has no WA credentials, skipping send`)
      }

      // 3 — Calculate next reminder date using the DB function (skip Fridays)
      const { data: nextDateRow } = await supabase
        .rpc('get_next_reminder_date', { from_date: today })

      const nextDate: string = nextDateRow ?? today

      // 4 — Update shop next_reminder_date
      await supabase
        .from('shops')
        .update({ next_reminder_date: nextDate })
        .eq('id', shop.id)

      // 5 — Log to checklist_reminders
      await supabase.from('checklist_reminders').insert({
        shop_id: shop.id,
        next_reminder_date: nextDate,
        channel: 'whatsapp',
      })

      results.push({ shop_id: shop.id, status: 'sent' })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[checklist] shop ${shop.id} failed:`, message)
      results.push({ shop_id: shop.id, status: 'failed', error: message })
    }
  }

  return new Response(
    JSON.stringify({ processed: results.length, results }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
