import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'

const logger = createLogger({ action: 'goal-detail' })

interface RouteContext {
  params: Promise<{ goalId: string }>
}

interface UpdateGoalBody {
  title?: string
  description?: string
  targetCents?: number
  imageUrl?: string
  deadline?: string | null
  isActive?: boolean
  showOnDonation?: boolean
  showOnOverlay?: boolean
  type?: string
  charityName?: string
  charityPercent?: number | null
}

// Public GET - no auth required
export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { goalId } = await ctx.params

  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
    include: {
      rewards: {
        where: { isActive: true },
        orderBy: { thresholdCents: 'asc' },
      },
      _count: { select: { contributions: true } },
      user: { select: { username: true, displayName: true } },
    },
  })

  if (!goal) {
    return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
  }

  return NextResponse.json({ goal })
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
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
    const body = (await req.json()) as UpdateGoalBody

    const data: Record<string, unknown> = {}
    if (body.title !== undefined) data.title = body.title.trim()
    if (body.description !== undefined) data.description = body.description?.trim() || null
    if (body.targetCents !== undefined) data.targetCents = body.targetCents
    if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl || null
    if (body.deadline !== undefined) data.deadline = body.deadline ? new Date(body.deadline) : null
    if (body.isActive !== undefined) data.isActive = body.isActive
    if (body.showOnDonation !== undefined) data.showOnDonation = body.showOnDonation
    if (body.showOnOverlay !== undefined) data.showOnOverlay = body.showOnOverlay
    if (body.type !== undefined) data.type = body.type
    if (body.charityName !== undefined) data.charityName = body.charityName?.trim() || null
    if (body.charityPercent !== undefined) data.charityPercent = body.charityPercent

    const updated = await prisma.goal.update({
      where: { id: goalId },
      data,
      include: {
        rewards: { orderBy: { thresholdCents: 'asc' } },
        _count: { select: { contributions: true } },
      },
    })

    logger.info('Goal updated', { goalId, userId: user.id })
    return NextResponse.json({ goal: updated })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    logger.error('Failed to update goal', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
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

  await prisma.goal.delete({ where: { id: goalId } })
  logger.info('Goal deleted', { goalId, userId: user.id })
  return NextResponse.json({ ok: true })
}
