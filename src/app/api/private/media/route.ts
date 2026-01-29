import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'

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
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '24', 10)))
  const mediaType = searchParams.get('mediaType')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const where: Prisma.DonationWhereInput = {
    userId: user.id,
    status: 'PAID',
    mediaUrl: { not: null },
  }

  if (mediaType) {
    where.mediaType = mediaType
  }

  if (from || to) {
    where.createdAt = {}
    if (from) {
      (where.createdAt as Prisma.DateTimeFilter).gte = new Date(from)
    }
    if (to) {
      (where.createdAt as Prisma.DateTimeFilter).lte = new Date(to)
    }
  }

  const offset = (page - 1) * limit

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
        mediaUrl: true,
        mediaType: true,
        createdAt: true,
        paidAt: true,
      },
    }),
    prisma.donation.count({ where }),
  ])

  return NextResponse.json({
    donations,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  })
}
