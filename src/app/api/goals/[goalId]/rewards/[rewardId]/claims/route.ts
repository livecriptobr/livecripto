import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'

interface RouteContext {
  params: Promise<{ goalId: string; rewardId: string }>
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
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

  const claims = await prisma.rewardClaim.findMany({
    where: { rewardId },
    orderBy: { claimedAt: 'desc' },
  })

  return NextResponse.json({ claims })
}
