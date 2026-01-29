'use client'

import { useEffect, useState } from 'react'

interface RankingItem {
  donorName: string
  totalCents: number
}

interface RankingConfig {
  period?: 'today' | 'week' | 'month' | 'alltime'
  title?: string
  fontSize?: number
  textColor?: string
  accentColor?: string
}

interface RankingWidgetProps {
  widgetId: string
  token: string
  config: RankingConfig
}

const medals = ['🥇', '🥈', '🥉']
const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32']

export default function RankingWidget({ widgetId, token, config }: RankingWidgetProps) {
  const [rankings, setRankings] = useState<RankingItem[]>([])

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const res = await fetch(`/api/widgets/${widgetId}/data?token=${token}`)
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { rankings: RankingItem[] }
        if (!cancelled) setRankings(data.rankings)
      } catch { /* silent */ }
    }
    poll()
    const interval = setInterval(poll, 30000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [widgetId, token])

  const formatBRL = (cents: number) =>
    `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`

  const fontSize = config.fontSize ?? 18
  const textColor = config.textColor ?? '#FFFFFF'

  return (
    <div className="p-4 space-y-3">
      {config.title && (
        <h2 style={{ fontSize: fontSize + 4, color: config.accentColor ?? '#FFD700' }} className="font-bold text-center drop-shadow-lg">
          {config.title}
        </h2>
      )}
      <div className="space-y-2">
        {rankings.map((item, i) => (
          <div
            key={item.donorName}
            className="flex items-center gap-3 px-3 py-2 rounded-lg"
            style={{
              backgroundColor: i < 3 ? `${medalColors[i]}20` : 'rgba(255,255,255,0.05)',
              fontSize,
              color: textColor,
            }}
          >
            <span className="text-2xl w-8 text-center">{i < 3 ? medals[i] : `${i + 1}.`}</span>
            <span className="flex-1 font-semibold truncate drop-shadow">{item.donorName}</span>
            <span style={{ color: i < 3 ? medalColors[i] : config.accentColor ?? '#FFD700' }} className="font-bold drop-shadow">
              {formatBRL(item.totalCents)}
            </span>
          </div>
        ))}
        {rankings.length === 0 && (
          <div className="text-center text-white/40 py-8" style={{ fontSize }}>
            Nenhuma doacao ainda
          </div>
        )}
      </div>
    </div>
  )
}
