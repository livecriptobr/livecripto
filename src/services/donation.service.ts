import { prisma } from '@/lib/db'

/**
 * Trigger TTS build for an alert (non-blocking).
 * Calls the internal TTS build API to generate audio.
 */
async function triggerTTSBuild(alertId: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  await fetch(`${appUrl}/api/internal/tts/build`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.INTERNAL_API_SECRET}`,
    },
    body: JSON.stringify({ alertId }),
  })
}

/**
 * Handle a donation that has been successfully paid.
 * This function:
 * 1. Updates the donation status to PAID
 * 2. Creates a ledger entry for the user's balance
 * 3. Creates an alert to be displayed on the streamer's overlay
 * 4. Triggers TTS audio generation (non-blocking)
 *
 * All database operations are performed in a transaction to ensure consistency.
 */
export async function handleDonationPaid(donationId: string) {
  const result = await prisma.$transaction(async (tx) => {
    // Update donation status
    const donation = await tx.donation.update({
      where: { id: donationId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
    })

    // Create ledger entry (credit user's balance)
    await tx.ledger.create({
      data: {
        userId: donation.userId,
        type: 'CREDIT',
        source: 'DONATION',
        amountCents: donation.amountCents,
        referenceId: donation.id,
      },
    })

    // Create alert to be queued for display
    const alert = await tx.alert.create({
      data: {
        userId: donation.userId,
        donationId: donation.id,
        status: 'QUEUED',
      },
    })

    return { donation, alert }
  })

  // Trigger TTS build (non-blocking)
  triggerTTSBuild(result.alert.id).catch(console.error)

  return result
}

/**
 * Handle a donation that has failed or been canceled.
 */
export async function handleDonationFailed(donationId: string) {
  return prisma.donation.update({
    where: { id: donationId },
    data: { status: 'FAILED' },
  })
}

/**
 * Handle a donation that has expired.
 */
export async function handleDonationExpired(donationId: string) {
  return prisma.donation.update({
    where: { id: donationId },
    data: { status: 'EXPIRED' },
  })
}

/**
 * Update donation with provider payment ID.
 */
export async function updateDonationProviderId(
  donationId: string,
  providerPaymentId: string
) {
  return prisma.donation.update({
    where: { id: donationId },
    data: {
      providerPaymentId,
      status: 'PENDING',
    },
  })
}

/**
 * Get donation by provider payment ID.
 */
export async function getDonationByProviderId(providerPaymentId: string) {
  return prisma.donation.findFirst({
    where: { providerPaymentId },
  })
}

/**
 * Get donation by ID with user info.
 */
export async function getDonationWithUser(donationId: string) {
  return prisma.donation.findUnique({
    where: { id: donationId },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
        },
      },
    },
  })
}

/**
 * Get pending donations older than a threshold (for cleanup/expiration).
 */
export async function getPendingDonationsOlderThan(minutes: number) {
  const threshold = new Date(Date.now() - minutes * 60 * 1000)
  return prisma.donation.findMany({
    where: {
      status: 'CREATED',
      createdAt: { lt: threshold },
    },
  })
}
