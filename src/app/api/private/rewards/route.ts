import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'

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

  const goals = await prisma.goal.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      title: true,
      rewards: {
        select: {
          id: true,
          title: true,
          description: true,
          thresholdCents: true,
          type: true,
          claimedCount: true,
          maxClaims: true,
          isActive: true,
          sortOrder: true,
          claims: {
            select: {
              id: true,
              donorName: true,
              donorEmail: true,
              status: true,
              claimedAt: true,
            },
            orderBy: { claimedAt: 'desc' },
          },
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
  })

  // Flatten rewards with goal info
  const rewards = goals.flatMap(goal =>
    goal.rewards.map(reward => ({
      ...reward,
      goalId: goal.id,
      goalTitle: goal.title,
    }))
  )

  // Compute summary
  const totalActive = rewards.filter(r => r.isActive).length
  const totalPendingClaims = rewards.reduce(
    (sum, r) => sum + r.claims.filter(c => c.status === 'pending').length,
    0
  )
  const totalDeliveredClaims = rewards.reduce(
    (sum, r) => sum + r.claims.filter(c => c.status === 'delivered').length,
    0
  )

  return NextResponse.json({
    rewards,
    summary: {
      totalActive,
      totalPendingClaims,
      totalDeliveredClaims,
    },
  })
}

export async function PATCH(req: NextRequest) {
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

  const body = await req.json() as {
    claimId?: string
    claimStatus?: string
    rewardId?: string
    isActive?: boolean
  }

  // Update claim status
  if (body.claimId && body.claimStatus) {
    const claim = await prisma.rewardClaim.findUnique({
      where: { id: body.claimId },
      include: { reward: { include: { goal: true } } },
    })

    if (!claim || claim.reward.goal.userId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const updated = await prisma.rewardClaim.update({
      where: { id: body.claimId },
      data: { status: body.claimStatus },
    })

    return NextResponse.json({ claim: updated })
  }

  // Toggle reward active
  if (body.rewardId !== undefined && body.isActive !== undefined) {
    const reward = await prisma.goalReward.findUnique({
      where: { id: body.rewardId },
      include: { goal: true },
    })

    if (!reward || reward.goal.userId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const updated = await prisma.goalReward.update({
      where: { id: body.rewardId },
      data: { isActive: body.isActive },
    })

    return NextResponse.json({ reward: updated })
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
}
