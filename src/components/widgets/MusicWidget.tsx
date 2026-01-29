'use client'

import { useEffect, useState, useRef, useCallback } from 'react'

interface QueueItem {
  id: string
  donorName: string
  amountCents: number
  videoId: string
  message: string
}

interface MusicConfig {
  maxDuration?: number
  minAmountCents?: number
  showQueue?: boolean
}

interface MusicWidgetProps {
  widgetId: string
  token: string
  config: MusicConfig
}

export default function MusicWidget({ widgetId, token, config }: MusicWidgetProps) {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const playerRef = useRef<HTMLDivElement>(null)
  const ytPlayerRef = useRef<YT.Player | null>(null)
  const [playerReady, setPlayerReady] = useState(false)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const res = await fetch(`/api/widgets/${widgetId}/data?token=${token}`)
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { queue: QueueItem[] }
        if (!cancelled) setQueue(data.queue)
      } catch { /* silent */ }
    }
    poll()
    const interval = setInterval(poll, 15000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [widgetId, token])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (document.getElementById('yt-iframe-api')) {
      const w = window as unknown as { YT?: typeof YT }
      if (w.YT?.Player) {
        requestAnimationFrame(() => setPlayerReady(true))
      }
      return
    }
    const tag = document.createElement('script')
    tag.id = 'yt-iframe-api'
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
    const w = window as unknown as { onYouTubeIframeAPIReady?: () => void }
    w.onYouTubeIframeAPIReady = () => setPlayerReady(true)
    return () => { w.onYouTubeIframeAPIReady = undefined }
  }, [])

  const startProgressTracking = useCallback(() => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
    progressIntervalRef.current = setInterval(() => {
      if (ytPlayerRef.current) {
        const ct = ytPlayerRef.current.getCurrentTime?.() ?? 0
        const dur = ytPlayerRef.current.getDuration?.() ?? 0
        setProgress(ct)
        setDuration(dur)
      }
    }, 500)
  }, [])

  const playVideo = useCallback((videoId: string) => {
    if (!playerRef.current) return
    const w = window as unknown as { YT?: typeof YT }
    if (!w.YT) return

    if (ytPlayerRef.current) {
      ytPlayerRef.current.loadVideoById({ videoId, endSeconds: config.maxDuration ?? 300 })
      startProgressTracking()
    } else {
      ytPlayerRef.current = new w.YT.Player(playerRef.current, {
        videoId,
        width: 1,
        height: 1,
        playerVars: {
          autoplay: 1,
          controls: 0,
          end: config.maxDuration ?? 300,
        },
        events: {
          onReady: () => startProgressTracking(),
          onStateChange: (e: YT.OnStateChangeEvent) => {
            if (e.data === 0) {
              setCurrentIndex(prev => prev + 1)
            }
          },
        },
      })
    }
  }, [config.maxDuration, startProgressTracking])

  useEffect(() => {
    if (!playerReady || queue.length === 0) return
    const item = queue[currentIndex]
    if (!item) return
    playVideo(item.videoId)
  }, [currentIndex, queue, playerReady, playVideo])

  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
    }
  }, [])

  const current = queue[currentIndex]
  const progressPct = duration > 0 ? (progress / duration) * 100 : 0

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="p-4 space-y-3">
      {/* Hidden player */}
      <div className="absolute -top-[9999px]"><div ref={playerRef} /></div>

      {/* Now playing */}
      {current ? (
        <div className="bg-black/50 backdrop-blur-sm rounded-xl p-4 space-y-2">
          <div className="text-white/50 text-xs uppercase tracking-wider">Tocando agora</div>
          <div className="text-white font-semibold truncate">{current.message}</div>
          <div className="text-white/60 text-sm">
            pedido por <span className="text-white/80 font-medium">{current.donorName}</span>
          </div>
          <div className="space-y-1">
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex justify-between text-white/40 text-xs">
              <span>{formatTime(progress)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-white/40 text-center py-8">Nenhuma musica na fila</div>
      )}

      {/* Queue */}
      {config.showQueue !== false && queue.length > currentIndex + 1 && (
        <div className="space-y-1">
          <div className="text-white/40 text-xs uppercase tracking-wider px-1">Fila</div>
          {queue.slice(currentIndex + 1, currentIndex + 6).map((item, i) => (
            <div key={item.id} className="flex items-center gap-2 px-3 py-1.5 rounded bg-white/5 text-sm">
              <span className="text-white/30 w-5">{i + 1}</span>
              <span className="text-white/80 flex-1 truncate">{item.message}</span>
              <span className="text-white/40 text-xs">{item.donorName}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
