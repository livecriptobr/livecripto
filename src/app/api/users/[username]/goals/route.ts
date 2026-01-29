import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface RouteContext {
  params: Promise<{ username: string }>
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { username } = await ctx.params

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const goals = await prisma.goal.findMany({
    where: {
      userId: user.id,
      isActive: true,
      showOnDonation: true,
    },
    orderBy: { createdAt: 'desc' },
    include: {
      rewards: {
        where: { isActive: true },
        orderBy: { thresholdCents: 'asc' },
      },
      _count: { select: { contributions: true } },
    },
  })

  return NextResponse.json({ goals })
}
