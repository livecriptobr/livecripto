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

export interface MethodBalances {
  pix: number
  card: number
  lightning: number
  total: number
}

export async function getBalancesByMethod(userId: string): Promise<MethodBalances> {
  // Sum donations received per method
  const income = await prisma.transaction.groupBy({
    by: ['paymentMethod'],
    where: { userId, type: 'donation_received', status: 'completed' },
    _sum: { netCents: true },
  })

  // Sum withdrawals per method
  const withdrawn = await prisma.transaction.groupBy({
    by: ['paymentMethod'],
    where: { userId, type: 'withdrawal', status: 'completed' },
    _sum: { netCents: true },
  })

  const incomeMap: Record<string, number> = {}
  for (const row of income) {
    if (row.paymentMethod) incomeMap[row.paymentMethod] = row._sum.netCents ?? 0
  }

  const withdrawnMap: Record<string, number> = {}
  for (const row of withdrawn) {
    if (row.paymentMethod) withdrawnMap[row.paymentMethod] = row._sum.netCents ?? 0
  }

  const pix = (incomeMap['pix'] ?? 0) - (withdrawnMap['pix'] ?? 0)
  const card = (incomeMap['card'] ?? 0) - (withdrawnMap['card'] ?? 0)
  const lightning = ((incomeMap['lightning'] ?? 0) + (incomeMap['crypto'] ?? 0))
    - ((withdrawnMap['lightning'] ?? 0) + (withdrawnMap['crypto'] ?? 0))

  return {
    pix: Math.max(0, pix),
    card: Math.max(0, card),
    lightning: Math.max(0, lightning),
    total: Math.max(0, pix + card + lightning),
  }
}

export const walletService = {
  recordTransaction,
  getBalance,
  getBalancesByMethod,
  getDailyWithdrawn,
  getMonthlyWithdrawn,
}
