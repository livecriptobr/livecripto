import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { alertService } from '@/services/alert.service'

export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { alertId } = await req.json()

  const user = await prisma.user.findUnique({ where: { clerkUserId } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const alert = await prisma.alert.findUnique({ where: { id: alertId } })
  if (!alert || alert.userId !== user.id) {
    return NextResponse.json({ error: 'Alert not found' }, { status: 404 })
  }

  await alertService.skipAlert(alertId)

  return NextResponse.json({ success: true })
}
