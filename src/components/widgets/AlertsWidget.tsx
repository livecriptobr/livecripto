'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ControlCommand } from '@/lib/control-commands'

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

interface AlertTier {
  id: string
  name: string
  minAmountCents: number
  color: string
  soundUrl: string | null
  animationType: string
  duration: number
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

function matchTier(amountCents: number, tiers: AlertTier[]): AlertTier | null {
  // tiers are sorted desc by minAmountCents from API
  return tiers.find(t => amountCents >= t.minAmountCents) ?? null
}

export default function AlertsWidget({ widgetId, token, config }: AlertsWidgetProps) {
  const [current, setCurrent] = useState<DonationAlert | null>(null)
  const [currentTier, setCurrentTier] = useState<AlertTier | null>(null)
  const seenRef = useRef<Set<string>>(new Set())
  const queueRef = useRef<DonationAlert[]>([])
  const showingRef = useRef(false)
  const tiersRef = useRef<AlertTier[]>([])

  // SSE control state
  const [autoplay, setAutoplay] = useState(true)
  const [paused, setPaused] = useState(false)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(80)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const autoplayRef = useRef(autoplay)
  const pausedRef = useRef(paused)
  useEffect(() => { autoplayRef.current = autoplay }, [autoplay])
  useEffect(() => { pausedRef.current = paused }, [paused])

  const defaultDurationMs = (config.duration ?? 5) * 1000
  const defaultAnim = config.animation ?? 'slideUp'
  const fontSize = config.fontSize ?? 24

  const showNextRef = useRef<() => void>(() => {})

  const showNext = useCallback(() => {
    if (queueRef.current.length === 0) {
      showingRef.current = false
      return
    }
    if (pausedRef.current || !autoplayRef.current) {
      showingRef.current = false
      return
    }
    showingRef.current = true
    const next = queueRef.current.shift()!
    const tier = matchTier(next.amountCents, tiersRef.current)
    setCurrent(next)
    setCurrentTier(tier)

    // Play tier sound
    if (tier?.soundUrl && !muted) {
      const audio = new Audio(tier.soundUrl)
      audio.volume = volume / 100
      audio.play().catch(() => {/* silent */})
      audioRef.current = audio
    }

    const displayMs = tier ? tier.duration * 1000 : defaultDurationMs
    setTimeout(() => {
      setCurrent(null)
      setCurrentTier(null)
      setTimeout(() => showNextRef.current(), 500)
    }, displayMs)
  }, [defaultDurationMs, muted, volume])

  useEffect(() => { showNextRef.current = showNext }, [showNext])

  // Poll for donations
  useEffect(() => {
    let cancelled = false
    let lastSince = new Date().toISOString()

    const poll = async () => {
      if (cancelled) return
      try {
        const res = await fetch(`/api/widgets/${widgetId}/data?token=${token}&since=${lastSince}`)
        if (!res.ok) return
        const data = (await res.json()) as { donations: DonationAlert[]; alertTiers: AlertTier[] }
        if (data.alertTiers) {
          tiersRef.current = data.alertTiers
        }
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
  }, [widgetId, token, showNext])

  // SSE control stream
  useEffect(() => {
    const es = new EventSource(`/api/controls/stream?token=${token}`)

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { type?: string; command?: ControlCommand }
        if (data.type === 'init') return
        const cmd = data.command
        if (!cmd || cmd.section !== 'alerts') return

        switch (cmd.action) {
          case 'toggle_autoplay':
            setAutoplay(prev => !prev)
            break
          case 'pause':
            setPaused(true)
            break
          case 'resume':
            setPaused(false)
            if (!showingRef.current && queueRef.current.length > 0) {
              showNext()
            }
            break
          case 'skip':
            setCurrent(null)
            setCurrentTier(null)
            break
          case 'mute':
            setMuted(true)
            if (audioRef.current) audioRef.current.muted = true
            break
          case 'unmute':
            setMuted(false)
            if (audioRef.current) audioRef.current.muted = false
            break
          case 'volume_up':
            setVolume(prev => Math.min(100, prev + 10))
            break
          case 'volume_down':
            setVolume(prev => Math.max(0, prev - 10))
            break
          case 'clear_queue':
            queueRef.current = []
            break
        }
      } catch { /* silent */ }
    }

    return () => es.close()
  }, [token, showNext])

  const formatBRL = (cents: number) =>
    `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`

  const tierColor = currentTier?.color
  const tierAnim = (currentTier?.animationType ?? defaultAnim) as keyof typeof animations
  const anim = animations[tierAnim] ?? animations.slideUp

  return (
    <div className="flex items-center justify-center min-h-screen">
      <AnimatePresence>
        {current && (
          <motion.div
            key={current.id}
            {...anim}
            className={`text-center ${config.layout === 'horizontal' ? 'flex items-center gap-4' : 'space-y-2'}`}
            style={tierColor ? {
              borderColor: tierColor,
              borderWidth: 2,
              borderStyle: 'solid',
              borderRadius: 12,
              padding: 16,
              boxShadow: `0 0 20px ${tierColor}40`,
            } : undefined}
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
