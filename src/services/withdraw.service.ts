import { prisma } from '@/lib/db'
import { ledgerService } from './ledger.service'

const MIN_WITHDRAW_CENTS = 1000 // R$ 10,00
const WITHDRAW_COOLDOWN_MS = 60 * 60 * 1000 // 1 hora

export const withdrawService = {
  async requestWithdraw(params: {
    userId: string
    method: 'PIX' | 'LIGHTNING'
    amountCents: number
  }) {
    const { userId, method, amountCents } = params

    if (amountCents < MIN_WITHDRAW_CENTS) {
      throw new Error(`Valor minimo: R$ ${(MIN_WITHDRAW_CENTS / 100).toFixed(2)}`)
    }

    const balance = await ledgerService.getBalance(userId)
    if (balance < amountCents) {
      throw new Error('Saldo insuficiente')
    }

    const lastWithdraw = await prisma.withdrawRequest.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    if (lastWithdraw) {
      const cooldownEnd = new Date(lastWithdraw.createdAt.getTime() + WITHDRAW_COOLDOWN_MS)
      if (new Date() < cooldownEnd) {
        const minutesLeft = Math.ceil((cooldownEnd.getTime() - Date.now()) / 60000)
        throw new Error(`Aguarde ${minutesLeft} minutos para solicitar outro saque`)
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pixKey: true, lightningAddress: true },
    })

    const destination = method === 'PIX' ? user?.pixKey : user?.lightningAddress
    if (!destination) {
      throw new Error(`Configure seu ${method === 'PIX' ? 'Pix' : 'Lightning Address'} primeiro`)
    }

    return prisma.$transaction(async (tx) => {
      const withdraw = await tx.withdrawRequest.create({
        data: {
          userId,
          method,
          amountCents,
          destinationSnapshot: destination,
          status: 'REQUESTED',
        },
      })

      await tx.ledger.create({
        data: {
          userId,
          type: 'DEBIT',
          source: 'WITHDRAW',
          amountCents,
          referenceId: withdraw.id,
        },
      })

      return withdraw
    })
  },

  async getWithdraws(userId: string) {
    return prisma.withdrawRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
  },

  async cancelWithdraw(withdrawId: string, userId: string) {
    const withdraw = await prisma.withdrawRequest.findUnique({
      where: { id: withdrawId },
    })

    if (!withdraw || withdraw.userId !== userId) {
      throw new Error('Saque nao encontrado')
    }

    if (withdraw.status !== 'REQUESTED') {
      throw new Error('Saque nao pode ser cancelado')
    }

    return prisma.$transaction(async (tx) => {
      await tx.withdrawRequest.update({
        where: { id: withdrawId },
        data: { status: 'REJECTED', auditNotes: 'Cancelado pelo usuario' },
      })

      // Estornar valor
      await tx.ledger.create({
        data: {
          userId,
          type: 'CREDIT',
          source: 'ADJUSTMENT',
          amountCents: withdraw.amountCents,
          referenceId: withdraw.id,
        },
      })
    })
  },
}
