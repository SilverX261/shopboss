import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const authClient = await createClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { shop_id, name, cost_per_unit, display_qty, total_value_added } = body

    if (!shop_id || !name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await createServiceClient()

    const { data: shop } = await supabase
      .from('shops').select('id').eq('id', shop_id).eq('owner_id', user.id).single()
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    // Insert the category with exact schema columns
    const catResult = await supabase
      .from('accessory_categories')
      .insert({
        shop_id,
        name: name.trim(),
        cost_per_unit: cost_per_unit ?? 0,
        display_qty: display_qty ?? 0,
        total_value_added: total_value_added ?? 0,
        total_value_sold: 0,
      })
      .select('id')
      .single()

    if (catResult.error || !catResult.data) {
      console.error('[accessories/add-category] category insert:', catResult.error)
      return NextResponse.json(
        { error: catResult.error?.message ?? 'Failed to create category' },
        { status: 500 }
      )
    }
    const cat = catResult.data

    // Record initial stock as a restock transaction if there's an initial value
    const initValue = total_value_added ?? 0
    const initQty = display_qty ?? 0

    if (initValue > 0) {
      const { error: txErr } = await supabase.from('accessory_transactions').insert({
        shop_id,
        category_id: cat.id,
        worker_id: null,
        transaction_type: 'restock',
        units: initQty,
        value: initValue,
        payment_type: 'cash',
        note: 'Initial stock',
      })
      if (txErr) {
        console.error('[accessories/add-category] transaction insert (non-fatal):', txErr)
      }
    }

    return NextResponse.json({ success: true, category_id: cat.id })
  } catch (err) {
    console.error('[accessories/add-category] unhandled:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
