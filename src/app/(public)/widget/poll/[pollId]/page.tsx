'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

interface PollOption {
  id: string
  text: string
  color: string
  voteCount: number
  voteWeight: number
}

interface PollData {
  id: string
  title: string
  voteType: 'UNIQUE' | 'WEIGHTED'
  status: 'ACTIVE' | 'PAUSED' | 'CLOSED'
  expiresAt: string | null
  totalVotes: number
  options: PollOption[]
}

function getPercentage(option: PollOption, poll: PollData): number {
  const total = poll.voteType === 'WEIGHTED'
    ? poll.options.reduce((s, o) => s + o.voteWeight, 0)
    : poll.totalVotes
  if (total === 0) return 0
  const value = poll.voteType === 'WEIGHTED' ? option.voteWeight : option.voteCount
  return Math.round((value / total) * 100)
}

function Countdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState('')

  useEffect(() => {
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now()
      if (diff <= 0) {
        setRemaining('00:00')
        return
      }
      const mins = Math.floor(diff / 60000)
      const secs = Math.floor((diff % 60000) / 1000)
      setRemaining(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`)
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [expiresAt])

  return <span className="text-white/60 text-sm font-mono">{remaining}</span>
}

export default function PollWidgetPage({ params }: { params: Promise<{ pollId: string }> }) {
  const [pollId, setPollId] = useState('')
  const [poll, setPoll] = useState<PollData | null>(null)

  useEffect(() => {
    params.then(p => setPollId(p.pollId))
  }, [params])

  useEffect(() => {
    if (!pollId) return
    let cancelled = false
    const doFetch = async () => {
      if (cancelled) return
      try {
        const res = await fetch(`/api/polls/${pollId}`)
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { poll: PollData }
        if (!cancelled) setPoll(data.poll)
      } catch {
        // silent
      }
    }
    doFetch()
    const interval = setInterval(doFetch, 3000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [pollId])

  if (!poll) return null

  const isClosed = poll.status === 'CLOSED'

  return (
    <div className="min-h-screen bg-transparent p-4 flex flex-col items-center justify-start">
      <div className="w-full max-w-lg space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-white text-xl font-bold drop-shadow-lg">{poll.title}</h2>
          <div className="flex items-center gap-3">
            {poll.expiresAt && !isClosed && <Countdown expiresAt={poll.expiresAt} />}
            <span className="text-white/50 text-xs">{poll.totalVotes} votos</span>
          </div>
        </div>

        {isClosed && (
          <div className="bg-red-600/80 text-white text-center py-2 rounded-lg font-semibold text-sm">
            Enquete encerrada
          </div>
        )}

        {/* Options */}
        <div className="space-y-2">
          {poll.options.map(opt => {
            const pct = getPercentage(opt, poll)
            return (
              <div key={opt.id} className="relative">
                <div className="flex justify-between text-white text-sm font-medium mb-1 drop-shadow">
                  <span>{opt.text}</span>
                  <span>{pct}% ({opt.voteCount})</span>
                </div>
                <div className="w-full h-8 bg-black/40 rounded-lg overflow-hidden backdrop-blur-sm">
                  <motion.div
                    className="h-full rounded-lg"
                    style={{ backgroundColor: opt.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
