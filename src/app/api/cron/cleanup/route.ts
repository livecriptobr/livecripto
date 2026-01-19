import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { deleteFromBunny, getPathFromUrl } from '@/lib/bunny'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const TTL_HOURS = 6
  const cutoff = new Date(Date.now() - TTL_HOURS * 60 * 60 * 1000)

  const expiredAlerts = await prisma.alert.findMany({
    where: {
      audioUrl: { not: null },
      status: 'DONE',
      consumedAt: { lt: cutoff },
    },
    select: {
      id: true,
      audioUrl: true,
    },
  })

  let deleted = 0
  let errors = 0

  for (const alert of expiredAlerts) {
    try {
      if (alert.audioUrl) {
        const path = getPathFromUrl(alert.audioUrl)
        if (path) {
          await deleteFromBunny(path)
        }
      }

      await prisma.alert.update({
        where: { id: alert.id },
        data: { audioUrl: null },
      })

      deleted++
    } catch (e) {
      console.error(`Failed to delete audio for alert ${alert.id}:`, e)
      errors++
    }
  }

  return NextResponse.json({
    deleted,
    errors,
    total: expiredAlerts.length,
    ttlHours: TTL_HOURS,
  })
}
