import crypto from 'crypto'

const OPENPIX_URL = 'https://api.openpix.com.br/api/v1'

export interface OpenPixCharge {
  correlationID: string
  value: number
  comment?: string
  expiresIn?: number
}

export interface OpenPixResponse {
  charge: {
    correlationID: string
    value: number
    status: string
    qrCodeImage: string
    brCode: string
    expiresDate: string
  }
}

export async function createPixCharge(params: OpenPixCharge): Promise<{
  chargeId: string
  qrCode: string
  copyPaste: string
  expiresAt: string
}> {
  const response = await fetch(`${OPENPIX_URL}/charge`, {
    method: 'POST',
    headers: {
      Authorization: process.env.OPENPIX_APP_ID!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      correlationID: params.correlationID,
      value: params.value,
      comment: params.comment,
      expiresIn: params.expiresIn || 900,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenPix error: ${error}`)
  }

  const data: OpenPixResponse = await response.json()

  return {
    chargeId: data.charge.correlationID,
    qrCode: data.charge.qrCodeImage,
    copyPaste: data.charge.brCode,
    expiresAt: data.charge.expiresDate,
  }
}

export function validateOpenPixSignature(payload: string, signature: string): boolean {
  const secret = process.env.OPENPIX_WEBHOOK_SECRET
  if (!secret) return false

  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(payload)
  const expected = hmac.digest('base64')

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}
