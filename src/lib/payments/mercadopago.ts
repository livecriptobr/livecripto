export interface MercadoPagoPreference {
  donationId: string
  title: string
  amountBrl: number
  payerEmail?: string
}

export interface MercadoPagoPreferenceResponse {
  id: string
  init_point: string
  sandbox_init_point: string
}

export async function createCheckoutPreference(params: MercadoPagoPreference): Promise<{
  preferenceId: string
  redirectUrl: string
}> {
  const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      items: [
        {
          id: params.donationId,
          title: params.title,
          quantity: 1,
          unit_price: params.amountBrl,
          currency_id: 'BRL',
        },
      ],
      external_reference: params.donationId,
      back_urls: {
        success: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/return?status=success`,
        failure: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/return?status=failure`,
        pending: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/return?status=pending`,
      },
      auto_return: 'approved',
      notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/mercadopago`,
      ...(params.payerEmail && {
        payer: {
          email: params.payerEmail,
        },
      }),
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`MercadoPago error: ${error}`)
  }

  const data: MercadoPagoPreferenceResponse = await response.json()

  return {
    preferenceId: data.id,
    redirectUrl: data.init_point,
  }
}

export async function getPaymentStatus(paymentId: string): Promise<string> {
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: {
      Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
    },
  })

  if (!response.ok) return 'unknown'

  const data = await response.json()
  return data.status
}

export async function getPaymentByExternalReference(externalReference: string): Promise<{
  paymentId: string
  status: string
} | null> {
  const response = await fetch(
    `https://api.mercadopago.com/v1/payments/search?external_reference=${externalReference}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
      },
    }
  )

  if (!response.ok) return null

  const data = await response.json()
  if (data.results && data.results.length > 0) {
    const payment = data.results[0]
    return {
      paymentId: String(payment.id),
      status: payment.status,
    }
  }

  return null
}
