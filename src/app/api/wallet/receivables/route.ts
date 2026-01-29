import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'

const logger = createLogger({ action: 'wallet-receivables' })

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

  try {
    const status = req.nextUrl.searchParams.get('status')

    const where: { userId: string; status?: string } = { userId: user.id }
    if (status) {
      where.status = status
    }

    const receivables = await prisma.receivable.findMany({
      where,
      orderBy: { expectedDate: 'asc' },
    })

    const now = new Date()
    const endOfWeek = new Date(now)
    endOfWeek.setDate(now.getDate() + (7 - now.getDay()))
    endOfWeek.setHours(23, 59, 59, 999)

    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    let totalPending = 0
    let expectedThisWeek = 0
    let expectedThisMonth = 0

    for (const r of receivables) {
      if (r.status === 'pending') {
        totalPending += r.netCents
        if (r.expectedDate <= endOfWeek) {
          expectedThisWeek += r.netCents
        }
        if (r.expectedDate <= endOfMonth) {
          expectedThisMonth += r.netCents
        }
      }
    }

    logger.info('Receivables listed', { userId: user.id, count: receivables.length })

    return NextResponse.json({
      totalPending,
      expectedThisWeek,
      expectedThisMonth,
      receivables,
    })
  } catch (error) {
    logger.error('Error listing receivables', { error: String(error) })
    return NextResponse.json({ error: 'Erro ao listar recebíveis' }, { status: 500 })
  }
}
