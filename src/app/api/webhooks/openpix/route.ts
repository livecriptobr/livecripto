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

// GET handler for webhook verification (OpenPix pings this to check the endpoint)
export async function GET() {
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()

    // Handle empty body (OpenPix test/ping request)
    if (!rawBody || rawBody.trim() === '') {
      return NextResponse.json({ received: true, test: true })
    }

    const signature = req.headers.get('x-webhook-signature') || ''

    // Validate signature (skip if no secret configured)
    if (process.env.OPENPIX_WEBHOOK_SECRET) {
      if (!validateOpenPixSignature(rawBody, signature)) {
        console.error('OpenPix webhook: Invalid signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const payload = JSON.parse(rawBody)

    // Log the event for debugging
    console.log('OpenPix webhook received:', payload.event)

    // Handle test event (OpenPix sends evento: "teste_webhook" or missing charge data)
    if (payload.evento === 'teste_webhook' || payload.event === 'OPENPIX:WEBHOOK_TEST' || !payload.event) {
      return NextResponse.json({ received: true, test: true })
    }

    // Only process completed charges
    if (payload.event !== 'OPENPIX:CHARGE_COMPLETED') {
      return NextResponse.json({ received: true, event: payload.event })
    }

    // Extract correlation ID (our donation ID) — if missing, it's a test ping
    const eventKey = payload.charge?.correlationID
    if (!eventKey) {
      return NextResponse.json({ received: true, test: true })
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
