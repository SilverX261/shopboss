import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyWorkerJwt } from '@/lib/worker-session'
import { sendWhatsApp, fmtRs } from '@/lib/whatsapp'

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  const session = verifyWorkerJwt(token)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { declared_amount, expected_amount } = await request.json()
  if (declared_amount === undefined || declared_amount === null) {
    return NextResponse.json({ error: 'declared_amount required' }, { status: 400 })
  }

  const supabase = await createClient()

  // Update daily_cash_records with the closing declaration
  const today = new Date().toISOString().slice(0, 10)
  const { error } = await supabase.from('daily_cash_records').upsert(
    {
      shop_id: session.shop_id,
      record_date: today,
      closing_balance_actual: declared_amount,
      closing_balance_expected: expected_amount ?? declared_amount,
      difference: declared_amount - (expected_amount ?? declared_amount),
      is_closed: true,
    },
    { onConflict: 'shop_id,record_date' },
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const gap = Math.abs((expected_amount ?? 0) - declared_amount)

  // WhatsApp owner if gap exists
  if (gap > 0) {
    const { data: shop } = await supabase
      .from('shops')
      .select('whatsapp_number, wa_phone_number_id, wa_access_token')
      .eq('id', session.shop_id)
      .single()

    if (shop?.wa_phone_number_id && shop?.wa_access_token && shop?.whatsapp_number) {
      const msg = [
        `⚠️ Cash Declaration — End of Shift`,
        `Worker: ${session.worker_name}`,
        `──────────────────`,
        `Expected: ${fmtRs(expected_amount ?? 0)}`,
        `Declared: ${fmtRs(declared_amount)}`,
        `Gap: ${fmtRs(gap)} ${declared_amount < expected_amount ? '(short)' : '(over)'}`,
        `──────────────────`,
        `Verify your cash drawer.`,
        `— ShopBoss`,
      ].join('\n')

      sendWhatsApp({
        to: shop.whatsapp_number,
        message: msg,
        phoneNumberId: shop.wa_phone_number_id,
        accessToken: shop.wa_access_token,
      }).catch(() => {})
    }
  }

  return NextResponse.json({ success: true, gap })
}
