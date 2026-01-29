import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'

const logger = createLogger({ action: 'claim-update' })

interface RouteContext {
  params: Promise<{ goalId: string; rewardId: string; claimId: string }>
}

interface UpdateClaimBody {
  status: string
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { goalId, claimId } = await ctx.params
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
    const body = (await req.json()) as UpdateClaimBody
    const validStatuses = ['pending', 'delivered', 'rejected']
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ error: 'Status invalido' }, { status: 400 })
    }

    const claim = await prisma.rewardClaim.update({
      where: { id: claimId },
      data: { status: body.status },
    })

    logger.info('Claim updated', { claimId, status: body.status })
    return NextResponse.json({ claim })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    logger.error('Failed to update claim', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
