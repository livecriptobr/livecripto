import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const { userId: clerkId } = await auth()
  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { clerkUserId: clerkId } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [totalCredits, totalDebits, todayAgg, monthAgg, recentDonations] = await Promise.all([
    prisma.ledger.aggregate({
      where: { userId: user.id, type: 'CREDIT' },
      _sum: { amountCents: true },
    }),
    prisma.ledger.aggregate({
      where: { userId: user.id, type: 'DEBIT' },
      _sum: { amountCents: true },
    }),
    prisma.donation.aggregate({
      where: { userId: user.id, status: 'PAID', paidAt: { gte: startOfDay } },
      _sum: { amountCents: true },
      _count: true,
    }),
    prisma.donation.aggregate({
      where: { userId: user.id, status: 'PAID', paidAt: { gte: startOfMonth } },
      _sum: { amountCents: true },
      _count: true,
    }),
    prisma.donation.findMany({
      where: { userId: user.id, status: 'PAID' },
      orderBy: { paidAt: 'desc' },
      take: 10,
      select: { id: true, donorName: true, message: true, amountCents: true, createdAt: true },
    }),
  ])

  const totalReceived = totalCredits._sum.amountCents || 0
  const balance = totalReceived - (totalDebits._sum.amountCents || 0)

  return NextResponse.json({
    totalReceived,
    balance,
    todayTotal: todayAgg._sum.amountCents || 0,
    todayCount: todayAgg._count || 0,
    monthTotal: monthAgg._sum.amountCents || 0,
    monthCount: monthAgg._count || 0,
    recentDonations,
  })
}
