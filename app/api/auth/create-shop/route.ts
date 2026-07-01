import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  console.log('[create-shop] env check — url present:', !!url, 'service key present:', !!key)
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('[create-shop] received body:', JSON.stringify(body))

    const { userId, shopName, ownerName, ownerPhone, whatsappNumber, plan } = body

    if (!userId || !shopName || !plan) {
      console.error('[create-shop] missing required fields — userId:', userId, 'shopName:', shopName, 'plan:', plan)
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = getServiceClient()
    console.log('[create-shop] service client created')

    const { data: existing, error: existingErr } = await supabase
      .from('shops')
      .select('id')
      .eq('owner_id', userId)
      .maybeSingle()

    console.log('[create-shop] existing shop check — data:', existing, 'error:', existingErr)

    if (existing) {
      console.log('[create-shop] shop already exists, returning:', existing.id)
      return NextResponse.json({ shopId: existing.id })
    }

    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + 7)

    const insertPayload = {
      owner_id: userId,
      name: shopName,
      owner_name: ownerName ?? '',
      owner_phone: (ownerPhone || whatsappNumber || '').slice(0, 11),
      whatsapp_number: (whatsappNumber || '').slice(0, 11),
      plan,
      subscription_status: 'trial',
      trial_ends_at: trialEndsAt.toISOString(),
    }
    console.log('[create-shop] inserting payload:', JSON.stringify(insertPayload))

    const { data, error } = await supabase
      .from('shops')
      .insert(insertPayload)
      .select('id')
      .single()

    if (error) {
      console.error('[create-shop] insert error:', JSON.stringify(error))
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('[create-shop] shop created successfully, id:', data.id)
    return NextResponse.json({ shopId: data.id })
  } catch (err: unknown) {
    console.error('[create-shop] unexpected error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
