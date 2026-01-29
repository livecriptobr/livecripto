import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'

const logger = createLogger({ action: 'marathon-start' })

interface StartBody {
  baseMinutes?: number
  addMinutesPer?: number
  addThreshold?: number
  maxHours?: number
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ widgetId: string }> }
) {
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkUserId }, select: { id: true } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { widgetId } = await params

  try {
    const widget = await prisma.widget.findFirst({
      where: { id: widgetId, userId: user.id, type: 'marathon' },
    })
    if (!widget) return NextResponse.json({ error: 'Widget not found' }, { status: 404 })

    const body = (await req.json()) as StartBody
    const baseMinutes = body.baseMinutes ?? 60
    const addMinutesPer = body.addMinutesPer ?? 1
    const addThreshold = body.addThreshold ?? 500
    const maxHours = body.maxHours ?? 24

    const endsAt = new Date(Date.now() + baseMinutes * 60 * 1000)

    const timer = await prisma.marathonTimer.upsert({
      where: { widgetId },
      create: {
        widgetId,
        userId: user.id,
        endsAt,
        baseMinutes,
        addMinutesPer,
        addThreshold,
        maxHours,
        isPaused: false,
      },
      update: {
        endsAt,
        baseMinutes,
        addMinutesPer,
        addThreshold,
        maxHours,
        isPaused: false,
        pausedAt: null,
        remainingOnPause: null,
      },
    })

    logger.info('Marathon started', { widgetId, baseMinutes })
    return NextResponse.json({ timer })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    logger.error('Marathon start error', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
