import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'
import { PollStatus } from '@prisma/client'

const logger = createLogger({ action: 'polls-crud' })

const VALID_STATUSES: PollStatus[] = ['ACTIVE', 'PAUSED', 'CLOSED']

export async function GET(req: NextRequest) {
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

  const statusParam = req.nextUrl.searchParams.get('status')
  const where: { userId: string; status?: PollStatus } = { userId: user.id }

  if (statusParam && VALID_STATUSES.includes(statusParam as PollStatus)) {
    where.status = statusParam as PollStatus
  }

  const polls = await prisma.poll.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      options: {
        orderBy: { sortOrder: 'asc' },
      },
    },
  })

  return NextResponse.json({ polls })
}

interface CreateOptionInput {
  text: string
  color?: string
}

interface CreatePollBody {
  title: string
  voteType: 'UNIQUE' | 'WEIGHTED'
  expiresAt?: string
  options: CreateOptionInput[]
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
    const body = (await req.json()) as CreatePollBody
    const { title, voteType, expiresAt, options } = body

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Titulo obrigatorio' }, { status: 400 })
    }

    if (!options || options.length < 2 || options.length > 10) {
      return NextResponse.json({ error: 'Entre 2 e 10 opcoes obrigatorias' }, { status: 400 })
    }

    if (voteType !== 'UNIQUE' && voteType !== 'WEIGHTED') {
      return NextResponse.json({ error: 'voteType invalido' }, { status: 400 })
    }

    const poll = await prisma.poll.create({
      data: {
        userId: user.id,
        title: title.trim(),
        voteType,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        options: {
          create: options.map((opt, i) => ({
            text: opt.text.trim(),
            color: opt.color || '#8B5CF6',
            sortOrder: i,
          })),
        },
      },
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
      },
    })

    logger.info('Poll created', { pollId: poll.id, userId: user.id })
    return NextResponse.json({ poll }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    logger.error('Failed to create poll', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
