import crypto from 'crypto';

const API_KEY = process.env.NOWPAYMENTS_API_KEY!;
const IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET!;
const BASE_URL = 'https://api.nowpayments.io/v1';

interface CreatePaymentParams {
  amount: number;
  currency: string;
  orderId: string;
  description?: string;
  callbackUrl?: string;
  successUrl?: string;
  cancelUrl?: string;
}

interface NowPaymentResponse {
  payment_id: string;
  payment_status: string;
  pay_address: string;
  price_amount: number;
  price_currency: string;
  pay_amount: number;
  pay_currency: string;
  order_id: string;
  order_description: string;
  invoice_url?: string;
}

export async function createPayment(params: CreatePaymentParams): Promise<NowPaymentResponse> {
  const response = await fetch(`${BASE_URL}/invoice`, {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      price_amount: params.amount,
      price_currency: params.currency,
      order_id: params.orderId,
      order_description: params.description || `Donation ${params.orderId}`,
      ipn_callback_url: params.callbackUrl,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`NowPayments error: ${error}`);
  }

  return response.json();
}

export async function getPaymentStatus(paymentId: string): Promise<NowPaymentResponse> {
  const response = await fetch(`${BASE_URL}/payment/${paymentId}`, {
    headers: {
      'x-api-key': API_KEY,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`NowPayments error: ${error}`);
  }

  return response.json();
}

export function verifyWebhookSignature(payload: string, signature: string): boolean {
  if (!IPN_SECRET) return false;

  const hmac = crypto.createHmac('sha512', IPN_SECRET);
  hmac.update(payload);
  const calculatedSignature = hmac.digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(calculatedSignature)
  );
}

export function sortObject(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.keys(obj)
    .sort()
    .reduce((result: Record<string, unknown>, key) => {
      result[key] = obj[key];
      return result;
    }, {});
}

// NowPayments payment statuses
export const PaymentStatus = {
  WAITING: 'waiting',
  CONFIRMING: 'confirming',
  CONFIRMED: 'confirmed',
  SENDING: 'sending',
  PARTIALLY_PAID: 'partially_paid',
  FINISHED: 'finished',
  FAILED: 'failed',
  REFUNDED: 'refunded',
  EXPIRED: 'expired',
} as const;
