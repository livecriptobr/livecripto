import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { alertService } from '@/services/alert.service'

export async function POST(req: NextRequest) {
  const { alertId, token } = await req.json()

  if (!alertId || !token) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  const alert = await prisma.alert.findUnique({
    where: { id: alertId },
    include: { user: { select: { overlayToken: true } } },
  })

  if (!alert || alert.user.overlayToken !== token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await alertService.acknowledgeAlert(alertId)

  return NextResponse.json({ success: true })
}
