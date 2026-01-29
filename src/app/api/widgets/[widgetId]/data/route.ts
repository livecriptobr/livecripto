import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createLogger } from '@/lib/logger'

const logger = createLogger({ action: 'widget-data' })

interface RankingRow {
  donorName: string
  _sum: { amountCents: number | null }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ widgetId: string }> }
) {
  const { widgetId } = await params
  const token = req.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 401 })
  }

  try {
    const widget = await prisma.widget.findFirst({
      where: { id: widgetId, token, isActive: true },
      include: { marathonTimer: true },
    })

    if (!widget) {
      return NextResponse.json({ error: 'Widget not found or inactive' }, { status: 404 })
    }

    const config = widget.config as Record<string, unknown>

    switch (widget.type) {
      case 'alerts': {
        const since = req.nextUrl.searchParams.get('since')
        const donations = await prisma.donation.findMany({
          where: {
            userId: widget.userId,
            status: 'PAID',
            ...(since ? { paidAt: { gt: new Date(since) } } : {}),
          },
          orderBy: { paidAt: 'desc' },
          take: 5,
          select: { id: true, donorName: true, amountCents: true, message: true, paidAt: true },
        })
        return NextResponse.json({ donations })
      }

      case 'ranking': {
        const period = (config.period as string) || 'alltime'
        const dateFilter = getRankingDateFilter(period)
        const rankings = await prisma.donation.groupBy({
          by: ['donorName'],
          where: {
            userId: widget.userId,
            status: 'PAID',
            ...(dateFilter ? { paidAt: dateFilter } : {}),
          },
          _sum: { amountCents: true },
          orderBy: { _sum: { amountCents: 'desc' } },
          take: 10,
        })
        const items = rankings.map((r: RankingRow) => ({
          donorName: r.donorName,
          totalCents: r._sum.amountCents ?? 0,
        }))
        return NextResponse.json({ rankings: items })
      }

      case 'recent': {
        const donations = await prisma.donation.findMany({
          where: { userId: widget.userId, status: 'PAID' },
          orderBy: { paidAt: 'desc' },
          take: 20,
          select: { id: true, donorName: true, amountCents: true, message: true, paidAt: true },
        })
        return NextResponse.json({ donations })
      }

      case 'marathon': {
        if (!widget.marathonTimer) {
          return NextResponse.json({ timer: null })
        }
        const t = widget.marathonTimer
        return NextResponse.json({
          timer: {
            endsAt: t.endsAt.toISOString(),
            baseMinutes: t.baseMinutes,
            addMinutesPer: t.addMinutesPer,
            addThreshold: t.addThreshold,
            maxHours: t.maxHours,
            isPaused: t.isPaused,
            pausedAt: t.pausedAt?.toISOString() ?? null,
            remainingOnPause: t.remainingOnPause,
          },
        })
      }

      case 'video':
      case 'music': {
        // Video/music queue from recent donations with YouTube links
        const minAmount = (config.minAmountCents as number) || 500
        const donations = await prisma.donation.findMany({
          where: {
            userId: widget.userId,
            status: 'PAID',
            amountCents: { gte: minAmount },
            message: { contains: 'youtu' },
          },
          orderBy: { paidAt: 'desc' },
          take: 20,
          select: { id: true, donorName: true, amountCents: true, message: true, paidAt: true },
        })
        const queue = donations.map(d => {
          const match = d.message.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/)
          return {
            id: d.id,
            donorName: d.donorName,
            amountCents: d.amountCents,
            videoId: match ? match[1] : null,
            message: d.message,
          }
        }).filter(d => d.videoId)
        return NextResponse.json({ queue })
      }

      default:
        return NextResponse.json({ error: 'Unknown widget type' }, { status: 400 })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro'
    logger.error('Widget data error', { error: msg, widgetId })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

function getRankingDateFilter(period: string): { gte: Date } | null {
  const now = new Date()
  switch (period) {
    case 'today': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      return { gte: start }
    }
    case 'week': {
      const start = new Date(now)
      start.setDate(start.getDate() - 7)
      return { gte: start }
    }
    case 'month': {
      const start = new Date(now)
      start.setMonth(start.getMonth() - 1)
      return { gte: start }
    }
    default:
      return null
  }
}
