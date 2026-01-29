import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'

export async function GET() {
  const log = createLogger({ action: 'get-moderation-settings' })

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

    const settings = await prisma.moderationSettings.findUnique({
      where: { userId: user.id },
    })

    return NextResponse.json({ settings })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    log.error('Failed to get moderation settings', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

interface ModerationSettingsInput {
  blockedWordsEnabled?: boolean
  blockedWords?: string[]
  blockedWordsRegex?: string[]
  useDefaultProfanityList?: boolean
  gptModerationEnabled?: boolean
  gptBlockHate?: boolean
  gptBlockSexual?: boolean
  gptBlockViolence?: boolean
  gptBlockSelfHarm?: boolean
  gptBlockThreatening?: boolean
  gptBlockHarassment?: boolean
  gptSensitivity?: number
  audioModerationEnabled?: boolean
  imageModerationEnabled?: boolean
  autoBlockRepeatOffenders?: boolean
  repeatOffenderThreshold?: number
}

export async function PATCH(req: NextRequest) {
  const log = createLogger({ action: 'update-moderation-settings' })

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

    const body: ModerationSettingsInput = await req.json()

    // Validate sensitivity range
    if (body.gptSensitivity !== undefined) {
      if (body.gptSensitivity < 0 || body.gptSensitivity > 1) {
        return NextResponse.json({ error: 'Sensitivity must be between 0 and 1' }, { status: 400 })
      }
    }

    // Validate regex patterns
    if (body.blockedWordsRegex) {
      for (const pattern of body.blockedWordsRegex) {
        try {
          new RegExp(pattern)
        } catch {
          return NextResponse.json({ error: `Regex invalido: ${pattern}` }, { status: 400 })
        }
      }
    }

    const settings = await prisma.moderationSettings.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        ...body,
      },
      update: body,
    })

    log.info('Moderation settings updated', { userId: user.id })
    return NextResponse.json({ settings })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    log.error('Failed to update moderation settings', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
