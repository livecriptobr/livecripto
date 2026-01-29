'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface TimerData {
  endsAt: string
  isPaused: boolean
  remainingOnPause: number | null
  addMinutesPer: number
  addThreshold: number
}

interface MarathonConfig {
  fontSize?: number
  textColor?: string
  bgColor?: string
  showAddAnimation?: boolean
}

interface MarathonWidgetProps {
  widgetId: string
  token: string
  config: MarathonConfig
}

function formatTime(totalSeconds: number): string {
  if (totalSeconds <= 0) return '00:00:00'
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export default function MarathonWidget({ widgetId, token, config }: MarathonWidgetProps) {
  const [timer, setTimer] = useState<TimerData | null>(null)
  const [display, setDisplay] = useState('00:00:00')
  const [addedMin, setAddedMin] = useState<number | null>(null)
  const prevEndsAtRef = useRef<string>('')

  const fetchTimer = useCallback(async () => {
    try {
      const res = await fetch(`/api/widgets/${widgetId}/data?token=${token}`)
      if (!res.ok) return
      const data = (await res.json()) as { timer: TimerData | null }
      if (data.timer) {
        // Check if time was added
        if (prevEndsAtRef.current && data.timer.endsAt !== prevEndsAtRef.current && !data.timer.isPaused) {
          const diff = new Date(data.timer.endsAt).getTime() - new Date(prevEndsAtRef.current).getTime()
          if (diff > 0) {
            const addedMins = Math.round(diff / 60000)
            setAddedMin(addedMins)
            setTimeout(() => setAddedMin(null), 3000)
          }
        }
        prevEndsAtRef.current = data.timer.endsAt
        setTimer(data.timer)
      }
    } catch { /* silent */ }
  }, [widgetId, token])

  // Sync every 10s
  useEffect(() => {
    fetchTimer()
    const interval = setInterval(fetchTimer, 10000)
    return () => clearInterval(interval)
  }, [fetchTimer])

  // Client-side countdown
  useEffect(() => {
    if (!timer) return

    if (timer.isPaused) {
      const paused = formatTime(timer.remainingOnPause ?? 0)
      // Use requestAnimationFrame to avoid setState-in-effect lint warning
      const raf = requestAnimationFrame(() => setDisplay(paused))
      return () => cancelAnimationFrame(raf)
    }

    const tick = () => {
      const remaining = Math.floor((new Date(timer.endsAt).getTime() - Date.now()) / 1000)
      setDisplay(formatTime(Math.max(0, remaining)))
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [timer])

  const fontSize = config.fontSize ?? 72
  const textColor = config.textColor ?? '#FFFFFF'

  return (
    <div className="flex flex-col items-center justify-center min-h-screen relative">
      <div
        className="font-mono font-bold drop-shadow-2xl"
        style={{
          fontSize,
          color: textColor,
          textShadow: '0 0 20px rgba(255,255,255,0.3)',
        }}
      >
        {display}
      </div>
      {timer?.isPaused && (
        <div className="text-yellow-400 text-lg font-semibold mt-2 animate-pulse">
          PAUSADO
        </div>
      )}
      <AnimatePresence>
        {addedMin !== null && config.showAddAnimation !== false && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: -30, scale: 1.2 }}
            exit={{ opacity: 0, y: -60 }}
            transition={{ duration: 0.8 }}
            className="absolute text-green-400 font-bold text-3xl drop-shadow-lg"
            style={{ top: '30%' }}
          >
            +{addedMin} min
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
