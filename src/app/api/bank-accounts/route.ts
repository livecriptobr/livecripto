import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'
import { z } from 'zod/v4'

const logger = createLogger({ action: 'bank-accounts' })

const createBankAccountSchema = z.object({
  pixKeyType: z.enum(['cpf', 'cnpj', 'email', 'phone', 'random']),
  pixKey: z.string().min(1).max(255),
  label: z.string().max(100).optional(),
  isDefault: z.boolean().optional(),
})

function validatePixKey(type: string, key: string): boolean {
  switch (type) {
    case 'cpf':
      return /^\d{11}$/.test(key.replace(/\D/g, ''))
    case 'cnpj':
      return /^\d{14}$/.test(key.replace(/\D/g, ''))
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key)
    case 'phone':
      return /^\+?\d{10,13}$/.test(key.replace(/\D/g, ''))
    case 'random':
      return /^[a-f0-9-]{32,36}$/i.test(key)
    default:
      return false
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

  const accounts = await prisma.bankAccount.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ accounts })
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

  const body = await req.json()
  const parsed = createBankAccountSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados invalidos', details: parsed.error.issues }, { status: 400 })
  }

  const { pixKeyType, pixKey, label, isDefault } = parsed.data

  if (!validatePixKey(pixKeyType, pixKey)) {
    return NextResponse.json({ error: 'Chave PIX invalida para o tipo selecionado' }, { status: 400 })
  }

  // Max 5 accounts
  const count = await prisma.bankAccount.count({ where: { userId: user.id } })
  if (count >= 5) {
    return NextResponse.json({ error: 'Limite de 5 contas atingido' }, { status: 400 })
  }

  try {
    // If setting as default, unset others
    if (isDefault) {
      await prisma.bankAccount.updateMany({
        where: { userId: user.id },
        data: { isDefault: false },
      })
    }

    const account = await prisma.bankAccount.create({
      data: {
        userId: user.id,
        pixKeyType,
        pixKey,
        label: label || null,
        isDefault: isDefault ?? count === 0, // first account is default
      },
    })

    logger.info('Bank account created', { userId: user.id, accountId: account.id })

    return NextResponse.json({ account }, { status: 201 })
  } catch (error) {
    logger.error('Error creating bank account', { error: String(error) })
    return NextResponse.json({ error: 'Erro ao criar conta' }, { status: 500 })
  }
}
