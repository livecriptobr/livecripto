import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'
import { randomBytes } from 'crypto'

const logger = createLogger({ action: 'rotate-all-tokens' })

export async function POST() {
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

  try {
    const widgets = await prisma.widget.findMany({
      where: { userId: user.id },
      select: { id: true },
    })

    const newTokens: Record<string, string> = {}

    for (const widget of widgets) {
      const newToken = randomBytes(16).toString('hex')
      await prisma.widget.update({
        where: { id: widget.id },
        data: { token: newToken },
      })
      newTokens[widget.id] = newToken
    }

    // Also rotate overlay token
    const newOverlayToken = randomBytes(32).toString('hex')
    await prisma.user.update({
      where: { id: user.id },
      data: {
        overlayToken: newOverlayToken,
        overlayTokenUpdatedAt: new Date(),
      },
    })

    logger.info('All tokens rotated', { userId: user.id, widgetCount: widgets.length })

    return NextResponse.json({
      success: true,
      overlayToken: newOverlayToken,
      widgetTokens: newTokens,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    logger.error('Failed to rotate tokens', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
