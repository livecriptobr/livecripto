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

// OpenPix public key for webhook signature verification (RSA SHA-256)
// See: https://developers.openpix.com.br/en/docs/webhook/seguranca/webhook-signature-validation
const OPENPIX_PUBLIC_KEY_BASE64 =
  'LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUlHZk1BMEdDU3FHU0liM0RRRUJBUVVBQTRHTkFEQ0JpUUtCZ1FDLytOdElranpldnZxRCtJM01NdjNiTFhEdApwdnhCalk0QnNSclNkY2EzcnRBd01jUllZdnhTbmQ3amFnVkxwY3RNaU94UU84aWVVQ0tMU1dIcHNNQWpPL3paCldNS2Jxb0c4TU5waS91M2ZwNnp6MG1jSENPU3FZc1BVVUcxOWJ1VzhiaXM1WloySVpnQk9iV1NwVHZKMGNuajYKSEtCQUE4MkpsbitsR3dTMU13SURBUUFCCi0tLS0tRU5EIFBVQkxJQyBLRVktLS0tLQo='

export function validateOpenPixSignature(payload: string, signature: string): boolean {
  if (!signature) return false

  try {
    const publicKey = Buffer.from(OPENPIX_PUBLIC_KEY_BASE64, 'base64').toString('ascii')
    const verify = crypto.createVerify('sha256')
    verify.write(Buffer.from(payload))
    verify.end()
    return verify.verify(publicKey, signature, 'base64')
  } catch {
    return false
  }
}
