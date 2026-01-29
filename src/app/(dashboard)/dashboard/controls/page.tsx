'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Play, Pause, SkipForward, RotateCcw, Volume2, VolumeX,
  ChevronUp, ChevronDown, Trash2, RefreshCw, Key, Copy,
  Loader2, Bell, Film, Music, Keyboard, Plus, X
} from 'lucide-react'
import { useKeyboardShortcuts, getShortcutForAction } from '@/hooks/useKeyboardShortcuts'
import type { ControlSection, ControlAction } from '@/lib/control-commands'
import useSWR, { mutate as swrMutate } from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface ApiKeyItem {
  id: string
  label: string
  keyPrefix: string
  lastUsed: string | null
  createdAt: string
}

interface ActionButton {
  action: ControlAction
  label: string
  icon: React.ReactNode
  color: string
}

const ACTIONS: ActionButton[] = [
  { action: 'toggle_autoplay', label: 'Autoplay', icon: <Play className="w-5 h-5" />, color: 'text-blue-400' },
  { action: 'pause', label: 'Pausar', icon: <Pause className="w-5 h-5" />, color: 'text-yellow-400' },
  { action: 'resume', label: 'Retomar', icon: <Play className="w-5 h-5" />, color: 'text-green-400' },
  { action: 'skip', label: 'Pular', icon: <SkipForward className="w-5 h-5" />, color: 'text-orange-400' },
  { action: 'replay', label: 'Replay', icon: <RotateCcw className="w-5 h-5" />, color: 'text-purple-400' },
  { action: 'mute', label: 'Mudo', icon: <VolumeX className="w-5 h-5" />, color: 'text-red-400' },
  { action: 'unmute', label: 'Demutar', icon: <Volume2 className="w-5 h-5" />, color: 'text-emerald-400' },
  { action: 'volume_up', label: 'Vol +', icon: <ChevronUp className="w-5 h-5" />, color: 'text-cyan-400' },
  { action: 'volume_down', label: 'Vol -', icon: <ChevronDown className="w-5 h-5" />, color: 'text-cyan-400' },
  { action: 'clear_queue', label: 'Limpar', icon: <Trash2 className="w-5 h-5" />, color: 'text-red-500' },
]

const SECTIONS: { key: ControlSection; label: string; icon: React.ReactNode; color: string }[] = [
  { key: 'alerts', label: 'Alertas', icon: <Bell className="w-5 h-5" />, color: 'border-yellow-500' },
  { key: 'video', label: 'Video', icon: <Film className="w-5 h-5" />, color: 'border-blue-500' },
  { key: 'music', label: 'Musica', icon: <Music className="w-5 h-5" />, color: 'border-purple-500' },
]

export default function ControlsPage() {
  const [loading, setLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [activeTab, setActiveTab] = useState<ControlSection>('alerts')
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)
  const [keyLabel, setKeyLabel] = useState('StreamDeck')

  const { data: keysData } = useSWR<{ keys: ApiKeyItem[] }>('/api/controls/api-key', fetcher)

  const sendCommand = useCallback(async (section: ControlSection, action: ControlAction) => {
    const key = `${section}-${action}`
    setLoading(key)
    setMessage(null)
    try {
      const res = await fetch('/api/controls/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, action }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Falha ao enviar comando')
      }
      setMessage({ type: 'success', text: `${action} enviado para ${section}` })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro'
      setMessage({ type: 'error', text: msg })
    } finally {
      setLoading(null)
    }
  }, [])

  const { shortcuts } = useKeyboardShortcuts({
    enabled: true,
    onCommand: sendCommand,
  })

  const handleGenerateKey = async () => {
    setLoading('generate-key')
    try {
      const res = await fetch('/api/controls/api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: keyLabel }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setGeneratedKey(data.key as string)
      swrMutate('/api/controls/api-key')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro'
      setMessage({ type: 'error', text: msg })
    } finally {
      setLoading(null)
    }
  }

  const handleRevokeKey = async (id: string) => {
    setLoading(`revoke-${id}`)
    try {
      const res = await fetch('/api/controls/api-key', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      swrMutate('/api/controls/api-key')
      setMessage({ type: 'success', text: 'Chave revogada' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro'
      setMessage({ type: 'error', text: msg })
    } finally {
      setLoading(null)
    }
  }

  const handleRotateAll = async () => {
    if (!confirm('Isso invalidara todos os tokens de widgets e overlay. Continuar?')) return
    setLoading('rotate-all')
    try {
      const res = await fetch('/api/widgets/rotate-all-tokens', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      setMessage({ type: 'success', text: 'Todos os tokens foram rotacionados. Atualize seus widgets no OBS.' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro'
      setMessage({ type: 'error', text: msg })
    } finally {
      setLoading(null)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setMessage({ type: 'success', text: 'Copiado!' })
  }

  // Clear message after 3s
  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(null), 3000)
    return () => clearTimeout(t)
  }, [message])

  const renderSection = (section: ControlSection) => (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {ACTIONS.map((btn) => {
        const key = `${section}-${btn.action}`
        const shortcut = getShortcutForAction(shortcuts, section, btn.action)
        return (
          <motion.button
            key={key}
            whileTap={{ scale: 0.92 }}
            onClick={() => sendCommand(section, btn.action)}
            disabled={loading !== null}
            className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl p-4 text-center transition-colors disabled:opacity-50 relative group"
          >
            {loading === key ? (
              <Loader2 className={`w-5 h-5 mx-auto mb-2 animate-spin ${btn.color}`} />
            ) : (
              <span className={`block mx-auto mb-2 ${btn.color}`}>{btn.icon}</span>
            )}
            <span className="text-sm font-medium">{btn.label}</span>
            {shortcut && (
              <span className="block text-[10px] text-zinc-500 mt-1 font-mono">
                {shortcut}
              </span>
            )}
          </motion.button>
        )
      })}
    </div>
  )

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Controles Remotos</h1>
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Keyboard className="w-4 h-4" />
          Atalhos ativos
        </div>
      </div>

      {/* Toast */}
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
          }`}
        >
          {message.text}
        </motion.div>
      )}

      {/* Desktop: 3 columns, Mobile: tabs */}
      <div className="md:hidden flex border-b border-zinc-800 mb-4">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveTab(s.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === s.key
                ? `${s.color} text-white`
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            {s.icon}
            {s.label}
          </button>
        ))}
      </div>

      {/* Mobile: single section */}
      <div className="md:hidden">
        {renderSection(activeTab)}
      </div>

      {/* Desktop: all 3 sections */}
      <div className="hidden md:grid md:grid-cols-3 gap-6">
        {SECTIONS.map((s) => (
          <div key={s.key} className={`border-t-2 ${s.color} pt-4`}>
            <div className="flex items-center gap-2 mb-4">
              {s.icon}
              <h2 className="text-lg font-semibold">{s.label}</h2>
            </div>
            {renderSection(s.key)}
          </div>
        ))}
      </div>

      {/* API Key Management */}
      <div className="border border-zinc-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Key className="w-5 h-5 text-violet-400" />
          <h2 className="text-xl font-semibold">Chaves de API (StreamDeck)</h2>
        </div>

        <p className="text-sm text-zinc-400">
          Gere chaves para integrar com StreamDeck, scripts externos ou automacoes.
          Use o endpoint <code className="bg-zinc-800 px-1 rounded">POST /api/controls/webhook</code> com o header <code className="bg-zinc-800 px-1 rounded">X-API-Key</code>.
        </p>

        {/* Generate */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={keyLabel}
            onChange={(e) => setKeyLabel(e.target.value)}
            placeholder="Label (ex: StreamDeck)"
            className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm flex-1"
          />
          <button
            onClick={handleGenerateKey}
            disabled={loading === 'generate-key'}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 whitespace-nowrap"
          >
            {loading === 'generate-key' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Gerar Chave
          </button>
        </div>

        {/* Show generated key once */}
        {generatedKey && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <p className="text-sm text-green-400 mb-2 font-medium">Chave gerada! Copie agora - ela nao sera exibida novamente.</p>
            <div className="flex items-center gap-2">
              <code className="bg-zinc-900 px-3 py-2 rounded text-sm flex-1 break-all">{generatedKey}</code>
              <button onClick={() => copyToClipboard(generatedKey)} className="text-green-400 hover:text-green-300">
                <Copy className="w-5 h-5" />
              </button>
              <button onClick={() => setGeneratedKey(null)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Key List */}
        {keysData?.keys && keysData.keys.length > 0 && (
          <div className="space-y-2">
            {keysData.keys.map((k) => (
              <div key={k.id} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
                <div>
                  <span className="font-medium text-sm">{k.label}</span>
                  <span className="text-zinc-500 text-xs ml-2 font-mono">{k.keyPrefix}...</span>
                  {k.lastUsed && (
                    <span className="text-zinc-500 text-xs ml-3">
                      Ultimo uso: {new Date(k.lastUsed).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleRevokeKey(k.id)}
                  disabled={loading === `revoke-${k.id}`}
                  className="text-red-400 hover:text-red-300 text-sm disabled:opacity-50"
                >
                  {loading === `revoke-${k.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Revogar'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* StreamDeck Instructions */}
        <details className="mt-4">
          <summary className="text-sm text-zinc-400 cursor-pointer hover:text-white">
            Como configurar no StreamDeck
          </summary>
          <div className="mt-3 text-sm text-zinc-400 space-y-2 pl-4">
            <p>1. Instale o plugin &quot;API Ninja&quot; ou &quot;HTTP Request&quot; no StreamDeck.</p>
            <p>2. Configure uma acao com metodo <strong>POST</strong>.</p>
            <p>3. URL: <code className="bg-zinc-800 px-1 rounded">https://seu-dominio.com/api/controls/webhook</code></p>
            <p>4. Header: <code className="bg-zinc-800 px-1 rounded">X-API-Key: sua_chave_aqui</code></p>
            <p>5. Body (JSON):</p>
            <pre className="bg-zinc-900 p-3 rounded-lg overflow-x-auto">
{`{
  "section": "alerts",
  "action": "skip"
}`}
            </pre>
            <p>Acoes disponiveis: toggle_autoplay, pause, resume, skip, replay, mute, unmute, volume_up, volume_down, clear_queue</p>
            <p>Secoes: alerts, video, music</p>
          </div>
        </details>
      </div>

      {/* Rotate All Tokens */}
      <div className="border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-red-400" />
              Trocar Todos os Tokens
            </h2>
            <p className="text-sm text-zinc-400 mt-1">
              Rotaciona tokens de todos os widgets e overlay. Sera necessario atualizar URLs no OBS.
            </p>
          </div>
          <button
            onClick={handleRotateAll}
            disabled={loading === 'rotate-all'}
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {loading === 'rotate-all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Rotacionar
          </button>
        </div>
      </div>
    </div>
  )
}
