import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'

const logger = createLogger({ action: 'goals-crud' })

interface CreateGoalBody {
  title: string
  description?: string
  targetCents: number
  imageUrl?: string
  deadline?: string
  showOnDonation?: boolean
  showOnOverlay?: boolean
  type?: string
  charityName?: string
  charityPercent?: number
}

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

  const activeParam = req.nextUrl.searchParams.get('active')
  const typeParam = req.nextUrl.searchParams.get('type')

  const where: Record<string, unknown> = { userId: user.id }
  if (activeParam === 'true') where.isActive = true
  if (activeParam === 'false') where.isActive = false
  if (typeParam) where.type = typeParam

  const goals = await prisma.goal.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      rewards: { orderBy: { thresholdCents: 'asc' } },
      _count: { select: { contributions: true } },
    },
  })

  return NextResponse.json({ goals })
}

export async function POST(req: NextRequest) {
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
    const body = (await req.json()) as CreateGoalBody
    const { title, description, targetCents, imageUrl, deadline, showOnDonation, showOnOverlay, type, charityName, charityPercent } = body

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Titulo obrigatorio' }, { status: 400 })
    }

    if (!targetCents || targetCents < 100) {
      return NextResponse.json({ error: 'Meta minima de R$ 1,00' }, { status: 400 })
    }

    if (type === 'charity' && !charityName?.trim()) {
      return NextResponse.json({ error: 'Nome da instituicao obrigatorio para acoes solidarias' }, { status: 400 })
    }

    const goal = await prisma.goal.create({
      data: {
        userId: user.id,
        title: title.trim(),
        description: description?.trim() || null,
        targetCents,
        imageUrl: imageUrl || null,
        deadline: deadline ? new Date(deadline) : null,
        showOnDonation: showOnDonation ?? true,
        showOnOverlay: showOnOverlay ?? true,
        type: type || 'personal',
        charityName: charityName?.trim() || null,
        charityPercent: charityPercent ?? null,
      },
      include: {
        rewards: true,
        _count: { select: { contributions: true } },
      },
    })

    logger.info('Goal created', { goalId: goal.id, userId: user.id, type: goal.type })
    return NextResponse.json({ goal }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    logger.error('Failed to create goal', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
