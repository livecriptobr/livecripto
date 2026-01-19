import { NextRequest, NextResponse } from 'next/server'
import { getPaymentStatus } from '@/lib/payments/mercadopago'
import { processWebhookOnce } from '@/lib/webhook-idempotency'
import { handleDonationPaid, handleDonationFailed, getDonationByProviderId, updateDonationProviderId } from '@/services/donation.service'
import { prisma } from '@/lib/db'

/**
 * MercadoPago Webhook Handler
 *
 * Receives payment notifications from MercadoPago for card/PIX payments.
 * Events handled:
 * - payment - Payment status update
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Log the event for debugging
    console.log('MercadoPago webhook received:', body.type, body.action)

    // MercadoPago sends different notification types
    const notificationType = body.type

    if (notificationType !== 'payment') {
      // Acknowledge other events without processing
      return NextResponse.json({ received: true, type: notificationType })
    }

    // Get payment ID from the notification
    const paymentId = body.data?.id
    if (!paymentId) {
      console.error('MercadoPago webhook: Missing payment ID')
      return NextResponse.json({ error: 'Missing payment ID' }, { status: 400 })
    }

    // Fetch payment details from MercadoPago API
    const paymentStatus = await getPaymentStatus(String(paymentId))

    console.log('MercadoPago payment status:', { paymentId, status: paymentStatus })

    // Find the donation by external reference or create association
    let donation = await getDonationByProviderId(String(paymentId))

    if (!donation) {
      // Try to find by external_reference (our donation ID) via API
      const response = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
          },
        }
      )

      if (response.ok) {
        const paymentData = await response.json()
        const donationId = paymentData.external_reference

        if (donationId) {
          // Update donation with provider payment ID
          await updateDonationProviderId(donationId, String(paymentId))
          donation = await prisma.donation.findUnique({ where: { id: donationId } })
        }
      }
    }

    if (!donation) {
      console.error('MercadoPago webhook: Donation not found for payment', paymentId)
      return NextResponse.json({ error: 'Donation not found' }, { status: 404 })
    }

    const eventKey = `${paymentId}_${paymentStatus}`

    // Handle different payment statuses
    if (paymentStatus === 'approved') {
      const result = await processWebhookOnce('mercadopago', eventKey, body, async () => {
        await handleDonationPaid(donation!.id)
      })

      console.log('MercadoPago webhook processed (approved):', {
        paymentId,
        donationId: donation.id,
        alreadyProcessed: result.alreadyProcessed,
      })

      return NextResponse.json({
        received: true,
        alreadyProcessed: result.alreadyProcessed,
      })
    }

    if (paymentStatus === 'rejected' || paymentStatus === 'cancelled') {
      const result = await processWebhookOnce('mercadopago', eventKey, body, async () => {
        await handleDonationFailed(donation!.id)
      })

      console.log('MercadoPago webhook processed (failed):', {
        paymentId,
        donationId: donation.id,
        status: paymentStatus,
        alreadyProcessed: result.alreadyProcessed,
      })

      return NextResponse.json({
        received: true,
        alreadyProcessed: result.alreadyProcessed,
      })
    }

    // For pending/in_process statuses, just acknowledge
    return NextResponse.json({
      received: true,
      status: paymentStatus,
    })
  } catch (error) {
    console.error('MercadoPago webhook error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
