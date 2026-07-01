import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyWorkerJwt } from '@/lib/worker-session'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const approval_id = searchParams.get('id')
  const token = searchParams.get('token') ?? ''

  const session = verifyWorkerJwt(token)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!approval_id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = await createClient()
  const { data } = await supabase
    .from('udhaar_approvals')
    .select('id, status, resolved_at')
    .eq('id', approval_id)
    .eq('shop_id', session.shop_id)
    .single()

  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ status: data.status, resolved_at: data.resolved_at })
}
