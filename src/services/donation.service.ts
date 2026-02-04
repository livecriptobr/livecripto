import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'
import { generateTTS, buildTTSText, applyBlacklist } from '@/lib/tts'
import { uploadToBunny } from '@/lib/bunny'
import { calculateFee, getPaymentMethodType } from '@/services/fees'
import { recordTransaction } from '@/services/wallet'

const logger = createLogger({ action: 'donation-service' })

interface AlertSettings {
  ttsEnabled?: boolean
  ttsTemplate?: string
  ttsVoice?: string
  blockedWords?: string[]
}

/**
 * Build TTS audio for an alert directly (no HTTP self-call).
 * Updates the alert status to READY when done.
 */
async function buildTTSForAlert(alertId: string) {
  const alert = await prisma.alert.findUnique({
    where: { id: alertId },
    include: {
      donation: true,
      user: { select: { id: true, alertSettings: true } },
    },
  })

  if (!alert || !alert.donation) return

  const settings = alert.user.alertSettings as AlertSettings | null

  if (!settings?.ttsEnabled) {
    await prisma.alert.update({
      where: { id: alertId },
      data: { status: 'READY', readyAt: new Date() },
    })
    return
  }

  try {
    let text = buildTTSText(
      settings.ttsTemplate || '{nome} doou {valor}. {mensagem}',
      alert.donation
    )
    text = applyBlacklist(text, settings.blockedWords || [])

    const audioBuffer = await generateTTS({
      text,
      voice: settings.ttsVoice || 'pt-BR-Standard-A',
    })

    const path = `tts/${alert.user.id}/${alert.id}.mp3`
    const audioUrl = await uploadToBunny({ path, content: audioBuffer })

    await prisma.alert.update({
      where: { id: alertId },
      data: { audioUrl, status: 'READY', readyAt: new Date() },
    })

    logger.info('TTS built successfully', { alertId, audioUrl })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error('TTS build failed', { alertId, error: msg })

    // Mark as READY without audio so the alert still shows
    await prisma.alert.update({
      where: { id: alertId },
      data: { status: 'READY', readyAt: new Date(), lastError: msg },
    })
  }
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

  // Build TTS audio (non-blocking, alert shows even if TTS fails)
  buildTTSForAlert(result.alert.id).catch((err) => {
    logger.error('TTS build trigger failed', { alertId: result.alert.id, error: String(err) })
  })

  const { donation } = result

  // Fee calculation + transaction recording
  try {
    const feeMethod = getPaymentMethodType(donation.paymentProvider)
    const fee = calculateFee(donation.amountCents, feeMethod)
    await recordTransaction({
      userId: donation.userId,
      type: 'donation_received',
      amountCents: fee.grossCents,
      feeCents: fee.feeCents,
      netCents: fee.netCents,
      description: `Doacao de ${donation.donorName}`,
      referenceId: donation.id,
      referenceType: 'donation',
      paymentMethod: feeMethod,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    logger.error('Failed to record transaction', { error: msg, donationId })
  }

  // Goal contribution
  if (donation.goalId) {
    try {
      await prisma.goalContribution.create({
        data: {
          goalId: donation.goalId,
          donationId: donation.id,
          donorName: donation.donorName,
          amountCents: donation.amountCents,
        },
      })

      const goal = await prisma.goal.update({
        where: { id: donation.goalId },
        data: { currentCents: { increment: donation.amountCents } },
        include: { rewards: { where: { isActive: true } } },
      })

      // Check reward thresholds
      for (const reward of goal.rewards) {
        if (donation.amountCents >= reward.thresholdCents) {
          if (reward.maxClaims === null || reward.claimedCount < reward.maxClaims) {
            await prisma.rewardClaim.create({
              data: {
                rewardId: reward.id,
                donationId: donation.id,
                donorName: donation.donorName,
              },
            })
            await prisma.goalReward.update({
              where: { id: reward.id },
              data: { claimedCount: { increment: 1 } },
            })
          }
        }
      }

      // Check if goal reached target
      if (goal.currentCents >= goal.targetCents) {
        await prisma.notification.create({
          data: {
            userId: donation.userId,
            type: 'goal_reached',
            title: 'Meta atingida!',
            body: `A meta "${goal.title}" foi atingida!`,
            metadata: { goalId: goal.id },
          },
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro'
      logger.error('Failed to process goal contribution', { error: msg, donationId })
    }
  }

  // Poll vote (if donation has a pollVoteOptionId)
  if (donation.pollVoteOptionId) {
    try {
      // Find which poll this option belongs to
      const pollOption = await prisma.pollOption.findUnique({
        where: { id: donation.pollVoteOptionId },
        include: { poll: true },
      })

      if (pollOption && pollOption.poll.status === 'ACTIVE' && (!pollOption.poll.expiresAt || new Date() <= pollOption.poll.expiresAt)) {
        const weight = pollOption.poll.voteType === 'WEIGHTED' ? donation.amountCents : 1

        await prisma.$transaction(async (tx) => {
          await tx.pollVote.create({
            data: {
              pollId: pollOption.pollId,
              optionId: donation.pollVoteOptionId!,
              donationId: donation.id,
              voterName: donation.donorName,
              weight,
            },
          })

          await tx.pollOption.update({
            where: { id: donation.pollVoteOptionId! },
            data: {
              voteCount: { increment: 1 },
              voteWeight: { increment: weight },
            },
          })

          await tx.poll.update({
            where: { id: pollOption.pollId },
            data: { totalVotes: { increment: 1 } },
          })
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro'
      logger.error('Failed to process poll vote', { error: msg, donationId })
    }
  }

  // Notification for streamer
  try {
    const amountFormatted = (donation.amountCents / 100).toFixed(2).replace('.', ',')
    await prisma.notification.create({
      data: {
        userId: donation.userId,
        type: 'donation',
        title: 'Nova doacao!',
        body: `Doacao de R$ ${amountFormatted} de ${donation.donorName}`,
        metadata: { donationId: donation.id },
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    logger.error('Failed to create notification', { error: msg, donationId })
  }

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
