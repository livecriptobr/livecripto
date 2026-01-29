import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'

const logger = createLogger({ action: 'marathon-resume' })

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
    if (!timer.isPaused) return NextResponse.json({ error: 'Not paused' }, { status: 400 })

    const remainingSec = timer.remainingOnPause ?? 0
    const newEndsAt = new Date(Date.now() + remainingSec * 1000)

    const updated = await prisma.marathonTimer.update({
      where: { id: timer.id },
      data: {
        isPaused: false,
        endsAt: newEndsAt,
        pausedAt: null,
        remainingOnPause: null,
      },
    })

    logger.info('Marathon resumed', { widgetId })
    return NextResponse.json({ timer: updated })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    logger.error('Marathon resume error', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
