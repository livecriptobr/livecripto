import { prisma } from '@/lib/db'
import crypto from 'crypto'

export interface WebhookProcessResult {
  alreadyProcessed: boolean
}

/**
 * Process a webhook exactly once using idempotency keys.
 * Uses the WebhookEvent table to track processed events.
 *
 * @param provider - The payment provider name (openpix, coinsnap, mercadopago)
 * @param eventKey - A unique key for this event (e.g., correlationID, invoiceId)
 * @param payload - The webhook payload (used for hash verification)
 * @param handler - The async function to execute for processing
 * @returns Object indicating if the event was already processed
 */
export async function processWebhookOnce(
  provider: string,
  eventKey: string,
  payload: unknown,
  handler: () => Promise<void>
): Promise<WebhookProcessResult> {
  const payloadHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex')

  const id = `${provider}_${eventKey}`

  // Try to create the event record (will fail if already exists due to unique constraint)
  try {
    await prisma.webhookEvent.create({
      data: {
        id,
        provider,
        eventKey,
        payloadHash,
        status: 'PROCESSING',
      },
    })
  } catch (error: unknown) {
    // Check for unique constraint violation (Prisma error code P2002)
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return { alreadyProcessed: true }
    }
    throw error
  }

  // Execute the handler and update the event status
  try {
    await handler()
    await prisma.webhookEvent.update({
      where: { id },
      data: {
        status: 'PROCESSED',
        processedAt: new Date(),
      },
    })
    return { alreadyProcessed: false }
  } catch (error) {
    await prisma.webhookEvent.update({
      where: { id },
      data: {
        status: 'FAILED',
        error: String(error),
      },
    })
    throw error
  }
}

/**
 * Check if a webhook event has already been processed.
 */
export async function isWebhookProcessed(
  provider: string,
  eventKey: string
): Promise<boolean> {
  const id = `${provider}_${eventKey}`
  const event = await prisma.webhookEvent.findUnique({
    where: { id },
    select: { status: true },
  })
  return event?.status === 'PROCESSED'
}

/**
 * Mark a webhook event as failed manually (for error recovery).
 */
export async function markWebhookFailed(
  provider: string,
  eventKey: string,
  error: string
): Promise<void> {
  const id = `${provider}_${eventKey}`
  await prisma.webhookEvent.update({
    where: { id },
    data: {
      status: 'FAILED',
      error,
    },
  })
}
