// Shared WhatsApp send helper — never throws, always logs on failure

interface SendWAArgs {
  to: string
  message: string
  phoneNumberId: string
  accessToken: string
}

export async function sendWhatsApp({ to, message, phoneNumberId, accessToken }: SendWAArgs): Promise<boolean> {
  const apiUrl = process.env.WHATSAPP_API_URL ?? 'https://graph.facebook.com/v18.0'
  try {
    const res = await fetch(`${apiUrl}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to.replace(/^0/, '92'),
        type: 'text',
        text: { body: message },
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.warn('[WhatsApp] Send failed:', err?.error?.message ?? res.status)
      return false
    }
    return true
  } catch (err) {
    console.warn('[WhatsApp] Send error:', err)
    return false
  }
}

// Normalise phone number to WhatsApp-compatible format
export function normalisePhone(phone: string): string {
  return phone.replace(/^0/, '92').replace(/\s/g, '')
}

// Format time as "3:45 PM"
export function fmtTime(date?: Date): string {
  return (date ?? new Date()).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })
}

// Format rupees
export function fmtRs(n: number): string {
  return `Rs ${Math.round(n).toLocaleString('en-PK')}`
}

// Send an image message via WhatsApp Cloud API
interface SendWAImageArgs {
  to: string
  imageUrl: string
  caption?: string
  phoneNumberId: string
  accessToken: string
}

export async function sendWhatsAppImage({
  to, imageUrl, caption, phoneNumberId, accessToken,
}: SendWAImageArgs): Promise<boolean> {
  const apiUrl = process.env.WHATSAPP_API_URL ?? 'https://graph.facebook.com/v18.0'
  try {
    const res = await fetch(`${apiUrl}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to.replace(/^0/, '92'),
        type: 'image',
        image: { link: imageUrl, ...(caption ? { caption } : {}) },
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.warn('[WhatsApp] Image send failed:', err?.error?.message ?? res.status)
      return false
    }
    return true
  } catch (err) {
    console.warn('[WhatsApp] Image send error:', err)
    return false
  }
}

// Build a standard shop WA args object from a shop row
export interface ShopWAConfig {
  whatsapp_number: string
  wa_phone_number_id: string
  wa_access_token: string
}

export function isWAConfigured(shop: Partial<ShopWAConfig>): shop is ShopWAConfig {
  return !!(shop.wa_phone_number_id && shop.wa_access_token && shop.whatsapp_number)
}
