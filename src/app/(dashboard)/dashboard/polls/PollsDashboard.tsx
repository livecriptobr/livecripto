'use client'

import { useState, useCallback } from 'react'
import useSWR from 'swr'
import { BarChart3, Plus, Pause, Play, XCircle, Trash2, Copy, Check } from 'lucide-react'

// --- Types ---

interface PollOption {
  id: string
  text: string
  color: string
  voteCount: number
  voteWeight: number
  sortOrder: number
}

interface Poll {
  id: string
  title: string
  voteType: 'UNIQUE' | 'WEIGHTED'
  status: 'ACTIVE' | 'PAUSED' | 'CLOSED'
  expiresAt: string | null
  showOnOverlay: boolean
  totalVotes: number
  createdAt: string
  options: PollOption[]
}

interface PollsResponse {
  polls: Poll[]
}

interface CreateOptionInput {
  text: string
  color: string
}

// --- Helpers ---

const fetcher = (url: string) => fetch(url).then(r => r.json()) as Promise<PollsResponse>

const COLORS = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6']

function getPercentage(option: PollOption, poll: Poll): number {
  const total = poll.voteType === 'WEIGHTED'
    ? poll.options.reduce((s, o) => s + o.voteWeight, 0)
    : poll.totalVotes
  if (total === 0) return 0
  const value = poll.voteType === 'WEIGHTED' ? option.voteWeight : option.voteCount
  return Math.round((value / total) * 100)
}

function getVoteDisplay(option: PollOption, poll: Poll): string {
  if (poll.voteType === 'WEIGHTED') {
    return `R$ ${(option.voteWeight / 100).toFixed(2)} (${option.voteCount} votos)`
  }
  return `${option.voteCount} votos`
}

// --- Components ---

function PollBar({ option, poll }: { option: PollOption; poll: Poll }) {
  const pct = getPercentage(option, poll)
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-zinc-200">{option.text}</span>
        <span className="text-zinc-400">{pct}% - {getVoteDisplay(option, poll)}</span>
      </div>
      <div className="w-full h-6 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: option.color }}
        />
      </div>
    </div>
  )
}

function PollCard({
  poll,
  onAction,
}: {
  poll: Poll
  onAction: (pollId: string, action: string, body?: Record<string, string>) => Promise<void>
}) {
  const [copied, setCopied] = useState(false)

  const widgetUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/widget/poll/${poll.id}`
    : ''

  const copyWidget = () => {
    navigator.clipboard.writeText(widgetUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">{poll.title}</h3>
          <div className="flex gap-2 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              poll.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400'
                : poll.status === 'PAUSED' ? 'bg-yellow-500/20 text-yellow-400'
                : 'bg-zinc-700 text-zinc-400'
            }`}>
              {poll.status === 'ACTIVE' ? 'Ativa' : poll.status === 'PAUSED' ? 'Pausada' : 'Encerrada'}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
              {poll.voteType === 'UNIQUE' ? 'Voto unico' : 'Voto ponderado'}
            </span>
            <span className="text-xs text-zinc-500">{poll.totalVotes} votos</span>
          </div>
        </div>
        <div className="flex gap-1">
          {poll.status !== 'CLOSED' && (
            <>
              {poll.status === 'ACTIVE' ? (
                <button
                  onClick={() => onAction(poll.id, 'PATCH', { status: 'PAUSED' })}
                  className="p-2 text-zinc-400 hover:text-yellow-400 transition-colors"
                  title="Pausar"
                >
                  <Pause className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => onAction(poll.id, 'PATCH', { status: 'ACTIVE' })}
                  className="p-2 text-zinc-400 hover:text-green-400 transition-colors"
                  title="Retomar"
                >
                  <Play className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => onAction(poll.id, 'PATCH', { status: 'CLOSED' })}
                className="p-2 text-zinc-400 hover:text-red-400 transition-colors"
                title="Encerrar"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            onClick={() => onAction(poll.id, 'DELETE')}
            className="p-2 text-zinc-400 hover:text-red-400 transition-colors"
            title="Excluir"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {poll.options.map(opt => (
          <PollBar key={opt.id} option={opt} poll={poll} />
        ))}
      </div>

      {poll.expiresAt && (
        <p className="text-xs text-zinc-500">
          Expira: {new Date(poll.expiresAt).toLocaleString('pt-BR')}
        </p>
      )}

      <div className="flex items-center gap-2">
        <input
          readOnly
          value={widgetUrl}
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-xs text-zinc-400"
        />
        <button onClick={copyWidget} className="p-1.5 text-zinc-400 hover:text-white transition-colors">
          {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

function CreatePollForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState('')
  const [voteType, setVoteType] = useState<'UNIQUE' | 'WEIGHTED'>('UNIQUE')
  const [expiresIn, setExpiresIn] = useState('')
  const [options, setOptions] = useState<CreateOptionInput[]>([
    { text: '', color: COLORS[0] },
    { text: '', color: COLORS[1] },
  ])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const addOption = () => {
    if (options.length >= 10) return
    setOptions([...options, { text: '', color: COLORS[options.length % COLORS.length] }])
  }

  const removeOption = (idx: number) => {
    if (options.length <= 2) return
    setOptions(options.filter((_, i) => i !== idx))
  }

  const updateOption = (idx: number, field: 'text' | 'color', value: string) => {
    const copy = [...options]
    copy[idx] = { ...copy[idx], [field]: value }
    setOptions(copy)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || options.some(o => !o.text.trim())) return

    setLoading(true)
    setError('')

    try {
      let expiresAt: string | undefined
      if (expiresIn) {
        const mins = parseInt(expiresIn, 10)
        if (mins > 0) {
          expiresAt = new Date(Date.now() + mins * 60000).toISOString()
        }
      }

      const res = await fetch('/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), voteType, expiresAt, options }),
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error || 'Erro ao criar enquete')
      }

      setTitle('')
      setOptions([
        { text: '', color: COLORS[0] },
        { text: '', color: COLORS[1] },
      ])
      setExpiresIn('')
      onCreated()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <Plus className="w-5 h-5" /> Criar Enquete
      </h3>

      <div>
        <label className="block text-sm text-zinc-400 mb-1">Titulo</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Qual jogo jogar?"
          maxLength={200}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:border-purple-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm text-zinc-400 mb-1">Tipo de voto</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setVoteType('UNIQUE')}
            className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
              voteType === 'UNIQUE'
                ? 'bg-purple-600/20 border-purple-500 text-purple-400'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400'
            }`}
          >
            Voto unico (1 por IP)
          </button>
          <button
            type="button"
            onClick={() => setVoteType('WEIGHTED')}
            className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
              voteType === 'WEIGHTED'
                ? 'bg-purple-600/20 border-purple-500 text-purple-400'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400'
            }`}
          >
            Ponderado (valor doacao)
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm text-zinc-400 mb-1">Expiracao (minutos, opcional)</label>
        <input
          type="number"
          value={expiresIn}
          onChange={e => setExpiresIn(e.target.value)}
          placeholder="Ex: 30"
          min={1}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:border-purple-500 focus:outline-none"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm text-zinc-400">Opcoes ({options.length}/10)</label>
        {options.map((opt, idx) => (
          <div key={idx} className="flex gap-2 items-center">
            <input
              type="color"
              value={opt.color}
              onChange={e => updateOption(idx, 'color', e.target.value)}
              className="w-10 h-10 rounded cursor-pointer bg-transparent border-0"
            />
            <input
              value={opt.text}
              onChange={e => updateOption(idx, 'text', e.target.value)}
              placeholder={`Opcao ${idx + 1}`}
              maxLength={100}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:border-purple-500 focus:outline-none"
            />
            {options.length > 2 && (
              <button
                type="button"
                onClick={() => removeOption(idx)}
                className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        {options.length < 10 && (
          <button
            type="button"
            onClick={addOption}
            className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
          >
            + Adicionar opcao
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !title.trim() || options.some(o => !o.text.trim())}
        className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white py-3 rounded-lg font-semibold transition-colors"
      >
        {loading ? 'Criando...' : 'Criar Enquete'}
      </button>
    </form>
  )
}

// --- Main ---

export default function PollsDashboard({ username }: { username: string }) {
  void username // available for future widget URL generation

  const { data, mutate } = useSWR<PollsResponse>('/api/polls', fetcher, {
    refreshInterval: 5000,
  })

  const polls = data?.polls || []
  const activePolls = polls.filter(p => p.status === 'ACTIVE' || p.status === 'PAUSED')
  const closedPolls = polls.filter(p => p.status === 'CLOSED')

  const handleAction = useCallback(async (pollId: string, action: string, body?: Record<string, string>) => {
    if (action === 'DELETE') {
      if (!confirm('Tem certeza que deseja excluir esta enquete?')) return
      await fetch(`/api/polls/${pollId}`, { method: 'DELETE' })
    } else if (action === 'PATCH') {
      await fetch(`/api/polls/${pollId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    }
    await mutate()
  }, [mutate])

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <BarChart3 className="w-7 h-7 text-purple-400" />
        <h1 className="text-2xl font-bold text-white">Enquetes</h1>
      </div>

      <CreatePollForm onCreated={() => { void mutate() }} />

      {activePolls.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Enquetes Ativas</h2>
          {activePolls.map(poll => (
            <PollCard key={poll.id} poll={poll} onAction={handleAction} />
          ))}
        </div>
      )}

      {closedPolls.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-400">Enquetes Encerradas</h2>
          {closedPolls.map(poll => (
            <PollCard key={poll.id} poll={poll} onAction={handleAction} />
          ))}
        </div>
      )}

      {polls.length === 0 && (
        <div className="text-center py-12 text-zinc-500">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma enquete criada ainda.</p>
          <p className="text-sm mt-1">Crie uma enquete acima para comecar!</p>
        </div>
      )}
    </div>
  )
}
