import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { alertService } from '@/services/alert.service'

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username')
  const token = req.nextUrl.searchParams.get('token')

  if (!username || !token) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, overlayToken: true, alertSettings: true },
  })

  if (!user || user.overlayToken !== token) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const alert = await alertService.getNextReadyAlert(user.id)

  if (!alert) {
    return NextResponse.json({ alert: null })
  }

  const donation = await prisma.donation.findUnique({
    where: { id: alert.donationId },
    select: { donorName: true, amountCents: true, message: true },
  })

  const settings = user.alertSettings as Record<string, any>

  return NextResponse.json({
    alert: {
      id: alert.id,
      donorName: donation?.donorName || 'Anonimo',
      amountCents: donation?.amountCents || 0,
      message: donation?.message || '',
      audioUrl: alert.audioUrl,
      durationMs: settings?.durationMs || 8000,
    },
  })
}
