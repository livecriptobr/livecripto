import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'

const logger = createLogger({ action: 'bank-account-detail' })

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, context: RouteContext) {
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

  const { id } = await context.params

  const account = await prisma.bankAccount.findUnique({
    where: { id },
  })

  if (!account || account.userId !== user.id) {
    return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 })
  }

  const body: unknown = await req.json()
  if (
    typeof body !== 'object' ||
    body === null ||
    !('isDefault' in body) ||
    (body as Record<string, unknown>).isDefault !== true
  ) {
    return NextResponse.json({ error: 'Apenas isDefault: true é permitido' }, { status: 400 })
  }

  try {
    await prisma.$transaction([
      prisma.bankAccount.updateMany({
        where: { userId: user.id },
        data: { isDefault: false },
      }),
      prisma.bankAccount.update({
        where: { id },
        data: { isDefault: true },
      }),
    ])

    logger.info('Bank account set as default', { userId: user.id, accountId: id })

    const updated = await prisma.bankAccount.findUnique({ where: { id } })
    return NextResponse.json({ account: updated })
  } catch (error) {
    logger.error('Error updating bank account', { error: String(error) })
    return NextResponse.json({ error: 'Erro ao atualizar conta' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
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

  const { id } = await context.params

  const account = await prisma.bankAccount.findUnique({
    where: { id },
  })

  if (!account || account.userId !== user.id) {
    return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 })
  }

  // Check if it's the only account and there are pending withdrawals
  const [accountCount, pendingWithdrawals] = await Promise.all([
    prisma.bankAccount.count({ where: { userId: user.id } }),
    prisma.withdrawRequest.count({
      where: { userId: user.id, status: 'REQUESTED' },
    }),
  ])

  if (accountCount <= 1 && pendingWithdrawals > 0) {
    return NextResponse.json(
      { error: 'Não é possível remover a única conta com saques pendentes' },
      { status: 400 }
    )
  }

  try {
    await prisma.bankAccount.delete({ where: { id } })

    // If deleted account was default, set another as default
    if (account.isDefault) {
      const nextAccount = await prisma.bankAccount.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'asc' },
      })
      if (nextAccount) {
        await prisma.bankAccount.update({
          where: { id: nextAccount.id },
          data: { isDefault: true },
        })
      }
    }

    logger.info('Bank account deleted', { userId: user.id, accountId: id })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error deleting bank account', { error: String(error) })
    return NextResponse.json({ error: 'Erro ao remover conta' }, { status: 500 })
  }
}
