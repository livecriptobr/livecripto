'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface AlertConfig {
  layout?: 'horizontal' | 'vertical'
  fontSize?: number
  nameColor?: string
  amountColor?: string
  messageColor?: string
  animation?: 'fadeIn' | 'slideUp' | 'bounce' | 'zoom'
  duration?: number
}

interface DonationAlert {
  id: string
  donorName: string
  amountCents: number
  message: string
  paidAt: string
}

interface AlertsWidgetProps {
  widgetId: string
  token: string
  config: AlertConfig
}

const animations = {
  fadeIn: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } },
  slideUp: { initial: { opacity: 0, y: 80 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -80 } },
  bounce: { initial: { scale: 0 }, animate: { scale: 1, transition: { type: 'spring' as const, stiffness: 300 } }, exit: { scale: 0 } },
  zoom: { initial: { scale: 0.3, opacity: 0 }, animate: { scale: 1, opacity: 1 }, exit: { scale: 1.5, opacity: 0 } },
}

export default function AlertsWidget({ widgetId, token, config }: AlertsWidgetProps) {
  const [current, setCurrent] = useState<DonationAlert | null>(null)
  const seenRef = useRef<Set<string>>(new Set())
  const queueRef = useRef<DonationAlert[]>([])
  const showingRef = useRef(false)

  const durationMs = (config.duration ?? 5) * 1000
  const anim = animations[config.animation ?? 'slideUp']
  const fontSize = config.fontSize ?? 24

  // Single effect that handles both polling and display queue
  useEffect(() => {
    let cancelled = false
    let lastSince = new Date().toISOString()

    function showNext() {
      if (queueRef.current.length === 0) {
        showingRef.current = false
        return
      }
      showingRef.current = true
      const next = queueRef.current.shift()!
      setCurrent(next)
      setTimeout(() => {
        if (cancelled) return
        setCurrent(null)
        setTimeout(() => {
          if (!cancelled) showNext()
        }, 500)
      }, durationMs)
    }

    const poll = async () => {
      if (cancelled) return
      try {
        const res = await fetch(`/api/widgets/${widgetId}/data?token=${token}&since=${lastSince}`)
        if (!res.ok) return
        const data = (await res.json()) as { donations: DonationAlert[] }
        const newOnes = data.donations.filter(d => !seenRef.current.has(d.id))
        newOnes.reverse().forEach(d => {
          seenRef.current.add(d.id)
          queueRef.current.push(d)
          if (d.paidAt) lastSince = d.paidAt
        })
        if (!showingRef.current && queueRef.current.length > 0) {
          showNext()
        }
      } catch { /* silent */ }
    }

    poll()
    const interval = setInterval(poll, 3000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [widgetId, token, durationMs])

  const formatBRL = (cents: number) =>
    `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`

  return (
    <div className="flex items-center justify-center min-h-screen">
      <AnimatePresence>
        {current && (
          <motion.div
            key={current.id}
            {...anim}
            className={`text-center ${config.layout === 'horizontal' ? 'flex items-center gap-4' : 'space-y-2'}`}
          >
            <div style={{ fontSize: fontSize + 8, color: config.amountColor ?? '#FFD700' }} className="font-bold drop-shadow-lg">
              {formatBRL(current.amountCents)}
            </div>
            <div style={{ fontSize, color: config.nameColor ?? '#FFFFFF' }} className="font-semibold drop-shadow">
              {current.donorName}
            </div>
            {current.message && (
              <div style={{ fontSize: fontSize - 4, color: config.messageColor ?? '#E0E0E0' }} className="drop-shadow max-w-md">
                {current.message}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
