import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'

const logger = createLogger({ action: 'widget-detail' })

async function getAuthUser() {
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) return null
  return prisma.user.findUnique({ where: { clerkUserId }, select: { id: true } })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ widgetId: string }> }
) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { widgetId } = await params
  const widget = await prisma.widget.findFirst({
    where: { id: widgetId, userId: user.id },
    include: { marathonTimer: true },
  })

  if (!widget) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ widget })
}

interface PatchBody {
  name?: string
  config?: Record<string, unknown>
  isActive?: boolean
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ widgetId: string }> }
) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { widgetId } = await params

  try {
    const body = (await req.json()) as PatchBody
    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = body.name.trim()
    if (body.config !== undefined) data.config = body.config
    if (body.isActive !== undefined) data.isActive = body.isActive

    const widget = await prisma.widget.updateMany({
      where: { id: widgetId, userId: user.id },
      data,
    })

    if (widget.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = await prisma.widget.findUnique({
      where: { id: widgetId },
      include: { marathonTimer: true },
    })

    logger.info('Widget updated', { widgetId })
    return NextResponse.json({ widget: updated })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    logger.error('Failed to update widget', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ widgetId: string }> }
) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { widgetId } = await params

  const result = await prisma.widget.deleteMany({
    where: { id: widgetId, userId: user.id },
  })

  if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  logger.info('Widget deleted', { widgetId })
  return NextResponse.json({ success: true })
}
