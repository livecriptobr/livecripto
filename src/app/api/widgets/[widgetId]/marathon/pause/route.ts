import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'

const logger = createLogger({ action: 'marathon-pause' })

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ widgetId: string }> }
) {
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkUserId }, select: { id: true } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { widgetId } = await params

  try {
    const timer = await prisma.marathonTimer.findFirst({
      where: { widgetId, userId: user.id },
    })
    if (!timer) return NextResponse.json({ error: 'Timer not found' }, { status: 404 })
    if (timer.isPaused) return NextResponse.json({ error: 'Already paused' }, { status: 400 })

    const remaining = Math.max(0, timer.endsAt.getTime() - Date.now())

    const updated = await prisma.marathonTimer.update({
      where: { id: timer.id },
      data: {
        isPaused: true,
        pausedAt: new Date(),
        remainingOnPause: Math.floor(remaining / 1000),
      },
    })

    logger.info('Marathon paused', { widgetId, remaining })
    return NextResponse.json({ timer: updated })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    logger.error('Marathon pause error', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
