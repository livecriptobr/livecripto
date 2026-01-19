import { NextRequest, NextResponse } from 'next/server'
import { validateCoinsnapSignature } from '@/lib/payments/coinsnap'
import { processWebhookOnce } from '@/lib/webhook-idempotency'
import { handleDonationPaid, handleDonationExpired } from '@/services/donation.service'

/**
 * Coinsnap Webhook Handler
 *
 * Receives payment notifications from Coinsnap for Lightning payments.
 * Events handled:
 * - InvoiceSettled - Payment received via Lightning Network
 * - InvoiceExpired - Invoice expired without payment
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('btcpay-sig') || req.headers.get('x-signature') || ''

    // Validate signature (skip in dev if no secret configured)
    if (process.env.COINSNAP_WEBHOOK_SECRET) {
      if (!validateCoinsnapSignature(rawBody, signature)) {
        console.error('Coinsnap webhook: Invalid signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const payload = JSON.parse(rawBody)

    // Log the event for debugging
    console.log('Coinsnap webhook received:', payload.type || payload.event)

    const eventType = payload.type || payload.event

    // Extract order ID (our donation ID)
    const eventKey = payload.orderId || payload.metadata?.orderId || payload.invoiceId
    if (!eventKey) {
      console.error('Coinsnap webhook: Missing orderId/invoiceId')
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })
    }

    // Handle different event types
    if (eventType === 'InvoiceSettled' || eventType === 'invoice_settled') {
      const result = await processWebhookOnce('coinsnap', eventKey, payload, async () => {
        await handleDonationPaid(eventKey)
      })

      console.log('Coinsnap webhook processed (settled):', {
        orderId: eventKey,
        alreadyProcessed: result.alreadyProcessed,
      })

      return NextResponse.json({
        received: true,
        alreadyProcessed: result.alreadyProcessed,
      })
    }

    if (eventType === 'InvoiceExpired' || eventType === 'invoice_expired') {
      const result = await processWebhookOnce('coinsnap', `expired_${eventKey}`, payload, async () => {
        await handleDonationExpired(eventKey)
      })

      console.log('Coinsnap webhook processed (expired):', {
        orderId: eventKey,
        alreadyProcessed: result.alreadyProcessed,
      })

      return NextResponse.json({
        received: true,
        alreadyProcessed: result.alreadyProcessed,
      })
    }

    // Acknowledge other events without processing
    return NextResponse.json({ received: true, event: eventType })
  } catch (error) {
    console.error('Coinsnap webhook error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Disable body parsing since we need raw body for signature validation
export const config = {
  api: {
    bodyParser: false,
  },
}
