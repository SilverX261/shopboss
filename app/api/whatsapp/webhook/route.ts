import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendWhatsApp, isWAConfigured } from '@/lib/whatsapp'
import crypto from 'crypto'

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN ?? 'shopboss-verify'
const APP_SECRET = process.env.WHATSAPP_APP_SECRET ?? ''

// ─── GET — Meta webhook verification ─────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new Response(challenge ?? '', { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

// ─── POST — Incoming messages ─────────────────────────────────────────────────

export async function POST(request: Request) {
  const rawBody = await request.text()

  // Verify signature
  if (APP_SECRET) {
    const sig = request.headers.get('x-hub-signature-256') ?? ''
    const expected = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(rawBody).digest('hex')
    if (sig !== expected) {
      console.warn('[Webhook] Invalid signature')
      return new Response('Forbidden', { status: 403 })
    }
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ ok: true }) // Meta retries if we don't 200 quickly
  }

  // Extract message
  const entry = (body.entry as Record<string, unknown>[])?.[0]
  const change = (entry?.changes as Record<string, unknown>[])?.[0]
  const value = change?.value as Record<string, unknown> | undefined
  const messages = value?.messages as Record<string, unknown>[] | undefined
  const message = messages?.[0]

  if (!message) return NextResponse.json({ ok: true })

  const from = String(message.from ?? '')
  const msgType = String(message.type ?? '')
  const textBody = msgType === 'text'
    ? String((message.text as Record<string, unknown>)?.body ?? '').trim()
    : ''

  if (!from || !textBody) return NextResponse.json({ ok: true })

  const supabase = await createClient()

  // Normalize sender number: Meta sends as 923001234567, our DB stores 03001234567 or 923001234567
  const normalized92 = from.startsWith('92') ? from : `92${from.replace(/^0/, '')}`
  const normalized0 = '0' + normalized92.slice(2)

  // Find shop by owner whatsapp_number
  const { data: shop } = await supabase
    .from('shops')
    .select('id, whatsapp_number, wa_phone_number_id, wa_access_token')
    .or(`whatsapp_number.eq.${normalized92},whatsapp_number.eq.${normalized0},whatsapp_number.eq.${from}`)
    .single()

  if (!shop) return NextResponse.json({ ok: true }) // not a known shop owner

  // Handle YES/NO for udhaar approval
  const upperText = textBody.toUpperCase().replace(/[^A-Z]/g, '')
  if (upperText === 'YES' || upperText === 'NO') {
    const { data: pendingApproval } = await supabase
      .from('udhaar_approvals')
      .select('id')
      .eq('shop_id', shop.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (pendingApproval) {
      const newStatus = upperText === 'YES' ? 'approved' : 'rejected'
      await supabase.from('udhaar_approvals').update({
        status: newStatus,
        resolved_at: new Date().toISOString(),
      }).eq('id', pendingApproval.id)

      // Confirm back to owner
      if (isWAConfigured(shop)) {
        const confirmMsg = upperText === 'YES'
          ? `✅ Udhaar approved. Worker has been notified.\n— ShopBoss`
          : `❌ Udhaar rejected. Worker has been notified.\n— ShopBoss`
        sendWhatsApp({
          to: shop.whatsapp_number,
          message: confirmMsg,
          phoneNumberId: shop.wa_phone_number_id,
          accessToken: shop.wa_access_token,
        }).catch(() => {})
      }
    }
  }

  // Always return 200 so Meta doesn't retry
  return NextResponse.json({ ok: true })
}
