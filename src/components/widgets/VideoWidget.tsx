'use client'

import { useEffect, useState, useRef, useCallback } from 'react'

interface QueueItem {
  id: string
  donorName: string
  amountCents: number
  videoId: string
  message: string
}

interface VideoConfig {
  maxDuration?: number
  minAmountCents?: number
  autoplay?: boolean
}

interface VideoWidgetProps {
  widgetId: string
  token: string
  config: VideoConfig
}

export default function VideoWidget({ widgetId, token, config }: VideoWidgetProps) {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const playerRef = useRef<HTMLDivElement>(null)
  const ytPlayerRef = useRef<YT.Player | null>(null)
  const [playerReady, setPlayerReady] = useState(false)

  // Fetch queue
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

  // Load YouTube IFrame API
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (document.getElementById('yt-iframe-api')) return

    const tag = document.createElement('script')
    tag.id = 'yt-iframe-api'
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)

    const w = window as unknown as { onYouTubeIframeAPIReady?: () => void }
    w.onYouTubeIframeAPIReady = () => setPlayerReady(true)

    return () => { w.onYouTubeIframeAPIReady = undefined }
  }, [])

  const playVideo = useCallback((videoId: string) => {
    if (!playerRef.current) return
    const w = window as unknown as { YT?: typeof YT }
    if (!w.YT) return

    if (ytPlayerRef.current) {
      ytPlayerRef.current.loadVideoById({ videoId, endSeconds: config.maxDuration ?? 300 })
    } else {
      ytPlayerRef.current = new w.YT.Player(playerRef.current, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 1,
          controls: 1,
          end: config.maxDuration ?? 300,
        },
        events: {
          onStateChange: (e: YT.OnStateChangeEvent) => {
            if (e.data === 0) { // ended
              setCurrentIndex(prev => prev + 1)
            }
          },
        },
      })
    }
  }, [config.maxDuration])

  // Play current video
  useEffect(() => {
    if (!playerReady || queue.length === 0) return
    const item = queue[currentIndex]
    if (!item) return
    playVideo(item.videoId)
  }, [currentIndex, queue, playerReady, playVideo])

  const current = queue[currentIndex]

  return (
    <div className="w-full h-screen flex flex-col bg-transparent">
      <div className="flex-1 relative">
        <div ref={playerRef} className="w-full h-full" />
      </div>
      {current && (
        <div className="bg-black/60 text-white px-4 py-2 flex items-center gap-3">
          <span className="font-semibold">{current.donorName}</span>
          <span className="text-white/50 text-sm">
            R$ {(current.amountCents / 100).toFixed(2).replace('.', ',')}
          </span>
          <span className="text-white/40 text-xs ml-auto">
            {currentIndex + 1}/{queue.length}
          </span>
        </div>
      )}
    </div>
  )
}
