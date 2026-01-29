import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'
import { VALID_SECTIONS, VALID_ACTIONS, ControlSection, ControlAction } from '@/lib/control-commands'
import { broadcastToUser } from '@/lib/control-broadcast'
import bcrypt from 'bcryptjs'

const logger = createLogger({ action: 'control-webhook' })

interface WebhookBody {
  section: string
  action: string
}

export async function POST(req: NextRequest) {
  const apiKeyHeader = req.headers.get('x-api-key')
  if (!apiKeyHeader) {
    return NextResponse.json({ error: 'API key required' }, { status: 401 })
  }

  const prefix = apiKeyHeader.slice(0, 10)

  const candidates = await prisma.apiKey.findMany({
    where: { keyPrefix: prefix },
    include: { user: { select: { id: true } } },
  })

  if (candidates.length === 0) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
  }

  let matchedKey: typeof candidates[0] | null = null
  for (const candidate of candidates) {
    const valid = await bcrypt.compare(apiKeyHeader, candidate.keyHash)
    if (valid) {
      matchedKey = candidate
      break
    }
  }

  if (!matchedKey) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
  }

  try {
    const body = (await req.json()) as WebhookBody
    const { section, action } = body

    if (!section || !VALID_SECTIONS.includes(section as ControlSection)) {
      return NextResponse.json({ error: 'Invalid section' }, { status: 400 })
    }

    if (!action || !VALID_ACTIONS.includes(action as ControlAction)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    broadcastToUser(matchedKey.user.id, {
      section: section as ControlSection,
      action: action as ControlAction,
      timestamp: Date.now(),
    })

    // Update lastUsed non-blocking
    prisma.apiKey.update({
      where: { id: matchedKey.id },
      data: { lastUsed: new Date() },
    }).catch(() => {/* ignore */})

    logger.info('Webhook command sent', { userId: matchedKey.user.id, section, action })
    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    logger.error('Webhook command failed', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
