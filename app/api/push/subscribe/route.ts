import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyWorkerJwt } from '@/lib/worker-session'

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization')
  const body = await request.json()
  const { subscription } = body

  if (!subscription?.endpoint) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  }

  const supabase = await createClient()

  // Try worker auth first
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const session = verifyWorkerJwt(token)
    if (session) {
      await supabase
        .from('workers')
        .update({ push_token: JSON.stringify(subscription) })
        .eq('id', session.worker_id)
      return NextResponse.json({ success: true })
    }
  }

  // Owner auth fallback
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json({ success: true })
}
