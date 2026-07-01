import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const authClient = await createClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { shop_id, transaction_type, amount, direction, description, reference_number, transaction_date } = body

    if (!shop_id || !transaction_type || !amount || !direction) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await createServiceClient()

    const { data: shop } = await supabase
      .from('shops').select('id').eq('id', shop_id).eq('owner_id', user.id).single()
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const { error } = await supabase.from('bank_transactions').insert({
      shop_id,
      transaction_type,
      amount,
      direction,
      description: description ?? null,
      reference_number: reference_number ?? null,
      transaction_date: transaction_date ?? new Date().toISOString().slice(0, 10),
    })

    if (error) {
      console.error('[cash/bank-entry]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[cash/bank-entry] unhandled:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
