import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'

export async function GET() {
  const log = createLogger({ action: 'get-incentive-settings' })

  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const [settings, tiers] = await Promise.all([
      prisma.incentiveSettings.findUnique({
        where: { userId: user.id },
      }),
      prisma.alertTier.findMany({
        where: { userId: user.id },
        orderBy: { minAmountCents: 'asc' },
      }),
    ])

    return NextResponse.json({ settings, tiers })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    log.error('Failed to get incentive settings', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

interface TierInput {
  id?: string
  minAmountCents: number
  name: string
  color: string
  soundUrl?: string | null
  animationType: string
  duration: number
  ttsVoice?: string | null
  ttsSpeed: number
  isActive: boolean
}

interface SettingsInput {
  voiceMessagesEnabled?: boolean
  voiceMessageMaxSecs?: number
  mediaEnabled?: boolean
  mediaGifsOnly?: boolean
  ttsEnabled?: boolean
  ttsDefaultVoice?: string
  ttsDefaultSpeed?: number
  minAmountForVoice?: number
  minAmountForMedia?: number
  minAmountForTts?: number
}

interface PatchBody {
  settings?: SettingsInput
  tiers?: TierInput[]
}

export async function PATCH(req: NextRequest) {
  const log = createLogger({ action: 'update-incentive-settings' })

  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body: PatchBody = await req.json()

    // Update settings
    if (body.settings) {
      await prisma.incentiveSettings.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          ...body.settings,
        },
        update: body.settings,
      })
    }

    // Update tiers
    if (body.tiers) {
      // Get existing tier IDs
      const existingTiers = await prisma.alertTier.findMany({
        where: { userId: user.id },
        select: { id: true },
      })
      const existingIds = new Set(existingTiers.map((t) => t.id))
      const incomingIds = new Set(body.tiers.filter((t) => t.id).map((t) => t.id))

      // Delete removed tiers
      const toDelete = [...existingIds].filter((id) => !incomingIds.has(id))
      if (toDelete.length > 0) {
        await prisma.alertTier.deleteMany({
          where: { id: { in: toDelete } },
        })
      }

      // Upsert tiers
      for (const tier of body.tiers) {
        if (tier.id && existingIds.has(tier.id)) {
          await prisma.alertTier.update({
            where: { id: tier.id },
            data: {
              minAmountCents: tier.minAmountCents,
              name: tier.name,
              color: tier.color,
              soundUrl: tier.soundUrl,
              animationType: tier.animationType,
              duration: tier.duration,
              ttsVoice: tier.ttsVoice,
              ttsSpeed: tier.ttsSpeed,
              isActive: tier.isActive,
            },
          })
        } else {
          await prisma.alertTier.create({
            data: {
              userId: user.id,
              minAmountCents: tier.minAmountCents,
              name: tier.name,
              color: tier.color,
              soundUrl: tier.soundUrl,
              animationType: tier.animationType,
              duration: tier.duration,
              ttsVoice: tier.ttsVoice,
              ttsSpeed: tier.ttsSpeed,
              isActive: tier.isActive,
            },
          })
        }
      }
    }

    log.info('Incentive settings updated', { userId: user.id })
    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    log.error('Failed to update incentive settings', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
