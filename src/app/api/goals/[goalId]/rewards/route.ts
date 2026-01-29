import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'

const logger = createLogger({ action: 'goal-rewards' })

interface RouteContext {
  params: Promise<{ goalId: string }>
}

interface CreateRewardBody {
  title: string
  description?: string
  thresholdCents: number
  type?: string
  downloadUrl?: string
  maxClaims?: number
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { goalId } = await ctx.params

  const rewards = await prisma.goalReward.findMany({
    where: { goalId },
    orderBy: { thresholdCents: 'asc' },
    include: {
      _count: { select: { claims: true } },
    },
  })

  return NextResponse.json({ rewards })
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { goalId } = await ctx.params
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

  const goal = await prisma.goal.findUnique({ where: { id: goalId } })
  if (!goal || goal.userId !== user.id) {
    return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
  }

  try {
    const body = (await req.json()) as CreateRewardBody

    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'Titulo obrigatorio' }, { status: 400 })
    }

    if (!body.thresholdCents || body.thresholdCents < 100) {
      return NextResponse.json({ error: 'Valor minimo R$ 1,00' }, { status: 400 })
    }

    const count = await prisma.goalReward.count({ where: { goalId } })

    const reward = await prisma.goalReward.create({
      data: {
        goalId,
        title: body.title.trim(),
        description: body.description?.trim() || null,
        thresholdCents: body.thresholdCents,
        type: body.type || 'mention',
        downloadUrl: body.downloadUrl || null,
        maxClaims: body.maxClaims ?? null,
        sortOrder: count,
      },
    })

    logger.info('Reward created', { rewardId: reward.id, goalId })
    return NextResponse.json({ reward }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    logger.error('Failed to create reward', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
