'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import type { ControlCommand } from '@/lib/control-commands'

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
  const [, setAutoplay] = useState(true)
  const [, setPaused] = useState(false)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(80)

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

  // SSE control stream
  useEffect(() => {
    const es = new EventSource(`/api/controls/stream?token=${token}`)

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { type?: string; command?: ControlCommand }
        if (data.type === 'init') return
        const cmd = data.command
        if (!cmd || cmd.section !== 'video') return

        switch (cmd.action) {
          case 'toggle_autoplay':
            setAutoplay(prev => !prev)
            break
          case 'pause':
            setPaused(true)
            ytPlayerRef.current?.pauseVideo?.()
            break
          case 'resume':
            setPaused(false)
            ytPlayerRef.current?.playVideo?.()
            break
          case 'skip':
            setCurrentIndex(prev => prev + 1)
            break
          case 'mute':
            setMuted(true)
            ytPlayerRef.current?.mute?.()
            break
          case 'unmute':
            setMuted(false)
            ytPlayerRef.current?.unMute?.()
            break
          case 'volume_up':
            setVolume(prev => {
              const v = Math.min(100, prev + 10)
              ytPlayerRef.current?.setVolume?.(v)
              return v
            })
            break
          case 'volume_down':
            setVolume(prev => {
              const v = Math.max(0, prev - 10)
              ytPlayerRef.current?.setVolume?.(v)
              return v
            })
            break
          case 'clear_queue':
            setQueue([])
            setCurrentIndex(0)
            break
        }
      } catch { /* silent */ }
    }

    return () => es.close()
  }, [token])

  // Sync volume/mute to player
  useEffect(() => {
    if (ytPlayerRef.current) {
      ytPlayerRef.current.setVolume?.(volume)
      if (muted) ytPlayerRef.current.mute?.()
      else ytPlayerRef.current.unMute?.()
    }
  }, [volume, muted])

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
