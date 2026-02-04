import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { alertService } from '@/services/alert.service'

export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { clerkUserId } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { donationId } = await req.json()
  if (!donationId) {
    return NextResponse.json({ error: 'donationId is required' }, { status: 400 })
  }

  // Verify the donation belongs to this user
  const donation = await prisma.donation.findFirst({
    where: { id: donationId, userId: user.id, status: 'PAID' },
  })

  if (!donation) {
    return NextResponse.json({ error: 'Donation not found' }, { status: 404 })
  }

  const newAlert = await alertService.replayDonation(user.id, donationId)

  return NextResponse.json({ success: true, alertId: newAlert.id })
}
