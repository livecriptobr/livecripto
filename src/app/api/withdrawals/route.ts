import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'
import { walletService } from '@/services/wallet'

const logger = createLogger({ action: 'withdrawals' })

const MIN_WITHDRAW_CENTS = 1000
const DAILY_LIMIT_CENTS = 500000
const MONTHLY_LIMIT_CENTS = 5000000

type WithdrawMethod = 'PIX' | 'LIGHTNING' | 'CARD'

const METHOD_TO_PAYMENT: Record<WithdrawMethod, string> = {
  PIX: 'pix',
  LIGHTNING: 'lightning',
  CARD: 'card',
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
    select: { id: true, pixKey: true, lightningAddress: true },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { amountCents, bankAccountId, method: rawMethod, lightningAddress } = await req.json()

  const method: WithdrawMethod = (['PIX', 'LIGHTNING', 'CARD'].includes(rawMethod) ? rawMethod : 'PIX') as WithdrawMethod

  if (typeof amountCents !== 'number' || amountCents < MIN_WITHDRAW_CENTS || !Number.isInteger(amountCents)) {
    return NextResponse.json({ error: `Valor minimo: R$ ${(MIN_WITHDRAW_CENTS / 100).toFixed(2)}` }, { status: 400 })
  }

  // Resolve destination based on method
  let destination = ''

  if (method === 'PIX') {
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
  } else if (method === 'LIGHTNING') {
    const address = lightningAddress?.trim()
    if (!address) {
      return NextResponse.json({ error: 'Informe um endereco Lightning' }, { status: 400 })
    }
    destination = `Lightning: ${address}`
    // Save lightning address to user profile for future use
    if (address !== user.lightningAddress) {
      await prisma.user.update({
        where: { id: user.id },
        data: { lightningAddress: address },
      })
    }
  } else if (method === 'CARD') {
    destination = 'MercadoPago (processamento manual)'
  }

  try {
    const [balances, dailyWithdrawn, monthlyWithdrawn] = await Promise.all([
      walletService.getBalancesByMethod(user.id),
      walletService.getDailyWithdrawn(user.id),
      walletService.getMonthlyWithdrawn(user.id),
    ])

    // Check per-method balance
    const methodKey = METHOD_TO_PAYMENT[method] as 'pix' | 'card' | 'lightning'
    const methodBalance = balances[methodKey]

    if (amountCents > methodBalance) {
      return NextResponse.json({ error: `Saldo insuficiente em ${method}` }, { status: 400 })
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
        method,
        amountCents,
        destinationSnapshot: destination,
      },
    })

    await walletService.recordTransaction({
      userId: user.id,
      type: 'withdrawal',
      amountCents,
      netCents: amountCents,
      description: `Saque ${method} - ${destination}`,
      referenceId: withdrawal.id,
      referenceType: 'withdraw_request',
      paymentMethod: methodKey,
    })

    logger.info('Withdrawal requested', { userId: user.id, method, amountCents: String(amountCents) })

    return NextResponse.json({ withdrawal }, { status: 201 })
  } catch (error) {
    logger.error('Error requesting withdrawal', { error: String(error) })
    return NextResponse.json({ error: 'Erro ao processar saque' }, { status: 500 })
  }
}
