import { prisma } from '@/lib/db'
import { Alert } from '@prisma/client'

export const alertService = {
  async getNextReadyAlert(userId: string) {
    const now = new Date()
    const lockDuration = 60 * 1000 // 60 seconds

    // Use raw query for atomic lock
    // Only pick up READY alerts (not QUEUED — TTS is still building)
    const alerts = await prisma.$queryRaw<Alert[]>`
      UPDATE "Alert"
      SET
        status = 'LOCKED',
        "lockExpiresAt" = ${new Date(now.getTime() + lockDuration)}
      WHERE id = (
        SELECT id FROM "Alert"
        WHERE "userId" = ${userId}
          AND (
            status = 'READY'
            OR (status = 'LOCKED' AND "lockExpiresAt" < ${now})
          )
        ORDER BY "createdAt" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `

    return alerts[0] || null
  },

  async acknowledgeAlert(alertId: string) {
    return prisma.alert.update({
      where: { id: alertId },
      data: { status: 'DONE', consumedAt: new Date() },
    })
  },

  async skipAlert(alertId: string) {
    return prisma.alert.update({
      where: { id: alertId },
      data: { status: 'SKIPPED', consumedAt: new Date() },
    })
  },

  async getLastDoneAlert(userId: string) {
    return prisma.alert.findFirst({
      where: { userId, status: 'DONE' },
      orderBy: { consumedAt: 'desc' },
      include: { donation: true },
    })
  },

  async replayLastAlert(userId: string) {
    const last = await this.getLastDoneAlert(userId)
    if (!last) return null

    return prisma.alert.create({
      data: {
        userId,
        donationId: last.donationId,
        status: last.audioUrl ? 'READY' : 'QUEUED',
        audioUrl: last.audioUrl,
        readyAt: last.audioUrl ? new Date() : null,
      },
    })
  },

  async replayDonation(userId: string, donationId: string) {
    const existing = await prisma.alert.findFirst({
      where: { userId, donationId, status: 'DONE' },
      orderBy: { consumedAt: 'desc' },
    })

    return prisma.alert.create({
      data: {
        userId,
        donationId,
        status: existing?.audioUrl ? 'READY' : 'QUEUED',
        audioUrl: existing?.audioUrl || null,
        readyAt: existing?.audioUrl ? new Date() : null,
      },
    })
  },

  async unlockExpiredAlerts() {
    const now = new Date()
    return prisma.alert.updateMany({
      where: {
        status: 'LOCKED',
        lockExpiresAt: { lt: now },
      },
      data: { status: 'READY' },
    })
  },

  async getCurrentLockedAlert(userId: string) {
    return prisma.alert.findFirst({
      where: {
        userId,
        status: 'LOCKED',
      },
      orderBy: { createdAt: 'asc' },
    })
  },
}
