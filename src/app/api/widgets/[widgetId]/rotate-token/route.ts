import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'

const logger = createLogger({ action: 'widget-rotate-token' })

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
    // Generate a new cuid-like token using crypto
    const newToken = crypto.randomUUID().replace(/-/g, '').slice(0, 25)

    const result = await prisma.widget.updateMany({
      where: { id: widgetId, userId: user.id },
      data: { token: newToken },
    })

    if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    logger.info('Widget token rotated', { widgetId })
    return NextResponse.json({ token: newToken })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    logger.error('Failed to rotate token', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
