import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { alertService } from '@/services/alert.service'

export async function POST() {
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { clerkUserId } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const newAlert = await alertService.replayLastAlert(user.id)

  if (!newAlert) {
    return NextResponse.json({ error: 'No previous alert to replay' }, { status: 404 })
  }

  return NextResponse.json({ success: true, alertId: newAlert.id })
}
