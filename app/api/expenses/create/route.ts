import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    // Verify the user is authenticated
    const authClient = await createClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { shop_id, amount, category, description, payment_type, expense_date } = body

    if (!shop_id || !amount || !category || !description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    // Use service client to bypass RLS
    const supabase = await createServiceClient()

    // Verify the shop belongs to this user
    const { data: shop } = await supabase
      .from('shops')
      .select('id')
      .eq('id', shop_id)
      .eq('owner_id', user.id)
      .single()
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const { error } = await supabase.from('expenses').insert({
      shop_id,
      amount,
      category,
      description,
      payment_type: payment_type ?? 'cash',
      expense_date: expense_date ?? new Date().toISOString().slice(0, 10),
    })

    if (error) {
      console.error('[expenses/create]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[expenses/create] unhandled:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
