import { NextRequest, NextResponse } from 'next/server'
import { validateOpenPixSignature } from '@/lib/payments/openpix'
import { processWebhookOnce } from '@/lib/webhook-idempotency'
import { handleDonationPaid } from '@/services/donation.service'

/**
 * OpenPix Webhook Handler
 *
 * Receives payment notifications from OpenPix for PIX payments.
 * Events handled:
 * - OPENPIX:CHARGE_COMPLETED - Payment received successfully
 * - OPENPIX:CHARGE_EXPIRED - Charge expired without payment
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('x-webhook-signature') || ''

    // Validate signature (skip in dev if no secret configured)
    if (process.env.OPENPIX_WEBHOOK_SECRET) {
      if (!validateOpenPixSignature(rawBody, signature)) {
        console.error('OpenPix webhook: Invalid signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const payload = JSON.parse(rawBody)

    // Log the event for debugging
    console.log('OpenPix webhook received:', payload.event)

    // Only process completed charges
    if (payload.event !== 'OPENPIX:CHARGE_COMPLETED') {
      // Acknowledge other events without processing
      return NextResponse.json({ received: true, event: payload.event })
    }

    // Extract correlation ID (our donation ID)
    const eventKey = payload.charge?.correlationID
    if (!eventKey) {
      console.error('OpenPix webhook: Missing correlationID')
      return NextResponse.json({ error: 'Missing correlationID' }, { status: 400 })
    }

    // Process the webhook idempotently
    const result = await processWebhookOnce('openpix', eventKey, payload, async () => {
      await handleDonationPaid(eventKey)
    })

    console.log('OpenPix webhook processed:', {
      correlationID: eventKey,
      alreadyProcessed: result.alreadyProcessed,
    })

    return NextResponse.json({
      received: true,
      alreadyProcessed: result.alreadyProcessed,
    })
  } catch (error) {
    console.error('OpenPix webhook error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Disable body parsing since we need raw body for signature validation
export const config = {
  api: {
    bodyParser: false,
  },
}
