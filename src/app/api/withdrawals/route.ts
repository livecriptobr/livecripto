import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'
import { walletService } from '@/services/wallet'

const logger = createLogger({ action: 'withdrawals' })

const MIN_WITHDRAW_CENTS = 1000
const DAILY_LIMIT_CENTS = 500000
const MONTHLY_LIMIT_CENTS = 5000000

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

  const withdrawals = await prisma.withdrawRequest.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return NextResponse.json({ withdrawals })
}

export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true, pixKey: true },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { amountCents, bankAccountId } = await req.json()

  if (typeof amountCents !== 'number' || amountCents < MIN_WITHDRAW_CENTS || !Number.isInteger(amountCents)) {
    return NextResponse.json({ error: `Valor minimo: R$ ${(MIN_WITHDRAW_CENTS / 100).toFixed(2)}` }, { status: 400 })
  }

  // Resolve destination
  let destination = ''
  if (bankAccountId) {
    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, userId: user.id },
    })
    if (!bankAccount) {
      return NextResponse.json({ error: 'Conta bancaria nao encontrada' }, { status: 400 })
    }
    destination = `PIX ${bankAccount.pixKeyType}: ${bankAccount.pixKey}`
  } else if (user.pixKey) {
    destination = `PIX: ${user.pixKey}`
  } else {
    return NextResponse.json({ error: 'Cadastre uma chave PIX antes de sacar' }, { status: 400 })
  }

  try {
    const [balance, dailyWithdrawn, monthlyWithdrawn] = await Promise.all([
      walletService.getBalance(user.id),
      walletService.getDailyWithdrawn(user.id),
      walletService.getMonthlyWithdrawn(user.id),
    ])

    if (amountCents > balance) {
      return NextResponse.json({ error: 'Saldo insuficiente' }, { status: 400 })
    }

    if (dailyWithdrawn + amountCents > DAILY_LIMIT_CENTS) {
      return NextResponse.json({ error: `Limite diario de R$ ${(DAILY_LIMIT_CENTS / 100).toFixed(2)} excedido` }, { status: 400 })
    }

    if (monthlyWithdrawn + amountCents > MONTHLY_LIMIT_CENTS) {
      return NextResponse.json({ error: `Limite mensal de R$ ${(MONTHLY_LIMIT_CENTS / 100).toFixed(2)} excedido` }, { status: 400 })
    }

    const withdrawal = await prisma.withdrawRequest.create({
      data: {
        userId: user.id,
        method: 'PIX',
        amountCents,
        destinationSnapshot: destination,
      },
    })

    // Record transaction
    await walletService.recordTransaction({
      userId: user.id,
      type: 'withdrawal',
      amountCents,
      netCents: amountCents,
      description: `Saque PIX - ${destination}`,
      referenceId: withdrawal.id,
      referenceType: 'withdraw_request',
      paymentMethod: 'pix',
    })

    logger.info('Withdrawal requested', { userId: user.id, amountCents: String(amountCents) })

    return NextResponse.json({ withdrawal }, { status: 201 })
  } catch (error) {
    logger.error('Error requesting withdrawal', { error: String(error) })
    return NextResponse.json({ error: 'Erro ao processar saque' }, { status: 500 })
  }
}
