import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const authClient = await createClient()
    const supabase = await createServiceClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Verify caller is an owner (has a shop)
    const { data: shop } = await supabase
      .from('shops')
      .select('id, plan')
      .eq('owner_id', user.id)
      .single()
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })
    if (shop.plan !== 'boss') return NextResponse.json({ error: 'Boss plan required' }, { status: 403 })

    const { name, email, password, phone } = await request.json()
    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 })
    }

    // Create Supabase auth user
    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
    })
    if (authErr || !authUser.user) {
      return NextResponse.json({ error: authErr?.message ?? 'Failed to create account' }, { status: 500 })
    }

    // Insert into workers table
    const { data: worker, error: workerErr } = await supabase
      .from('workers')
      .insert({
        shop_id: shop.id,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: 'staff',
        is_active: true,
        auth_user_id: authUser.user.id,
        pin_hash: '',
        ...(phone ? { push_token: null } : {}),
      })
      .select('id')
      .single()

    if (workerErr || !worker) {
      // Rollback: delete the auth user
      await supabase.auth.admin.deleteUser(authUser.user.id)
      return NextResponse.json({ error: workerErr?.message ?? 'Failed to create worker record' }, { status: 500 })
    }

    return NextResponse.json({ success: true, workerId: worker.id })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 })
  }
}
