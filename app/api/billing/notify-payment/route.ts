import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendWhatsApp } from '@/lib/whatsapp'

const ADMIN_NUMBER = process.env.ADMIN_WHATSAPP_NUMBER ?? '03287800087'

export async function POST(request: Request) {
  try {
    const authClient = await createClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { shop_name, plan, amount, transaction_id } = await request.json() as {
      shop_name: string
      plan: string
      amount: number
      transaction_id: string
    }

    const phoneNumberId = process.env.ADMIN_WA_PHONE_NUMBER_ID
    const accessToken   = process.env.ADMIN_WA_ACCESS_TOKEN

    if (!phoneNumberId || !accessToken) {
      // WA not configured — silently succeed so payment submission still works
      return NextResponse.json({ sent: false, reason: 'WA not configured' })
    }

    const msg = [
      '💸 New payment proof received',
      `Shop: ${shop_name}`,
      `Plan: ${plan.charAt(0).toUpperCase() + plan.slice(1)} — Rs ${amount.toLocaleString()}`,
      `Easypaisa TxID: ${transaction_id}`,
      '',
      'Open Easypaisa → search transaction ID to verify, then run the SQL to activate.',
    ].join('\n')

    const sent = await sendWhatsApp({
      to: ADMIN_NUMBER,
      message: msg,
      phoneNumberId,
      accessToken,
    })

    return NextResponse.json({ sent })
  } catch (err) {
    console.error('[billing/notify-payment]', err)
    return NextResponse.json({ sent: false })
  }
}
