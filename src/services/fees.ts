export type PaymentMethodType = 'pix' | 'card' | 'crypto' | 'lightning'

const FEE_RATES: Record<PaymentMethodType, number> = {
  pix: 0.0299,
  card: 0.0499,
  crypto: 0.0199,
  lightning: 0.0149,
}

export interface FeeCalculation {
  grossCents: number
  feeCents: number
  netCents: number
  feeRate: number
}

export function calculateFee(amountCents: number, method: PaymentMethodType): FeeCalculation {
  const feeRate = FEE_RATES[method]
  const feeCents = Math.round(amountCents * feeRate)
  const netCents = amountCents - feeCents

  return {
    grossCents: amountCents,
    feeCents,
    netCents,
    feeRate,
  }
}

export function getPaymentMethodType(provider: string): PaymentMethodType {
  switch (provider.toUpperCase()) {
    case 'OPENPIX':
    case 'MERCADOPAGO':
      return 'pix'
    case 'COINSNAP':
      return 'crypto'
    case 'NOWPAYMENTS':
      return 'lightning'
    default:
      return 'pix'
  }
}
