'use client'

import { useState } from 'react'
import { SkipForward, RotateCcw, RefreshCw, Loader2 } from 'lucide-react'

export default function ControlsPage() {
  const [loading, setLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleAction = async (action: 'skip' | 'replay' | 'rotate') => {
    setLoading(action)
    setMessage(null)

    try {
      let endpoint = ''
      if (action === 'skip') endpoint = '/api/private/alerts/skip-current'
      else if (action === 'replay') endpoint = '/api/private/alerts/replay'
      else if (action === 'rotate') endpoint = '/api/private/rotate-token'

      const res = await fetch(endpoint, { method: 'POST' })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      setMessage({ type: 'success', text: getSuccessMessage(action) })
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido'
      setMessage({ type: 'error', text: errorMessage })
    } finally {
      setLoading(null)
    }
  }

  const getSuccessMessage = (action: string) => {
    switch (action) {
      case 'skip': return 'Alerta pulado!'
      case 'replay': return 'Alerta reenviado para a fila!'
      case 'rotate': return 'Token rotacionado! Atualize o overlay no OBS.'
      default: return 'Acao concluida!'
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Controles ao Vivo</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button
          onClick={() => handleAction('skip')}
          disabled={loading !== null}
          className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl p-6 text-center transition-colors disabled:opacity-50"
        >
          {loading === 'skip' ? (
            <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-yellow-500" />
          ) : (
            <SkipForward className="w-8 h-8 mx-auto mb-3 text-yellow-500" />
          )}
          <h3 className="font-semibold mb-1">Pular Alerta</h3>
          <p className="text-sm text-zinc-400">Pula o alerta atual no overlay</p>
        </button>

        <button
          onClick={() => handleAction('replay')}
          disabled={loading !== null}
          className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl p-6 text-center transition-colors disabled:opacity-50"
        >
          {loading === 'replay' ? (
            <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-green-500" />
          ) : (
            <RotateCcw className="w-8 h-8 mx-auto mb-3 text-green-500" />
          )}
          <h3 className="font-semibold mb-1">Reexibir Ultimo</h3>
          <p className="text-sm text-zinc-400">Exibe novamente o ultimo alerta</p>
        </button>

        <button
          onClick={() => handleAction('rotate')}
          disabled={loading !== null}
          className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl p-6 text-center transition-colors disabled:opacity-50"
        >
          {loading === 'rotate' ? (
            <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-red-500" />
          ) : (
            <RefreshCw className="w-8 h-8 mx-auto mb-3 text-red-500" />
          )}
          <h3 className="font-semibold mb-1">Rotacionar Token</h3>
          <p className="text-sm text-zinc-400">Invalida o token atual do overlay</p>
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
        }`}>
          {message.text}
        </div>
      )}
    </div>
  )
}
