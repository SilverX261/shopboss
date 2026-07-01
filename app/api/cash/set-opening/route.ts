import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const authClient = await createClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { shop_id, record_date, opening_balance } = body

    if (!shop_id || opening_balance === undefined || opening_balance === null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await createServiceClient()

    // Verify ownership
    const { data: shop } = await supabase
      .from('shops').select('id').eq('id', shop_id).eq('owner_id', user.id).single()
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const { error } = await supabase
      .from('daily_cash_records')
      .upsert(
        {
          shop_id,
          record_date: record_date ?? new Date().toISOString().slice(0, 10),
          opening_balance,
        },
        { onConflict: 'shop_id,record_date' },
      )

    if (error) {
      console.error('[cash/set-opening]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[cash/set-opening] unhandled:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
