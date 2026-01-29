import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'

const logger = createLogger({ action: 'reward-detail' })

interface RouteContext {
  params: Promise<{ goalId: string; rewardId: string }>
}

interface UpdateRewardBody {
  title?: string
  description?: string
  thresholdCents?: number
  type?: string
  downloadUrl?: string
  maxClaims?: number | null
  isActive?: boolean
  sortOrder?: number
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { goalId, rewardId } = await ctx.params
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

  const reward = await prisma.goalReward.findUnique({ where: { id: rewardId } })
  if (!reward || reward.goalId !== goalId) {
    return NextResponse.json({ error: 'Reward not found' }, { status: 404 })
  }

  try {
    const body = (await req.json()) as UpdateRewardBody
    const data: Record<string, unknown> = {}

    if (body.title !== undefined) data.title = body.title.trim()
    if (body.description !== undefined) data.description = body.description?.trim() || null
    if (body.thresholdCents !== undefined) data.thresholdCents = body.thresholdCents
    if (body.type !== undefined) data.type = body.type
    if (body.downloadUrl !== undefined) data.downloadUrl = body.downloadUrl || null
    if (body.maxClaims !== undefined) data.maxClaims = body.maxClaims
    if (body.isActive !== undefined) data.isActive = body.isActive
    if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder

    const updated = await prisma.goalReward.update({
      where: { id: rewardId },
      data,
    })

    logger.info('Reward updated', { rewardId, goalId })
    return NextResponse.json({ reward: updated })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    logger.error('Failed to update reward', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const { goalId, rewardId } = await ctx.params
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

  await prisma.goalReward.delete({ where: { id: rewardId } })
  logger.info('Reward deleted', { rewardId, goalId })
  return NextResponse.json({ ok: true })
}
