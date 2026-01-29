import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'

const logger = createLogger({ action: 'wallet-export' })

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

  const { searchParams } = req.nextUrl
  const from = searchParams.get('from') || undefined
  const to = searchParams.get('to') || undefined

  const where: Record<string, unknown> = { userId: user.id, status: 'completed' }
  if (from || to) {
    const createdAt: Record<string, Date> = {}
    if (from) createdAt.gte = new Date(from)
    if (to) createdAt.lte = new Date(to)
    where.createdAt = createdAt
  }

  try {
    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 5000,
    })

    const header = 'Data,ID,Tipo,Descricao,Metodo,Bruto (R$),Taxa (R$),Liquido (R$),Saldo (R$)\n'
    const rows = transactions.map((t) => {
      const date = new Date(t.createdAt).toLocaleString('pt-BR')
      const desc = (t.description || '').replace(/,/g, ';')
      return `${date},${t.id},${t.type},${desc},${t.paymentMethod || ''},${(t.amountCents / 100).toFixed(2)},${(t.feeCents / 100).toFixed(2)},${(t.netCents / 100).toFixed(2)},${(t.balanceCents / 100).toFixed(2)}`
    })

    const csv = header + rows.join('\n')

    logger.info('CSV exported', { userId: user.id, rows: String(transactions.length) })

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="extrato-livecripto-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  } catch (error) {
    logger.error('Error exporting CSV', { error: String(error) })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
