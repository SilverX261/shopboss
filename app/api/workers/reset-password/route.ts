import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const authClient = await createClient()
    const supabase = await createServiceClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: shop } = await supabase
      .from('shops').select('id, plan').eq('owner_id', user.id).single()
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

    const { workerId, newPassword } = await request.json()
    if (!workerId || !newPassword) {
      return NextResponse.json({ error: 'workerId and newPassword are required' }, { status: 400 })
    }

    // Get worker and verify they belong to this shop
    const { data: worker } = await supabase
      .from('workers').select('auth_user_id, shop_id').eq('id', workerId).single()
    if (!worker || worker.shop_id !== shop.id) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 })
    }
    if (!worker.auth_user_id) {
      return NextResponse.json({ error: 'Worker has no linked account' }, { status: 400 })
    }

    const { error } = await supabase.auth.admin.updateUserById(worker.auth_user_id, {
      password: newPassword,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 })
  }
}
