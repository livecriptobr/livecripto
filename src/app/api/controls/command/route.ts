import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'
import { VALID_SECTIONS, VALID_ACTIONS, ControlSection, ControlAction } from '@/lib/control-commands'
import { broadcastToUser } from '@/lib/control-broadcast'

const logger = createLogger({ action: 'control-command' })

interface CommandBody {
  section: string
  action: string
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
    const body = (await req.json()) as CommandBody
    const { section, action } = body

    if (!section || !VALID_SECTIONS.includes(section as ControlSection)) {
      return NextResponse.json({ error: 'Secao invalida' }, { status: 400 })
    }

    if (!action || !VALID_ACTIONS.includes(action as ControlAction)) {
      return NextResponse.json({ error: 'Acao invalida' }, { status: 400 })
    }

    broadcastToUser(user.id, {
      section: section as ControlSection,
      action: action as ControlAction,
      timestamp: Date.now(),
    })

    logger.info('Control command sent', { userId: user.id, section, action })
    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    logger.error('Failed to send control command', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
