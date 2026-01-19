import { prisma } from '@/lib/db'
import { normalizeUsername, generateRandomSuffix, generateOverlayToken } from '@/lib/username'

export const userService = {
  async getOrCreateUser(clerkUserId: string, email: string, name?: string) {
    // Check if exists
    const existing = await prisma.user.findUnique({
      where: { clerkUserId }
    })
    if (existing) return existing

    // Generate unique username
    const baseUsername = normalizeUsername(email.split('@')[0] || name || 'user')
    let username = baseUsername
    let attempts = 0

    while (attempts < 5) {
      const exists = await prisma.user.findUnique({ where: { username } })
      if (!exists) break
      username = `${baseUsername}-${generateRandomSuffix()}`
      attempts++
    }

    // Create user
    return prisma.user.create({
      data: {
        clerkUserId,
        email,
        username,
        displayName: name || username,
        overlayToken: generateOverlayToken(),
        alertSettings: {
          minAmountCents: 100,
          ttsEnabled: true,
          ttsVoice: 'pt-BR-Standard-A',
          ttsTemplate: '{nome} doou {valor}. {mensagem}',
          durationMs: 8000,
          blockedWords: [],
        },
      },
    })
  },

  async getUserByClerkId(clerkUserId: string) {
    return prisma.user.findUnique({ where: { clerkUserId } })
  },

  async getUserByUsername(username: string) {
    return prisma.user.findUnique({ where: { username } })
  },

  async updateUsername(userId: string, newUsername: string) {
    const normalized = normalizeUsername(newUsername)
    const exists = await prisma.user.findFirst({
      where: { username: normalized, NOT: { id: userId } }
    })
    if (exists) throw new Error('Username já em uso')

    return prisma.user.update({
      where: { id: userId },
      data: { username: normalized }
    })
  },

  async rotateOverlayToken(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        overlayToken: generateOverlayToken(),
        overlayTokenUpdatedAt: new Date(),
      },
    })
  },

  async updatePayoutSettings(userId: string, pixKey?: string, lightningAddress?: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { pixKey, lightningAddress },
    })
  },

  async updateAlertSettings(userId: string, settings: Record<string, any>) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    const current = (user?.alertSettings as Record<string, any>) || {}

    return prisma.user.update({
      where: { id: userId },
      data: { alertSettings: { ...current, ...settings } },
    })
  },
}
