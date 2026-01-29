'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface RecentDonation {
  id: string
  donorName: string
  amountCents: number
  message: string
  paidAt: string
}

interface RecentConfig {
  maxItems?: number
  fontSize?: number
  textColor?: string
  amountColor?: string
  showMessage?: boolean
}

interface RecentWidgetProps {
  widgetId: string
  token: string
  config: RecentConfig
}

export default function RecentWidget({ widgetId, token, config }: RecentWidgetProps) {
  const [donations, setDonations] = useState<RecentDonation[]>([])

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const res = await fetch(`/api/widgets/${widgetId}/data?token=${token}`)
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { donations: RecentDonation[] }
        if (!cancelled) setDonations(data.donations.slice(0, config.maxItems ?? 10))
      } catch { /* silent */ }
    }
    poll()
    const interval = setInterval(poll, 10000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [widgetId, token, config.maxItems])

  const formatBRL = (cents: number) =>
    `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`

  const fontSize = config.fontSize ?? 16
  const textColor = config.textColor ?? '#FFFFFF'
  const amountColor = config.amountColor ?? '#FFD700'
  const showMessage = config.showMessage !== false

  return (
    <div className="p-4 space-y-2">
      <AnimatePresence mode="popLayout">
        {donations.map(d => (
          <motion.div
            key={d.id}
            layout
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            className="flex items-start gap-3 px-3 py-2 rounded-lg bg-black/30 backdrop-blur-sm"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2" style={{ fontSize, color: textColor }}>
                <span className="font-semibold truncate drop-shadow">{d.donorName}</span>
                <span className="font-bold drop-shadow" style={{ color: amountColor }}>
                  {formatBRL(d.amountCents)}
                </span>
              </div>
              {showMessage && d.message && (
                <div className="text-white/70 truncate drop-shadow" style={{ fontSize: fontSize - 2 }}>
                  {d.message}
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      {donations.length === 0 && (
        <div className="text-center text-white/40 py-8" style={{ fontSize }}>
          Nenhuma doacao recente
        </div>
      )}
    </div>
  )
}
