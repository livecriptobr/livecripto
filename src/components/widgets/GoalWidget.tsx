'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface GoalWidgetData {
  id: string
  title: string
  targetCents: number
  currentCents: number
  type: string
}

interface GoalWidgetConfig {
  goalId?: string
  layout?: 'horizontal' | 'vertical'
  fontSize?: number
  textColor?: string
  barColor?: string
  bgColor?: string
  showPercentage?: boolean
  showAmount?: boolean
}

interface GoalWidgetProps {
  widgetId: string
  token: string
  config: GoalWidgetConfig
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function GoalWidget({ widgetId, token, config }: GoalWidgetProps) {
  const [goal, setGoal] = useState<GoalWidgetData | null>(null)
  const [celebrating, setCelebrating] = useState(false)
  const prevCentsRef = useRef<number>(0)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/widgets/${widgetId}/data?token=${token}`)
      if (!res.ok) return
      const data = (await res.json()) as { goal: GoalWidgetData | null }
      if (data.goal) {
        // Check if goal just completed
        if (
          prevCentsRef.current < data.goal.targetCents &&
          data.goal.currentCents >= data.goal.targetCents
        ) {
          setCelebrating(true)
          setTimeout(() => setCelebrating(false), 5000)
        }
        prevCentsRef.current = data.goal.currentCents
        setGoal(data.goal)
      }
    } catch { /* silent */ }
  }, [widgetId, token])

  useEffect(() => {
    const interval = setInterval(fetchData, 10000)
    // Initial fetch via timeout to avoid sync setState in effect
    const timeout = setTimeout(fetchData, 0)
    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [fetchData])

  const confettiParticles = useMemo(() =>
    Array.from({ length: 20 }).map((_, i) => ({
      x: `${(i * 37 + 13) % 100}%`,
      y: `${(i * 53 + 7) % 100}%`,
      rotate: (i * 137) % 720,
      duration: 2 + (i % 5) * 0.5,
      color: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'][i % 6],
    }))
  , [])

  if (!goal) return null

  const progress = goal.targetCents > 0 ? Math.min(100, Math.round((goal.currentCents / goal.targetCents) * 100)) : 0
  const isCompleted = goal.currentCents >= goal.targetCents
  const fontSize = config.fontSize ?? 24
  const textColor = config.textColor ?? '#FFFFFF'
  const barColor = config.barColor ?? (isCompleted ? '#22C55E' : '#8B5CF6')
  const showPercentage = config.showPercentage !== false
  const showAmount = config.showAmount !== false
  const isHorizontal = config.layout === 'horizontal'

  return (
    <div
      className={`relative ${isHorizontal ? 'flex items-center gap-4' : 'flex flex-col gap-2'}`}
      style={{ color: textColor }}
    >
      {/* Title */}
      <div
        className="font-bold drop-shadow-lg whitespace-nowrap"
        style={{ fontSize }}
      >
        {goal.title}
      </div>

      {/* Progress bar */}
      <div className={`${isHorizontal ? 'flex-1 min-w-[200px]' : 'w-full'}`}>
        <div className="h-6 bg-black/40 rounded-full overflow-hidden border border-white/10">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="h-full rounded-full relative"
            style={{ backgroundColor: barColor }}
          >
            {showPercentage && progress > 10 && (
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white drop-shadow">
                {progress}%
              </span>
            )}
          </motion.div>
        </div>
        {showAmount && (
          <div className="flex justify-between text-sm mt-1 opacity-80">
            <span>{formatCents(goal.currentCents)}</span>
            <span>{formatCents(goal.targetCents)}</span>
          </div>
        )}
      </div>

      {/* Celebration animation */}
      <AnimatePresence>
        {celebrating && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div className="text-4xl font-bold text-yellow-400 animate-bounce drop-shadow-lg">
              META ALCANCADA!
            </div>
            {/* CSS-based confetti */}
            <div className="absolute inset-0 overflow-hidden">
              {confettiParticles.map((p, i) => (
                <motion.div
                  key={i}
                  initial={{
                    x: '50%',
                    y: '50%',
                    opacity: 1,
                    scale: 1,
                  }}
                  animate={{
                    x: p.x,
                    y: p.y,
                    opacity: 0,
                    scale: 0,
                    rotate: p.rotate,
                  }}
                  transition={{ duration: p.duration, ease: 'easeOut' }}
                  className="absolute w-3 h-3 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
