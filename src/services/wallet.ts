import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'

const logger = createLogger({ action: 'wallet-service' })

export interface RecordTransactionInput {
  userId: string
  type: string
  amountCents: number
  feeCents?: number
  netCents: number
  description?: string
  referenceId?: string
  referenceType?: string
  paymentMethod?: string
  metadata?: Record<string, string | number | boolean | null>
}

export async function recordTransaction(input: RecordTransactionInput) {
  return prisma.$transaction(async (tx) => {
    const lastTx = await tx.transaction.findFirst({
      where: { userId: input.userId, status: 'completed' },
      orderBy: { createdAt: 'desc' },
      select: { balanceCents: true },
    })

    const previousBalance = lastTx?.balanceCents ?? 0

    let balanceChange: number
    if (input.type === 'withdrawal' || input.type === 'fee') {
      balanceChange = -input.netCents
    } else {
      balanceChange = input.netCents
    }

    const newBalance = previousBalance + balanceChange

    const transaction = await tx.transaction.create({
      data: {
        userId: input.userId,
        type: input.type,
        status: 'completed',
        amountCents: input.amountCents,
        feeCents: input.feeCents ?? 0,
        netCents: input.netCents,
        balanceCents: newBalance,
        description: input.description,
        referenceId: input.referenceId,
        referenceType: input.referenceType,
        paymentMethod: input.paymentMethod,
        metadata: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : undefined,
      },
    })

    logger.info('Transaction recorded', {
      transactionId: transaction.id,
      userId: input.userId,
      type: input.type,
      netCents: String(input.netCents),
      newBalance: String(newBalance),
    })

    return transaction
  })
}

export async function getBalance(userId: string): Promise<number> {
  const lastTx = await prisma.transaction.findFirst({
    where: { userId, status: 'completed' },
    orderBy: { createdAt: 'desc' },
    select: { balanceCents: true },
  })

  return lastTx?.balanceCents ?? 0
}

export async function getDailyWithdrawn(userId: string): Promise<number> {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const result = await prisma.transaction.aggregate({
    where: {
      userId,
      type: 'withdrawal',
      status: 'completed',
      createdAt: { gte: startOfDay },
    },
    _sum: { amountCents: true },
  })

  return result._sum.amountCents ?? 0
}

export async function getMonthlyWithdrawn(userId: string): Promise<number> {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const result = await prisma.transaction.aggregate({
    where: {
      userId,
      type: 'withdrawal',
      status: 'completed',
      createdAt: { gte: startOfMonth },
    },
    _sum: { amountCents: true },
  })

  return result._sum.amountCents ?? 0
}

export const walletService = {
  recordTransaction,
  getBalance,
  getDailyWithdrawn,
  getMonthlyWithdrawn,
}
