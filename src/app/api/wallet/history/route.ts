import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'
import { walletService } from '@/services/wallet'

const logger = createLogger({ action: 'wallet-history' })

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

  const { searchParams } = req.nextUrl
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
  const type = searchParams.get('type') || undefined
  const method = searchParams.get('method') || undefined
  const from = searchParams.get('from') || undefined
  const to = searchParams.get('to') || undefined

  const where: Record<string, unknown> = { userId: user.id, status: 'completed' }
  if (type) where.type = type
  if (method) where.paymentMethod = method
  if (from || to) {
    const createdAt: Record<string, Date> = {}
    if (from) createdAt.gte = new Date(from)
    if (to) createdAt.lte = new Date(to)
    where.createdAt = createdAt
  }

  try {
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ])

    // Summary aggregates
    const [receivedAgg, feesAgg, withdrawnAgg, currentBalance] = await Promise.all([
      prisma.transaction.aggregate({
        where: { userId: user.id, type: 'donation_received', status: 'completed' },
        _sum: { netCents: true },
      }),
      prisma.transaction.aggregate({
        where: { userId: user.id, type: 'donation_received', status: 'completed' },
        _sum: { feeCents: true },
      }),
      prisma.transaction.aggregate({
        where: { userId: user.id, type: 'withdrawal', status: 'completed' },
        _sum: { amountCents: true },
      }),
      walletService.getBalance(user.id),
    ])

    const summary = {
      totalReceived: receivedAgg._sum.netCents ?? 0,
      totalFees: feesAgg._sum.feeCents ?? 0,
      totalWithdrawn: withdrawnAgg._sum.amountCents ?? 0,
      currentBalance,
    }

    logger.info('Wallet history fetched', { userId: user.id, page: String(page), total: String(total) })

    return NextResponse.json({
      transactions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary,
    })
  } catch (error) {
    logger.error('Error fetching wallet history', { error: String(error) })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
