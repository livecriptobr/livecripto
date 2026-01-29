'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Wifi,
  WifiOff,
  ExternalLink,
  Monitor,
  Keyboard,
  Instagram,
  Loader2,
} from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface Verification {
  id: string
  type: string
  status: string
  externalId: string | null
  externalName: string | null
}

interface StatusResponse {
  verifications: Verification[]
}

function TwitchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
    </svg>
  )
}

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}

export default function ConnectionsPage() {
  const searchParams = useSearchParams()
  const [toast, setToast] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)

  const { data, isLoading, mutate } = useSWR<StatusResponse>(
    '/api/verification/status',
    fetcher
  )

  const verifications = data?.verifications ?? []

  const getVerification = (type: string): Verification | undefined =>
    verifications.find(v => v.type === type && v.status === 'approved')

  const twitchConn = getVerification('twitch')
  const youtubeConn = getVerification('youtube')

  useEffect(() => {
    const connected = searchParams.get('connected')
    if (connected) {
      const names: Record<string, string> = {
        twitch: 'Twitch',
        youtube: 'YouTube',
      }
      setToast(`${names[connected] ?? connected} conectado com sucesso!`)
      const timer = setTimeout(() => setToast(null), 4000)
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname)
      return () => clearTimeout(timer)
    }
  }, [searchParams])

  async function handleDisconnect(platform: string) {
    setDisconnecting(platform)
    try {
      const res = await fetch(`/api/verification/social/${platform}/disconnect`, {
        method: 'POST',
      })
      if (res.ok) {
        await mutate()
        setToast(`${platform === 'twitch' ? 'Twitch' : 'YouTube'} desconectado.`)
        setTimeout(() => setToast(null), 4000)
      }
    } finally {
      setDisconnecting(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Conexoes</h1>
        <p className="text-zinc-400 mt-1">
          Gerencie suas conexoes com plataformas externas
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-green-400 text-sm"
        >
          {toast}
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Twitch */}
        <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20">
              <TwitchIcon className="h-5 w-5 text-purple-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white">Twitch</h3>
              <p className="text-xs text-zinc-400">Streaming ao vivo</p>
            </div>
            {twitchConn && (
              <span className="rounded-full bg-green-500/20 px-2.5 py-0.5 text-xs font-medium text-green-400">
                Conectado
              </span>
            )}
          </div>
          {twitchConn ? (
            <div className="space-y-3">
              <p className="text-sm text-zinc-300">
                <Wifi className="inline h-3.5 w-3.5 mr-1 text-green-400" />
                {twitchConn.externalName ?? twitchConn.externalId}
              </p>
              <button
                onClick={() => handleDisconnect('twitch')}
                disabled={disconnecting === 'twitch'}
                className="w-full rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400 hover:bg-red-500/20 transition disabled:opacity-50"
              >
                {disconnecting === 'twitch' ? (
                  <Loader2 className="inline h-4 w-4 animate-spin mr-1" />
                ) : (
                  <WifiOff className="inline h-4 w-4 mr-1" />
                )}
                Desconectar
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-zinc-400">
                Conecte sua conta Twitch para receber doacoes durante as lives.
              </p>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href="/api/verification/social/twitch"
                className="block w-full rounded-lg bg-purple-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-purple-700 transition"
              >
                Conectar Twitch
              </a>
            </div>
          )}
        </div>

        {/* YouTube */}
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/20">
              <YouTubeIcon className="h-5 w-5 text-red-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white">YouTube</h3>
              <p className="text-xs text-zinc-400">Streaming e videos</p>
            </div>
            {youtubeConn && (
              <span className="rounded-full bg-green-500/20 px-2.5 py-0.5 text-xs font-medium text-green-400">
                Conectado
              </span>
            )}
          </div>
          {youtubeConn ? (
            <div className="space-y-3">
              <p className="text-sm text-zinc-300">
                <Wifi className="inline h-3.5 w-3.5 mr-1 text-green-400" />
                {youtubeConn.externalName ?? youtubeConn.externalId}
              </p>
              <button
                onClick={() => handleDisconnect('youtube')}
                disabled={disconnecting === 'youtube'}
                className="w-full rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400 hover:bg-red-500/20 transition disabled:opacity-50"
              >
                {disconnecting === 'youtube' ? (
                  <Loader2 className="inline h-4 w-4 animate-spin mr-1" />
                ) : (
                  <WifiOff className="inline h-4 w-4 mr-1" />
                )}
                Desconectar
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-zinc-400">
                Conecte sua conta YouTube para receber doacoes durante as lives.
              </p>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href="/api/verification/social/youtube"
                className="block w-full rounded-lg bg-red-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-red-700 transition"
              >
                Conectar YouTube
              </a>
            </div>
          )}
        </div>

        {/* Instagram */}
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-6 space-y-4 opacity-60">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-700">
              <Instagram className="h-5 w-5 text-zinc-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white">Instagram</h3>
              <p className="text-xs text-zinc-400">Rede social</p>
            </div>
            <span className="rounded-full bg-zinc-700 px-2.5 py-0.5 text-xs font-medium text-zinc-400">
              Em breve
            </span>
          </div>
          <p className="text-sm text-zinc-500">
            Integracao com Instagram estara disponivel em breve.
          </p>
          <button
            disabled
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-500 cursor-not-allowed"
          >
            Conectar Instagram
          </button>
        </div>

        {/* OBS Studio */}
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20">
              <Monitor className="h-5 w-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white">OBS Studio</h3>
              <p className="text-xs text-zinc-400">Software de streaming</p>
            </div>
          </div>
          <p className="text-sm text-zinc-400">
            Adicione widgets como Fonte &gt; Navegador no OBS para exibir alertas e metas na sua live.
          </p>
          <Link
            href="/dashboard/widgets"
            className="flex items-center justify-center gap-2 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
          >
            <ExternalLink className="h-4 w-4" />
            Ver Widgets
          </Link>
        </div>

        {/* StreamDeck */}
        <div className="rounded-xl border border-zinc-600 bg-zinc-900/50 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-700">
              <Keyboard className="h-5 w-5 text-zinc-300" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white">StreamDeck</h3>
              <p className="text-xs text-zinc-400">Controle por hardware</p>
            </div>
          </div>
          <p className="text-sm text-zinc-400">
            Configure acoes no StreamDeck via API para controlar alertas e funcionalidades.
          </p>
          <Link
            href="/dashboard/controls"
            className="flex items-center justify-center gap-2 w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700 transition"
          >
            <ExternalLink className="h-4 w-4" />
            Ver Controles
          </Link>
        </div>
      </div>
    </div>
  )
}
