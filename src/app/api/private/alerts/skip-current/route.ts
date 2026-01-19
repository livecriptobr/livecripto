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

  // Find the currently locked alert for this user
  const currentAlert = await alertService.getCurrentLockedAlert(user.id)

  if (!currentAlert) {
    return NextResponse.json({ error: 'No active alert to skip' }, { status: 404 })
  }

  await alertService.skipAlert(currentAlert.id)

  return NextResponse.json({ success: true })
}
