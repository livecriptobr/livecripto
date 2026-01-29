import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'

export async function GET() {
  const log = createLogger({ action: 'list-blocked-donors' })

  try {
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

    const blockedDonors = await prisma.blockedDonor.findMany({
      where: { userId: user.id },
      orderBy: { blockedAt: 'desc' },
    })

    return NextResponse.json({ blockedDonors })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    log.error('Failed to list blocked donors', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

interface BlockDonorInput {
  donorIpHash: string
  donorName?: string
  reason?: string
}

export async function POST(req: NextRequest) {
  const log = createLogger({ action: 'block-donor' })

  try {
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

    const body: BlockDonorInput = await req.json()

    if (!body.donorIpHash) {
      return NextResponse.json({ error: 'donorIpHash is required' }, { status: 400 })
    }

    const blocked = await prisma.blockedDonor.upsert({
      where: {
        userId_donorIpHash: {
          userId: user.id,
          donorIpHash: body.donorIpHash,
        },
      },
      create: {
        userId: user.id,
        donorIpHash: body.donorIpHash,
        donorName: body.donorName ?? null,
        reason: body.reason ?? null,
      },
      update: {
        donorName: body.donorName ?? undefined,
        reason: body.reason ?? undefined,
      },
    })

    log.info('Donor blocked', { userId: user.id, donorIpHash: body.donorIpHash })
    return NextResponse.json({ blocked })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    log.error('Failed to block donor', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const log = createLogger({ action: 'unblock-donor' })

  try {
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

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    await prisma.blockedDonor.deleteMany({
      where: { id, userId: user.id },
    })

    log.info('Donor unblocked', { userId: user.id, blockedDonorId: id })
    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    log.error('Failed to unblock donor', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
