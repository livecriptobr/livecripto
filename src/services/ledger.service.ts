import { prisma } from '@/lib/db'

export const ledgerService = {
  async getBalance(userId: string): Promise<number> {
    const result = await prisma.ledger.groupBy({
      by: ['type'],
      where: { userId },
      _sum: { amountCents: true },
    })

    const credits = result.find(r => r.type === 'CREDIT')?._sum.amountCents || 0
    const debits = result.find(r => r.type === 'DEBIT')?._sum.amountCents || 0

    return credits - debits
  },

  async getTransactions(userId: string, limit = 50, offset = 0) {
    return prisma.ledger.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    })
  },

  async createCredit(params: {
    userId: string
    amountCents: number
    source: 'DONATION' | 'ADJUSTMENT'
    referenceId: string
  }) {
    return prisma.ledger.create({
      data: {
        userId: params.userId,
        type: 'CREDIT',
        source: params.source,
        amountCents: params.amountCents,
        referenceId: params.referenceId,
      },
    })
  },

  async createDebit(params: {
    userId: string
    amountCents: number
    source: 'WITHDRAW' | 'ADJUSTMENT'
    referenceId: string
  }) {
    return prisma.ledger.create({
      data: {
        userId: params.userId,
        type: 'DEBIT',
        source: params.source,
        amountCents: params.amountCents,
        referenceId: params.referenceId,
      },
    })
  },
}
