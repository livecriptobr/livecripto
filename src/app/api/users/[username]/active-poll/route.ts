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

  const poll = await prisma.poll.findFirst({
    where: {
      userId: user.id,
      status: 'ACTIVE',
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    include: {
      options: { orderBy: { sortOrder: 'asc' } },
    },
  })

  return NextResponse.json({ poll })
}
