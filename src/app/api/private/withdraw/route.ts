import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { withdrawService } from '@/services/withdraw.service'

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

  const { method, amountCents } = await req.json()

  // Validate method
  if (!['PIX', 'LIGHTNING'].includes(method)) {
    return NextResponse.json({ error: 'Metodo invalido' }, { status: 400 })
  }

  // Validate amount
  if (typeof amountCents !== 'number' || amountCents <= 0 || !Number.isInteger(amountCents)) {
    return NextResponse.json({ error: 'Valor invalido' }, { status: 400 })
  }

  try {
    const withdraw = await withdrawService.requestWithdraw({
      userId: user.id,
      method: method as 'PIX' | 'LIGHTNING',
      amountCents,
    })

    return NextResponse.json({ withdraw })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao processar saque'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
