import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { signWorkerJwt } from '@/lib/worker-session'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
  const { worker_id, pin } = await request.json()

  if (!worker_id || !pin) {
    return NextResponse.json({ error: 'Missing worker_id or pin' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: worker, error } = await supabase
    .from('workers')
    .select('id, name, shop_id, pin_hash, is_active')
    .eq('id', worker_id)
    .single()

  if (error || !worker) {
    return NextResponse.json({ error: 'Worker not found' }, { status: 404 })
  }

  if (!worker.is_active) {
    return NextResponse.json({ error: 'Worker account is inactive' }, { status: 403 })
  }

  const valid = await bcrypt.compare(String(pin), worker.pin_hash)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 })
  }

  // Fetch shop plan
  const { data: shop } = await supabase
    .from('shops')
    .select('plan, subscription_status')
    .eq('id', worker.shop_id)
    .single()

  // Log login event
  await supabase.from('activity_log').insert({
    shop_id: worker.shop_id,
    worker_id: worker.id,
    event_type: 'login',
    page: '/worker/dashboard',
    details: { method: 'pin' },
  })

  const token = signWorkerJwt({
    worker_id: worker.id,
    shop_id: worker.shop_id,
    worker_name: worker.name,
    plan: shop?.plan ?? 'standard',
    logged_in_at: new Date().toISOString(),
  })

  return NextResponse.json({ token, plan: shop?.plan ?? 'standard' })
}
