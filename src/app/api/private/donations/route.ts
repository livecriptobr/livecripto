import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { DonationStatus, Prisma } from '@prisma/client'

const VALID_STATUSES: DonationStatus[] = ['CREATED', 'PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDED']

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

  const searchParams = req.nextUrl.searchParams
  const limit = parseInt(searchParams.get('limit') || '50', 10)
  const offset = parseInt(searchParams.get('offset') || '0', 10)
  const statusParam = searchParams.get('status')

  const where: Prisma.DonationWhereInput = { userId: user.id }

  if (statusParam && VALID_STATUSES.includes(statusParam as DonationStatus)) {
    where.status = statusParam as DonationStatus
  }

  const [donations, total] = await Promise.all([
    prisma.donation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        donorName: true,
        message: true,
        amountCents: true,
        currency: true,
        paymentProvider: true,
        status: true,
        createdAt: true,
        paidAt: true,
      },
    }),
    prisma.donation.count({ where }),
  ])

  return NextResponse.json({ donations, total })
}
