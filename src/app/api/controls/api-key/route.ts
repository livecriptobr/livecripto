import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'

const logger = createLogger({ action: 'api-key' })

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
    const body = (await req.json().catch(() => ({}))) as { label?: string }
    const label = typeof body.label === 'string' && body.label.trim() ? body.label.trim() : 'StreamDeck'

    const rawKey = `lc_${randomBytes(32).toString('hex')}`
    const keyPrefix = rawKey.slice(0, 10)
    const keyHash = await bcrypt.hash(rawKey, 10)

    const apiKey = await prisma.apiKey.create({
      data: {
        userId: user.id,
        keyHash,
        keyPrefix,
        label,
      },
    })

    logger.info('API key created', { userId: user.id, keyId: apiKey.id })

    return NextResponse.json({
      id: apiKey.id,
      key: rawKey,
      label: apiKey.label,
      prefix: keyPrefix,
      createdAt: apiKey.createdAt,
    }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    logger.error('Failed to create API key', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET() {
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

  const keys = await prisma.apiKey.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      label: true,
      keyPrefix: true,
      lastUsed: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ keys })
}

export async function DELETE(req: NextRequest) {
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

  const { id } = (await req.json()) as { id: string }
  if (!id) {
    return NextResponse.json({ error: 'ID obrigatorio' }, { status: 400 })
  }

  const existing = await prisma.apiKey.findFirst({
    where: { id, userId: user.id },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Chave nao encontrada' }, { status: 404 })
  }

  await prisma.apiKey.delete({ where: { id } })
  logger.info('API key revoked', { userId: user.id, keyId: id })

  return NextResponse.json({ success: true })
}
