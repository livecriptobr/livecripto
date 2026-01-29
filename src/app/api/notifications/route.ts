import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { clerkUserId: clerkId } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const url = request.nextUrl
  const unreadOnly = url.searchParams.get('unread') === 'true'
  const limit = parseInt(url.searchParams.get('limit') || '20', 10)

  const where: { userId: string; isRead?: boolean } = { userId: user.id }
  if (unreadOnly) where.isRead = false

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 50),
    }),
    prisma.notification.count({
      where: { userId: user.id, isRead: false },
    }),
  ])

  return NextResponse.json({ notifications, unreadCount })
}
