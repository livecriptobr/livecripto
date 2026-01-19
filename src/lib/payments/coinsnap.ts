const COINSNAP_URL = 'https://app.coinsnap.io/api/v1'

export interface CoinsnapInvoice {
  amount: number
  currency: string
  orderId: string
  redirectUrl?: string
  metadata?: Record<string, string>
}

export interface CoinsnapResponse {
  id: string
  lightning?: string
  bolt11?: string
  qrCodeDataUrl?: string
  expirationTime: string
}

export async function createLightningInvoice(params: CoinsnapInvoice): Promise<{
  invoiceId: string
  bolt11: string
  qrCode: string
  expiresAt: string
}> {
  const storeId = process.env.COINSNAP_STORE_ID

  const response = await fetch(`${COINSNAP_URL}/stores/${storeId}/invoices`, {
    method: 'POST',
    headers: {
      Authorization: `token ${process.env.COINSNAP_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: params.amount,
      currency: params.currency,
      orderId: params.orderId,
      redirectUrl: params.redirectUrl,
      metadata: params.metadata,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Coinsnap error: ${error}`)
  }

  const data: CoinsnapResponse = await response.json()

  return {
    invoiceId: data.id,
    bolt11: data.lightning || data.bolt11 || '',
    qrCode: data.qrCodeDataUrl ? `data:image/png;base64,${data.qrCodeDataUrl}` : '',
    expiresAt: data.expirationTime,
  }
}

export function validateCoinsnapSignature(payload: string, signature: string): boolean {
  const crypto = require('crypto')
  const secret = process.env.COINSNAP_WEBHOOK_SECRET
  if (!secret) return false

  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(payload)
  const expected = hmac.digest('hex')

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}
