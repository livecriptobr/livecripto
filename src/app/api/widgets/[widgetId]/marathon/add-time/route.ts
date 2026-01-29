import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'

const logger = createLogger({ action: 'marathon-add-time' })

interface AddTimeBody {
  minutes: number
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
    const body = (await req.json()) as AddTimeBody
    const minutes = body.minutes
    if (!minutes || minutes <= 0) {
      return NextResponse.json({ error: 'Minutes must be positive' }, { status: 400 })
    }

    const timer = await prisma.marathonTimer.findFirst({
      where: { widgetId, userId: user.id },
    })
    if (!timer) return NextResponse.json({ error: 'Timer not found' }, { status: 404 })

    const maxMs = timer.maxHours * 60 * 60 * 1000
    const addMs = minutes * 60 * 1000

    if (timer.isPaused) {
      const currentRemaining = (timer.remainingOnPause ?? 0) * 1000
      const newRemaining = Math.min(currentRemaining + addMs, maxMs)
      const updated = await prisma.marathonTimer.update({
        where: { id: timer.id },
        data: { remainingOnPause: Math.floor(newRemaining / 1000) },
      })
      return NextResponse.json({ timer: updated })
    }

    const currentRemaining = timer.endsAt.getTime() - Date.now()
    const newRemaining = Math.min(currentRemaining + addMs, maxMs)
    const newEndsAt = new Date(Date.now() + newRemaining)

    const updated = await prisma.marathonTimer.update({
      where: { id: timer.id },
      data: { endsAt: newEndsAt },
    })

    logger.info('Marathon time added', { widgetId, minutes })
    return NextResponse.json({ timer: updated })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    logger.error('Marathon add-time error', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
