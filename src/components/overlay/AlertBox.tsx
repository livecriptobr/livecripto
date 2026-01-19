'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  alert: {
    id: string
    donorName: string
    amountCents: number
    message: string
    audioUrl?: string
    durationMs: number
  }
  onFinish: () => void
  audioRef: React.RefObject<HTMLAudioElement | null>
}

export default function AlertBox({ alert, onFinish, audioRef }: Props) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    // Play audio if exists
    if (alert.audioUrl && audioRef.current) {
      audioRef.current.src = alert.audioUrl
      audioRef.current.play().catch(console.error)
    }

    // Auto-hide after duration
    const timer = setTimeout(() => {
      setVisible(false)
    }, alert.durationMs)

    return () => clearTimeout(timer)
  }, [alert, audioRef])

  useEffect(() => {
    if (!visible) {
      const exitTimer = setTimeout(onFinish, 600)
      return () => clearTimeout(exitTimer)
    }
  }, [visible, onFinish])

  const formattedAmount = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(alert.amountCents / 100)

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: -50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -50 }}
          transition={{ type: 'spring', damping: 15, stiffness: 300 }}
          className="fixed top-8 left-1/2 -translate-x-1/2 w-[420px] max-w-[90vw]"
        >
          <div className="relative overflow-hidden bg-gradient-to-br from-purple-600 to-violet-800 rounded-2xl p-6 shadow-2xl border border-white/20">
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/10 pointer-events-none" />

            <div className="relative text-center">
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-white/80 text-sm uppercase tracking-widest mb-2"
              >
                Nova doacao!
              </motion.p>

              <motion.h2
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="text-2xl font-bold text-white mb-3"
              >
                {alert.donorName}
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                className="text-4xl font-extrabold text-yellow-300 mb-4 drop-shadow-lg"
              >
                {formattedAmount}
              </motion.p>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-white text-lg max-h-28 overflow-y-auto scrollbar-hide"
              >
                {alert.message}
              </motion.p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
