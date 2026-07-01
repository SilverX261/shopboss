import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyWorkerJwt } from '@/lib/worker-session'

const MAX_SCREENSHOTS = 50

export async function POST(request: Request) {
  // Auth: worker JWT from Authorization header
  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const session = verifyWorkerJwt(token)
  if (!session) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const { image } = await request.json() // base64 data URL
  if (!image) return NextResponse.json({ error: 'No image' }, { status: 400 })

  const supabase = await createClient()

  // Convert base64 to buffer
  const base64Data = image.replace(/^data:image\/\w+;base64,/, '')
  const buffer = Buffer.from(base64Data, 'base64')

  const timestamp = Date.now()
  const path = `screenshots/${session.shop_id}/${timestamp}.jpg`

  const { error: uploadError } = await supabase.storage
    .from('screenshots')
    .upload(path, buffer, {
      contentType: 'image/jpeg',
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  // Prune — keep only the last MAX_SCREENSHOTS per shop
  const { data: existing } = await supabase.storage
    .from('screenshots')
    .list(`screenshots/${session.shop_id}`, {
      limit: 200,
      sortBy: { column: 'name', order: 'asc' },
    })

  if (existing && existing.length > MAX_SCREENSHOTS) {
    const toDelete = existing
      .slice(0, existing.length - MAX_SCREENSHOTS)
      .map((f) => `screenshots/${session.shop_id}/${f.name}`)
    await supabase.storage.from('screenshots').remove(toDelete)
  }

  return NextResponse.json({ success: true, path })
}

