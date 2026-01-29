import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'

const logger = createLogger({ action: 'widgets-crud' })

const VALID_TYPES = ['alerts', 'ranking', 'qrcode', 'recent', 'marathon', 'poll', 'video', 'music'] as const

interface CreateWidgetBody {
  type: string
  name: string
  config?: Record<string, unknown>
}

export async function GET() {
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

  const widgets = await prisma.widget.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: { marathonTimer: true },
  })

  return NextResponse.json({ widgets })
}

export async function POST(req: NextRequest) {
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
    const body = (await req.json()) as CreateWidgetBody
    const { type, name, config } = body

    if (!type || !VALID_TYPES.includes(type as typeof VALID_TYPES[number])) {
      return NextResponse.json({ error: 'Tipo de widget invalido' }, { status: 400 })
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Nome obrigatorio' }, { status: 400 })
    }

    const widget = await prisma.widget.create({
      data: {
        userId: user.id,
        type,
        name: name.trim(),
        config: config ?? JSON.parse('{}'),
      },
      include: { marathonTimer: true },
    })

    logger.info('Widget created', { widgetId: widget.id, type, userId: user.id })
    return NextResponse.json({ widget }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    logger.error('Failed to create widget', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
