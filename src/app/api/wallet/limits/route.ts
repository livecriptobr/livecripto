import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { walletService } from '@/services/wallet'

const DAILY_LIMIT_CENTS = 500000
const MONTHLY_LIMIT_CENTS = 5000000
const MIN_WITHDRAW_CENTS = 1000

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

  const [dailyWithdrawn, monthlyWithdrawn, balance, balances] = await Promise.all([
    walletService.getDailyWithdrawn(user.id),
    walletService.getMonthlyWithdrawn(user.id),
    walletService.getBalance(user.id),
    walletService.getBalancesByMethod(user.id),
  ])

  return NextResponse.json({
    daily: {
      used: dailyWithdrawn,
      limit: DAILY_LIMIT_CENTS,
      remaining: Math.max(0, DAILY_LIMIT_CENTS - dailyWithdrawn),
    },
    monthly: {
      used: monthlyWithdrawn,
      limit: MONTHLY_LIMIT_CENTS,
      remaining: Math.max(0, MONTHLY_LIMIT_CENTS - monthlyWithdrawn),
    },
    minWithdraw: MIN_WITHDRAW_CENTS,
    balance,
    balances,
  })
}
