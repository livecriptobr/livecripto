import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'
import { PollStatus } from '@prisma/client'

const logger = createLogger({ action: 'poll-detail' })

interface RouteContext {
  params: Promise<{ pollId: string }>
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { pollId } = await ctx.params

  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: {
      options: { orderBy: { sortOrder: 'asc' } },
    },
  })

  if (!poll) {
    return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
  }

  return NextResponse.json({ poll })
}

interface PatchBody {
  title?: string
  status?: PollStatus
  expiresAt?: string | null
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { pollId } = await ctx.params
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

  const poll = await prisma.poll.findUnique({ where: { id: pollId } })
  if (!poll || poll.userId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const body = (await req.json()) as PatchBody
    const data: { title?: string; status?: PollStatus; expiresAt?: Date | null } = {}

    if (body.title) data.title = body.title.trim()
    if (body.status && ['ACTIVE', 'PAUSED', 'CLOSED'].includes(body.status)) {
      data.status = body.status
    }
    if (body.expiresAt !== undefined) {
      data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null
    }

    const updated = await prisma.poll.update({
      where: { id: pollId },
      data,
      include: { options: { orderBy: { sortOrder: 'asc' } } },
    })

    logger.info('Poll updated', { pollId })
    return NextResponse.json({ poll: updated })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    logger.error('Failed to update poll', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const { pollId } = await ctx.params
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

  const poll = await prisma.poll.findUnique({ where: { id: pollId } })
  if (!poll || poll.userId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.poll.delete({ where: { id: pollId } })

  logger.info('Poll deleted', { pollId })
  return NextResponse.json({ success: true })
}
