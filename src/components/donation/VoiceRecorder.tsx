'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, Square, Play, Pause, Trash2, RotateCcw, Loader2 } from 'lucide-react'

interface Props {
  maxDuration: number
  onRecorded: (url: string) => void
  onRemove: () => void
  existingUrl?: string | null
}

type RecordState = 'idle' | 'recording' | 'recorded' | 'uploading'

export default function VoiceRecorder({ maxDuration, onRecorded, onRemove, existingUrl }: Props) {
  const [state, setState] = useState<RecordState>(existingUrl ? 'recorded' : 'idle')
  const [elapsed, setElapsed] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const blobUrlRef = useRef<string | null>(existingUrl || null)

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    mediaRecorderRef.current = null
    chunksRef.current = []
  }, [])

  useEffect(() => {
    return () => {
      cleanup()
      if (audioRef.current) {
        audioRef.current.pause()
      }
    }
  }, [cleanup])

  const startRecording = async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg',
      })

      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
        blobUrlRef.current = URL.createObjectURL(blob)
        uploadVoice(blob)
      }

      mediaRecorderRef.current = recorder
      recorder.start(100)
      setState('recording')
      setElapsed(0)

      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          if (prev + 1 >= maxDuration) {
            stopRecording()
            return maxDuration
          }
          return prev + 1
        })
      }, 1000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao acessar microfone'
      setError(msg)
    }
  }

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }

  const uploadVoice = async (blob: Blob) => {
    setState('uploading')
    try {
      const formData = new FormData()
      formData.append('audio', blob, 'voice.webm')
      const res = await fetch('/api/upload/voice-message', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload falhou')
      onRecorded(data.url)
      setState('recorded')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro no upload'
      setError(msg)
      setState('idle')
    }
  }

  const togglePlayback = () => {
    if (!blobUrlRef.current) return
    if (!audioRef.current) {
      audioRef.current = new Audio(blobUrlRef.current)
      audioRef.current.onended = () => setIsPlaying(false)
    }
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }

  const handleDelete = () => {
    cleanup()
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    blobUrlRef.current = null
    setState('idle')
    setElapsed(0)
    setIsPlaying(false)
    onRemove()
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm text-zinc-400">Mensagem de voz</label>

      {state === 'idle' && (
        <button
          type="button"
          onClick={startRecording}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 hover:border-purple-500 transition-colors"
        >
          <Mic className="w-4 h-4" />
          Gravar mensagem de voz
        </button>
      )}

      {state === 'recording' && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          <span className="text-red-400 text-sm font-mono">
            {formatTime(elapsed)} / {formatTime(maxDuration)}
          </span>
          {/* Simple waveform visualization */}
          <div className="flex items-center gap-0.5 flex-1">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="w-1 bg-red-400 rounded-full animate-pulse"
                style={{
                  height: `${Math.random() * 16 + 4}px`,
                  animationDelay: `${i * 50}ms`,
                }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={stopRecording}
            className="p-2 bg-red-500 rounded-full text-white hover:bg-red-600"
          >
            <Square className="w-4 h-4" />
          </button>
        </div>
      )}

      {state === 'uploading' && (
        <div className="flex items-center gap-2 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Enviando...
        </div>
      )}

      {state === 'recorded' && (
        <div className="flex items-center gap-2 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg">
          <button type="button" onClick={togglePlayback} className="p-1 text-purple-400 hover:text-purple-300">
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <span className="text-sm text-zinc-300">Audio gravado ({formatTime(elapsed)})</span>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => { handleDelete(); startRecording() }}
              className="p-1 text-zinc-500 hover:text-zinc-300"
              title="Regravar"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="p-1 text-zinc-500 hover:text-red-400"
              title="Remover"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  )
}
