import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const imei = searchParams.get('imei')

  if (!imei || !/^\d{15}$/.test(imei)) {
    return NextResponse.json({ error: 'Invalid IMEI' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Plan check — pro/boss only
  const { data: shop } = await supabase
    .from('shops')
    .select('plan')
    .eq('owner_id', user.id)
    .single()

  if (!shop || shop.plan === 'standard') {
    return NextResponse.json({ error: 'Pro or Boss plan required' }, { status: 403 })
  }

  // Try IMEI lookup — using imeicheck.id free tier or similar
  // Falls back to null gracefully on failure so manual entry continues
  try {
    const apiKey = process.env.IMEI_API_KEY
    if (!apiKey) return NextResponse.json({ result: null })

    const res = await fetch(`https://api.imeicheck.net/v1/checks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ deviceId: imei, serviceId: 1 }),
    })

    if (!res.ok) return NextResponse.json({ result: null })

    const data = await res.json()
    const props = data?.properties ?? {}

    return NextResponse.json({
      result: {
        brand: props.brand ?? props.manufacturer ?? null,
        model: props.modelName ?? props.model ?? null,
        specs: {
          ram: props.ramCapacity ?? null,
          storage: props.storageCapacity ?? null,
          processor: props.chipset ?? null,
          screen: props.displaySize ?? null,
        },
      },
    })
  } catch {
    return NextResponse.json({ result: null })
  }
}
